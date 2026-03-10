package com.main.plantvita.data

import retrofit2.http.Body
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.Header
import retrofit2.http.POST

interface BackendService{
    @POST("auth/register")
    suspend fun register(@Body user: UserCreate): Any

    @FormUrlEncoded
    @POST("token")
    suspend fun login(
        @Field("username") email: String,
        @Field("password") pass: String
    ): TokenResponse

    @POST("social-login")
    suspend fun socialLogin(
        @Body login: SocialLoginRequest,
        @Header("x-api-key") apiKey: String
    ): TokenResponse

    companion object {
        private const val BASE_URL = "http://10.0.2.2:8000/"

        fun create(): BackendService {
            return retrofit2.Retrofit.Builder()
                .baseUrl(BASE_URL)
                .addConverterFactory(retrofit2.converter.gson.GsonConverterFactory.create())
                .build()
                .create(BackendService::class.java)
        }
    }
}