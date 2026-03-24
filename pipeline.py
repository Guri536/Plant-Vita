"""
pipeline.py
───────────
VisionPipeline — the single class that ties together every compute step.

Step order per request
  1. Color standardization   (Gray World WB + CLAHE on LAB L channel)
  2. SAM3 semantic segmentation   (generic plant prompts, no species hint)
  3. Green pixel density   (HSV green fraction within the mask)
  4. Masked crop preparation   (white background outside the mask)
  5. ResNet18 dual-head inference   (species + health)
  6. Response dict assembly

Both heavy models (SAM3 predictor + ResNet18) are loaded once in
load_models() and kept alive for the process lifetime.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Optional

import cv2
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms

from model_arch import HEALTH_LABELS, SPECIES_LABELS, PlantVitaModel

logger = logging.getLogger("plantvita.vision.pipeline")

# ── Constants ─────────────────────────────────────────────────────────────────

# Exactly matches eval_transform used during training (Big_set_1_0.py)
_EVAL_TRANSFORM = transforms.Compose(
    [
        transforms.Resize((512, 512)),
        transforms.CenterCrop(512),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ]
)

# Generic text prompts tried in order (most specific → most generic).
# We iterate until segmentation score crosses EARLY_EXIT_SCORE.
_GENERIC_PROMPTS: list[str] = [
    "entire potted plant with leaves and stems",
    "potted houseplant foreground with leaves",
    "leafy indoor plant",
    "plant with leaves in a pot",
    "potted plant",
    "plant",
    "vegetation",
    "leaves",
]

# A species_confidence below this means the image is outside the model's scope.
SCOPE_THRESHOLD = 0.70

# Stop trying more prompts once a mask reaches this quality score.
_EARLY_EXIT_SCORE = 0.30

# Reject a mask entirely below this green-density × area score.
_MIN_MASK_SCORE = 0.04

# SAM3 defaults (can be overridden via env if needed)
_SAM3_CONF = float(os.getenv("SAM3_CONF", "0.35"))
_SAM3_IOU  = float(os.getenv("SAM3_IOU", "0.70"))

# Padding fraction when cropping to the mask bounding box
_CROP_PADDING = 0.05

# Morphological radius for expand-fill-contract hole filling
_EXPAND_RADIUS = 8


class VisionPipeline:
    """
    Stateful singleton loaded once at startup.
    Thread-safety: PyTorch inference is GIL-bound; FastAPI runs one worker —
    do NOT increase uvicorn workers.
    """

    def __init__(self) -> None:
        self.device: str = self._pick_device()
        self.models_loaded: bool = False
        self._resnet: Optional[PlantVitaModel] = None
        self._sam: object = None  # SAM3SemanticPredictor instance

    # ── Device ────────────────────────────────────────────────────────────────

    @staticmethod
    def _pick_device() -> str:
        if torch.cuda.is_available():
            return "cuda"
        if torch.backends.mps.is_available():
            return "mps"
        return "cpu"

    # ── Model loading ─────────────────────────────────────────────────────────

    def load_models(self) -> None:
        """Called once from the FastAPI lifespan context."""
        self._load_resnet()
        self._load_sam3()
        self.models_loaded = True

    def _load_resnet(self) -> None:
        ckpt_path = os.environ["MODEL_CHECKPOINT"]
        logger.info(f"Loading ResNet18 checkpoint: {ckpt_path}")

        model = PlantVitaModel()
        # weights_only=False because the training script saved a full state_dict
        # (no custom objects) — safe to load.
        state = torch.load(ckpt_path, map_location=self.device, weights_only=False)
        model.load_state_dict(state)
        model.to(self.device)
        model.eval()

        # Compile for throughput on CUDA if available (PyTorch ≥ 2.0)
        if self.device == "cuda":
            try:
                model = cast(PlantVitaModel, torch.compile(model)) # type: ignore[assignment]
                logger.info("ResNet18 compiled with torch.compile()")
            except Exception:
                pass  # compile is optional

        self._resnet = model
        logger.info("ResNet18 loaded OK")

    def _load_sam3(self) -> None:
        try:
            from ultralytics.models.sam import SAM3SemanticPredictor
        except ImportError as exc:
            raise RuntimeError(
                "ultralytics with SAM3 support is required. "
                "Install it with: pip install ultralytics>=8.2.0"
            ) from exc

        ckpt_path = os.environ["SAM3_CHECKPOINT"]
        logger.info(f"Loading SAM3 checkpoint: {ckpt_path}")

        predictor = SAM3SemanticPredictor(
            overrides=dict(
                conf    = _SAM3_CONF,
                task    = "segment",
                mode    = "predict",
                model   = ckpt_path,
                half    = (self.device == "cuda"),
                verbose = False,
                save    = False,
                show    = False,
                plots   = False,
                device  = self.device,
                iou     = _SAM3_IOU,
            )
        )

        # Warm-up: forces CUDA kernels to compile and GPU memory to allocate.
        # A cold first request would otherwise time-out.
        dummy = np.zeros((512, 512, 3), dtype=np.uint8)
        predictor.set_image(dummy)
        _ = predictor(text=["plant"])
        if self.device == "cuda":
            torch.cuda.empty_cache()

        self._sam = predictor
        logger.info("SAM3 loaded and warm-up complete")

    # ── Step 1: Color standardization ─────────────────────────────────────────

    @staticmethod
    def _color_standardize(img: np.ndarray) -> np.ndarray:
        """
        1. Gray World white balance in LAB (shifts A/B toward neutral 128).
        2. CLAHE on LAB L channel (clipLimit=3.0, tile=(4,4)).
        Matches ColorStandardising.py exactly.
        """
        # White balance
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
        lab[:, :, 1] = np.clip(lab[:, :, 1] - (np.mean(lab[:, :, 1]) - 128.0), 0, 255)
        lab[:, :, 2] = np.clip(lab[:, :, 2] - (np.mean(lab[:, :, 2]) - 128.0), 0, 255)
        img = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)

        # CLAHE
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_ch, a_ch, b_ch = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
        img = cv2.cvtColor(
            cv2.merge((clahe.apply(l_ch), a_ch, b_ch)),
            cv2.COLOR_LAB2BGR,
        )
        return img

    # ── Step 2: SAM3 segmentation ─────────────────────────────────────────────

    @staticmethod
    def _plantish_map(img: np.ndarray) -> np.ndarray:
        """
        Boolean mask of pixels whose colour is plausibly part of a plant:
        green, yellow, brown, or pink/red.
        Used as the scoring signal during prompt selection — not for green density.
        """
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        return (
            ((h >= 20) & (h <= 100) & (s >= 25) & (v >= 25))        # green
            | ((h >= 10) & (h < 20) & (s >= 30) & (v >= 35))        # yellow
            | ((h >= 5) & (h <= 20) & (s >= 25) & (v >= 30) & (v <= 160))  # brown
            | ((h >= 140) & (h <= 175) & (s >= 25) & (v >= 40))     # pink/red
        )

    @staticmethod
    def _extract_masks(
        results: object, ih: int, iw: int
    ) -> list[tuple[np.ndarray, object]]:
        """
        Pull binary masks out of a SAM3 result object.
        Resizes to (ih, iw) if the model returned a different spatial resolution.
        Single CPU tensor transfer per result object.
        """
        out: list[tuple[np.ndarray, object]] = []
        if not results or results[0].masks is None:  # type: ignore[index]
            return out

        data  = results[0].masks.data.cpu().numpy()  # type: ignore[index]
        boxes = (
            results[0].boxes.xyxy.cpu().numpy()       # type: ignore[index]
            if results[0].boxes is not None            # type: ignore[index]
            else None
        )
        for idx, m_np in enumerate(data):
            if m_np.shape[:2] != (ih, iw):
                m_np = cv2.resize(m_np.astype(np.float32), (iw, ih))
            m_bin = (m_np > 0.5).astype(np.uint8)
            box   = boxes[idx] if boxes is not None and idx < len(boxes) else None
            out.append((m_bin, box))
        return out

    @staticmethod
    def _smooth_mask(mask: np.ndarray) -> np.ndarray:
        """Close small gaps, open specks, then Gaussian-blur the boundary."""
        k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        k_open  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        closed  = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k_close, iterations=1)
        opened  = cv2.morphologyEx(closed, cv2.MORPH_OPEN, k_open, iterations=1)
        blurred = cv2.GaussianBlur(opened.astype(np.float32), (7, 7), 0)
        return (blurred > 0.40).astype(np.uint8)

    @staticmethod
    def _expand_fill_contract(mask: np.ndarray, radius: int = _EXPAND_RADIUS) -> np.ndarray:
        """
        Dilate → fill interior holes per connected component → erode.
        Bridges thin stem gaps without bleeding significantly into the background.
        """
        k        = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1)
        )
        expanded = cv2.dilate(mask, k, iterations=1)
        filled   = np.zeros_like(expanded)

        n, labels, _, _ = cv2.connectedComponentsWithStats(expanded)
        for i in range(1, n):
            comp     = (labels == i).astype(np.uint8)
            contours, _ = cv2.findContours(
                comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            if contours:
                cv2.drawContours(filled, contours, -1, 1, thickness=cv2.FILLED)

        contracted = cv2.erode(filled, k, iterations=1)
        return contracted if contracted.sum() > 0 else filled

    def _segment(
        self, img: np.ndarray
    ) -> tuple[Optional[np.ndarray], bool]:
        """
        Tries each prompt in _GENERIC_PROMPTS and scores every returned mask
        against the plant-colour map.  Picks the best mask across all prompts.

        Returns (mask_uint8 | None, segmentation_success).
        Falls back gracefully — never raises.
        """
        ih, iw   = img.shape[:2]
        plantish = self._plantish_map(img)

        try:
            self._sam.set_image(img)  # type: ignore[union-attr]
        except Exception as exc:
            logger.warning(f"SAM3 set_image failed: {exc}")
            return None, False

        best_mask  : Optional[np.ndarray] = None
        best_score : float = -1.0

        for prompt in _GENERIC_PROMPTS:
            try:
                results = self._sam(text=[prompt])  # type: ignore[call-overload]
                masks   = self._extract_masks(results, ih, iw)
                if not masks:
                    continue

                # Build a union of all instance masks and score both the union
                # and each individual mask — take whichever scores higher.
                union = np.zeros((ih, iw), dtype=np.uint8)
                for m_bin, _ in masks:
                    union = np.maximum(union, m_bin)
                    total = int(m_bin.sum())
                    if total == 0:
                        continue
                    gd    = float((plantish & (m_bin == 1)).sum()) / total
                    score = gd * (total / (ih * iw)) ** 0.5  # area-weighted
                    if score > best_score:
                        best_score, best_mask = score, m_bin.copy()

                u_total = int(union.sum())
                if u_total > 0:
                    u_gd    = float((plantish & (union == 1)).sum()) / u_total
                    u_score = u_gd * (u_total / (ih * iw)) ** 0.5
                    if u_score > best_score:
                        best_score, best_mask = u_score, union.copy()

                if best_score >= _EARLY_EXIT_SCORE:
                    break

            except Exception as exc:
                logger.warning(f"SAM3 prompt '{prompt}' raised: {exc}")
                continue

        # Free GPU embedding cache
        if self.device == "cuda":
            torch.cuda.empty_cache()

        if best_mask is None or best_score < _MIN_MASK_SCORE:
            logger.warning(f"SAM3 segmentation rejected (score={best_score:.3f})")
            return None, False

        # Post-process
        best_mask = self._expand_fill_contract(best_mask)
        best_mask = self._smooth_mask(best_mask)

        if int(best_mask.sum()) == 0:
            logger.warning("Post-processed mask is empty")
            return None, False

        logger.debug(f"SAM3 OK — score={best_score:.3f}")
        return best_mask, True

    # ── Step 3: Green pixel density ───────────────────────────────────────────

    @staticmethod
    def _green_density(
        img: np.ndarray, mask: Optional[np.ndarray]
    ) -> float:
        """
        Fraction of *masked* pixels whose HSV hue falls in the green band
        (hue 35–85 in OpenCV's 0-180 scale, S≥40, V≥40).

        If mask is None (segmentation failed), compute over the full image —
        the field will still be informative, just noisier.
        """
        hsv      = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h, s, v  = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
        green    = (h >= 35) & (h <= 85) & (s >= 40) & (v >= 40)

        if mask is not None:
            in_mask = mask == 1
            total   = int(in_mask.sum())
            if total == 0:
                return 0.0
            return float((green & in_mask).sum()) / total

        total = img.shape[0] * img.shape[1]
        return float(green.sum()) / max(1, total)

    # ── Step 4: Masked crop preparation ──────────────────────────────────────

    @staticmethod
    def _crop_to_mask(
        img: np.ndarray, mask: np.ndarray, padding: float = _CROP_PADDING
    ) -> np.ndarray:
        """
        Crops the image to the mask bounding box (+ padding fraction),
        replaces background with pure white (255, 255, 255).
        Returns the white-background masked crop.
        """
        ys, xs = np.where(mask == 1)
        if len(xs) == 0:
            return img

        ih, iw  = img.shape[:2]
        x1, y1  = int(xs.min()), int(ys.min())
        x2, y2  = int(xs.max()), int(ys.max())
        bw, bh  = x2 - x1, y2 - y1
        px, py  = int(bw * padding), int(bh * padding)
        x1c = max(0, x1 - px);  y1c = max(0, y1 - py)
        x2c = min(iw, x2 + px); y2c = min(ih, y2 + py)

        cropped_img  = img[y1c:y2c, x1c:x2c]
        cropped_mask = mask[y1c:y2c, x1c:x2c]

        white  = np.full_like(cropped_img, 255)
        return np.where(cropped_mask[:, :, None] == 1, cropped_img, white)

    # ── Step 5: ResNet18 inference ────────────────────────────────────────────

    @torch.inference_mode()
    def _run_inference(self, img_bgr: np.ndarray) -> dict:
        """
        Applies the eval transform and runs the dual-head ResNet18.

        img_bgr: BGR uint8 — either the masked crop or the full image.
        Returns a dict with species, species_confidence, health, health_confidence.
        """
        assert self._resnet is not None, "ResNet not loaded"

        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        tensor  = _EVAL_TRANSFORM(pil_img).unsqueeze(0).to(self.device)  # type: ignore[call-overload]

        s_logits, h_logits = self._resnet(tensor)

        s_probs = torch.softmax(s_logits, dim=1)[0].cpu().numpy()
        h_probs = torch.softmax(h_logits, dim=1)[0].cpu().numpy()

        s_idx = int(s_probs.argmax())
        h_idx = int(h_probs.argmax())

        return {
            "species":            SPECIES_LABELS[s_idx],
            "species_confidence": round(float(s_probs[s_idx]), 4),
            "health":             HEALTH_LABELS[h_idx],
            "health_confidence":  round(float(h_probs[h_idx]), 4),
        }

    # ── Public entry point ────────────────────────────────────────────────────

    def run(self, img_bgr: np.ndarray) -> dict:
        """
        Execute the full pipeline on a raw BGR image from the ESP32-CAM.

        Always returns a valid response dict — never raises.
        If SAM3 fails, inference still runs on the full image and
        segmentation_success is set to False.
        """
        t0 = time.monotonic()

        # 1. Color standardization
        img = self._color_standardize(img_bgr)

        # 2. SAM3 segmentation
        mask, seg_ok = self._segment(img)

        # 3. Green density (masked region if available, else full image)
        gd = self._green_density(img, mask)

        # 4. Prepare inference input
        if seg_ok and mask is not None:
            infer_img = self._crop_to_mask(img, mask)
        else:
            infer_img = img  # fallback: full image

        # 5. ResNet inference
        inf = self._run_inference(infer_img)

        # 6. Business logic flags
        in_scope    = inf["species_confidence"] >= SCOPE_THRESHOLD
        trigger_llm = (not in_scope) or (inf["health"] != "Healthy")

        elapsed = time.monotonic() - t0
        logger.info(
            "Pipeline complete in %.2fs — "
            "species=%s(%.2f) health=%s(%.2f) gd=%.2f seg=%s",
            elapsed,
            inf["species"], inf["species_confidence"],
            inf["health"],  inf["health_confidence"],
            gd, seg_ok,
        )

        return {
            "species":              inf["species"],
            "species_confidence":   inf["species_confidence"],
            "in_model_scope":       in_scope,
            "health":               inf["health"],
            "health_confidence":    inf["health_confidence"],
            "green_density":        round(gd, 4),
            "segmentation_success": seg_ok,
            "trigger_llm":          trigger_llm,
        }