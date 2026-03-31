package com.main.plantvita.data

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore by preferencesDataStore(name = "plantvita_session")

class SessionManager(private val context: Context) {

    companion object {
        val ACCESS_TOKEN = stringPreferencesKey("access_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val EMAIL = stringPreferencesKey("email")
    }

    suspend fun saveSession(accessToken: String, refreshToken: String, email: String) {
        context.dataStore.edit { prefs ->
            prefs[ACCESS_TOKEN] = accessToken
            prefs[REFRESH_TOKEN] = refreshToken
            prefs[EMAIL] = email
        }
    }

    val accessToken: Flow<String?> = context.dataStore.data
        .map { it[ACCESS_TOKEN] }

    val refreshToken: Flow<String?> = context.dataStore.data
        .map { it[REFRESH_TOKEN] }

    val email: Flow<String?> = context.dataStore.data
        .map { it[EMAIL] }

    val isLoggedIn: Flow<Boolean> = context.dataStore.data
        .map { it[ACCESS_TOKEN] != null }

    suspend fun clearSession() {
        context.dataStore.edit { it.clear() }
    }
}