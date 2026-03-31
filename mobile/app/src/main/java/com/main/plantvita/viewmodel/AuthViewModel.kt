package com.main.plantvita.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.application
import androidx.lifecycle.viewModelScope
import com.main.plantvita.data.RegisterRequest
import com.main.plantvita.network.RetrofitClient
import com.main.plantvita.data.SessionManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

sealed class AuthState {
    object Idle : AuthState()
    object Loading : AuthState()
    object Success : AuthState()
    data class Error(val message: String) : AuthState()
}

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val api get() = RetrofitClient.getInstance(application)
    private val session = SessionManager(application)

    private val _authState = MutableStateFlow<AuthState>(AuthState.Idle)
    val authState: StateFlow<AuthState> = _authState

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _authState.value = AuthState.Loading
            try {
                val response = api.login(email, password)
                session.saveSession(response.accessToken, response.refreshToken, email)
                _authState.value = AuthState.Success
            } catch (e: Exception) {
                val errorMsg = when {
                    e is java.net.ConnectException -> "Cannot reach Laptop Server. Check IP/Hotspot."
                    e is java.net.SocketTimeoutException -> "Server timed out."
                    e.message?.contains("401") == true -> "Invalid email or password."
                    else -> e.message ?: "Login failed"
                }
                _authState.value = AuthState.Error(errorMsg)
            }
        }
    }

    suspend fun logout() {
        session.clearSession()
        RetrofitClient.reset() // Force URL re-resolution on next login
        _authState.value = AuthState.Idle
    }

    fun register(email: String, password: String) {
        viewModelScope.launch {
            _authState.value = AuthState.Loading
            try {
                api.register(RegisterRequest(email, password))
                // Auto login after register
                login(email, password)
            } catch (e: Exception) {
                _authState.value = AuthState.Error(e.message ?: "Registration failed")
            }
        }
    }

    fun getEmail() = session.email

    fun isLoggedIn() = session.isLoggedIn
}