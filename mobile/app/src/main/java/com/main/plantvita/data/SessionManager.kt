package com.main.plantvita.data

import android.content.Context
import androidx.core.content.edit

class SessionManager(context: Context) {
    private val prefs = context.getSharedPreferences("plantvita_session", Context.MODE_PRIVATE)

    fun saveSession(accessToken: String, refreshToken: String, email: String) {
        prefs.edit {
            putString("access_token", accessToken)
                .putString("refresh_token", refreshToken)
                .putString("email", email)
        }
    }

    fun getAccessToken(): String? = prefs.getString("access_token", null)
    fun getRefreshToken(): String? = prefs.getString("refresh_token", null)
    fun getEmail(): String? = prefs.getString("email", null)
    fun isLoggedIn(): Boolean = getAccessToken() != null

    fun clearSession() = prefs.edit { clear() }
}