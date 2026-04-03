package com.main.plantvita.data

import com.google.gson.annotations.SerializedName

data class TokenResponse(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("refresh_token") val refreshToken: String,
    @SerializedName("token_type") val tokenType: String
)

data class RegisterRequest(
    val email: String,
    val password: String
)

data class UserResponse(
    val id: Int,
    val email: String
)

data class RefreshRequest(
    @SerializedName("refresh_token") val refreshToken: String
)

data class DeviceRegisterRequest(
    @SerializedName("mac_address") val macAddress: String,
    val email: String
)

data class DeviceRegisterResponse(
    val registered: Boolean,
    @SerializedName("is_new") val isNew: Boolean,
    @SerializedName("plant_id") val plantId: Int
)

data class PlantStatus(
    @SerializedName("is_critical") val isCritical: Boolean,
    val message: String
)

data class ProvisioningResponse(
    val status: String,
    val message: String? = null
)

data class ImageRead(
    val id: Int,
    @SerializedName("image_url") val imageUrl: String,
    val timestamp: String
)

data class PlantRead(
    val id: Int,
    val name: String,
    val species: String?,
    @SerializedName("moisture_threshold_min") val moistureThresholdMin: Int,
    @SerializedName("moisture_threshold_max") val moistureThresholdMax: Int,
    val indoor: Boolean?,
    @SerializedName("watering_mode") val wateringMode: String?,
    @SerializedName("pump_duration") val pumpDuration: Int?,
    @SerializedName("capture_rate") val captureRate: Int?,
    @SerializedName("notifications_enabled") val notificationsEnabled: Boolean,
    val images: List<ImageRead> = emptyList(),
    @SerializedName("sensor_readings") val sensorReadings: List<SensorReadingRead> = emptyList()
)

data class PlantUpdate(
    val name: String? = null,
    val species: String? = null,
    @SerializedName("moisture_threshold_min") val moistureThresholdMin: Int? = null,
    @SerializedName("moisture_threshold_max") val moistureThresholdMax: Int? = null,
    val indoor: Boolean? = null,
    @SerializedName("watering_mode") val wateringMode: String? = null,
    @SerializedName("pump_duration") val pumpDuration: Int?,
    @SerializedName("capture_rate") val captureRate: Int?,
    @SerializedName("notifications_enabled") val notificationsEnabled: Boolean? = null
)

data class PlantSummary(
    val id: Int,
    val name: String,
    val species: String?,
    @SerializedName("latest_image_url") val latestImageUrl: String?,
    @SerializedName("latest_moisture_pct") val latestMoisturePct: Float?,
    @SerializedName("latest_health_status") val latestHealthStatus: String?,
    @SerializedName("is_critical") val isCritical: Boolean
)

data class SensorReadingRead(
    val id: Int,
    @SerializedName("temp_c") val tempC: Float,
    @SerializedName("humidity_pct") val humidityPct: Float,
    @SerializedName("light_lux") val lightLux: Float,
    @SerializedName("air_ppm") val airPpm: Float,
    @SerializedName("air_quality_pct") val airQualityPct: Float?,
    @SerializedName("soil_root_pct") val soilRootPct: Float,
    @SerializedName("soil_surface_pct") val soilSurfacePct: Float,
    @SerializedName("soil_temp_c") val soilTempC: Float,
    val timestamp: String
)

data class DiagnosisRead(
    val id: Int,
    @SerializedName("image_url") val imageUrl: String,
    @SerializedName("ai_diagnosis") val aiDiagnosis: String?,
    @SerializedName("detected_health") val detectedHealth: String?,
    @SerializedName("health_confidence") val healthConfidence: Float?,
    @SerializedName("vision_error") val visionError: String?,
    val timestamp: String
)