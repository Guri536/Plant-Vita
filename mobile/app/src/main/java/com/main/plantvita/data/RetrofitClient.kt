package com.main.plantvita.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitClient {
    private var instance: ApiService? = null

    fun getInstance(context: Context): ApiService {
        bindToWifi(context)

        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        val network = connectivityManager.activeNetwork
        val caps = connectivityManager.getNetworkCapabilities(network)

        val okHttpClient = OkHttpClient.Builder()
            .apply {
                if (caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true && network != null) {
                    socketFactory(network.socketFactory)
                }
            }
            .build()

        if (instance == null) {
            instance = Retrofit.Builder()
                .baseUrl(NetworkConfig.getBaseUrl(context))
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ApiService::class.java)
        }
        return instance!!
    }

    // Call this when base URL might have changed (e.g. network switch)
    fun reset() { instance = null }
}