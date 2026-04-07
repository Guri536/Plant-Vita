package com.main.plantvita.data

import retrofit2.http.Body
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

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

    @GET("plants/{plant_id}")
    suspend fun getPlant(@Path("plant_id") plantId: Int): PlantRead

    @PATCH("plants/{plant_id}")
    suspend fun updatePlant(@Path("plant_id") plantId: Int, @Body plant: PlantUpdate): PlantRead

    @GET("dashboard/plants")
    suspend fun getDashboardPlants(): List<PlantSummary>

    @GET("plants/{plant_id}/diagnosis/")
    suspend fun getPlantDiagnosis(@Path("plant_id") plantId: Int): DiagnosisRead

    @GET("plants/{plant_id}/images/")
    suspend fun getPlantImages(@Path("plant_id") plantId: Int): List<ImageRead>

    @POST("plants/{mac}/commands")
    suspend fun createCommand(
        @Path("mac") mac: String,
        @Body body: CommandRequest
    ): CommandResponse

    @GET("plants/{plant_id}/settings")
    suspend fun getPlantSettings(@Path("plant_id") plantId: Int): PlantUpdate

    @GET("plants/{plant_id}/sensors")
    suspend fun getSensorHistory(
        @Path("plant_id") plantId: Int,
        @Query("limit") limit: Int = 24
    ): List<SensorReadingRead>
}
