package com.main.plantvita.data

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST

data class WiFiNetwork(
    val ssid: String,
    val rssi: Int
)

interface ESP32Service{
    @GET("scan")
    suspend fun getNetworksFromDevice(): List<WiFiNetwork>

    @FormUrlEncoded
    @POST("save")
    suspend fun saveCredentialsToDevice(
        @Field("ssid") ssid: String,
        @Field("pass") pass: String
    ): String

    companion object{
        private const val BASEURL = "http://192.168.4.1/"

        fun create(): ESP32Service {
            return Retrofit.Builder()
                .baseUrl(BASEURL)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ESP32Service::class.java)
        }
    }
}