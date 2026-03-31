package com.main.plantvita.network

import android.content.Context
import com.main.plantvita.data.ApiService
import com.main.plantvita.data.RefreshRequest
import com.main.plantvita.data.SessionManager
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.first
import okhttp3.Authenticator
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object RetrofitClient {
    private var instance: ApiService? = null

    fun getInstance(context: Context): ApiService {
        if (instance == null) {
            val session = SessionManager(context)

            val authenticator = Authenticator { _, response ->
                if (response.request.header("X-Retry") != null) return@Authenticator null

                runBlocking {
                    try {
                        val refreshToken = session.refreshToken.first() ?: return@runBlocking null
                        val email = session.email.first() ?: ""

                        val newTokens = getInstance(context)
                            .refreshToken(RefreshRequest(refreshToken))

                        session.saveSession(
                            newTokens.accessToken,
                            newTokens.refreshToken,
                            email
                        )

                        return@runBlocking response.request.newBuilder()
                            .header("Authorization", "Bearer ${newTokens.accessToken}")
                            .header("X-Retry", "true")
                            .build()

                    } catch (e: Exception) {
                        session.clearSession()
                        return@runBlocking null
                    }
                }
            }

            val okHttpClient = OkHttpClient.Builder()
                .authenticator(authenticator)
                .addInterceptor { chain ->
                    val token = runBlocking {
                        session.accessToken.first()
                    }

                    val request = chain.request().newBuilder()
                        .apply {
                            token?.let {
                                header("Authorization", "Bearer $it")
                            }
                        }
                        .build()

                    chain.proceed(request)
                }
                .build()

            instance = Retrofit.Builder()
                .baseUrl(NetworkConfig.getBaseUrl(context))
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(ApiService::class.java)
        }
        return instance!!
    }

    fun reset() { instance = null }
}