package com.main.plantvita.data

import retrofit2.http.Body
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST

interface ApiService {
    @FormUrlEncoded
    @POST("token")
    suspend fun login(
        @Field("username") email: String,
        @Field("password") password: String
    ): TokenResponse

    @POST("register")
    suspend fun register(@Body body: RegisterRequest): UserResponse

    @POST("refresh")
    suspend fun refreshToken(@Body body: RefreshRequest): TokenResponse

    @POST("devices/register")
    suspend fun registerDevice(@Body body: DeviceRegisterRequest): DeviceRegisterResponse

    @GET("plant/status")
    suspend fun getPlantStatus(): PlantStatus
}
