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
