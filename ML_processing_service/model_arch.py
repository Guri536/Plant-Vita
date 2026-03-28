"""
model_arch.py
─────────────
ResNet18 dual-head architecture.

Species labels and health labels are fixed here because the service is a
deployment artefact, not a training script — label discovery from disk is
intentionally absent.
"""

from __future__ import annotations

import torch
import torch.nn as nn
from torchvision import models

# ── Label maps ────────────────────────────────────────────────────────────────
# Order MUST match the order used when the checkpoint was saved.
# Species: alphabetical discovery order from the training dataset root.
# Health:  canonical order from HEALTH_LABEL_ORDER in the training script.

SPECIES_LABELS: list[str] = [
    "Aloevera",
    "Bamboo",
    "Basil",
    "Hibiscus",
    "Money Plant",
    "Rose",
]

HEALTH_LABELS: list[str] = [
    "Healthy",
    "Infected",
    "Wilting"
]

NUM_SPECIES = len(SPECIES_LABELS)
NUM_HEALTH  = len(HEALTH_LABELS)


class PlantVitaModel(nn.Module):
    """
    ResNet18 backbone (ImageNet weights dropped at inference time) with two
    independent classification heads sharing the same feature extractor.

    forward() returns (species_logits, health_logits).
    """

    def __init__(self) -> None:
        super().__init__()

        # Load without pre-trained weights — the checkpoint supplies them.
        backbone = models.resnet18(weights=None)
        in_features: int = backbone.fc.in_features   # 512 for ResNet18
        backbone.fc = nn.Identity()                  # type: ignore[assignment]
        self.backbone = backbone

        self.species_head = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(256, NUM_SPECIES),
        )
        self.health_head = nn.Sequential(
            nn.Linear(in_features, 256),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(256, NUM_HEALTH),
        )

    def forward(
        self, x: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        feats = self.backbone(x)
        return self.species_head(feats), self.health_head(feats)