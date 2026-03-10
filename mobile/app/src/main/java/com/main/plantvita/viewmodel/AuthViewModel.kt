package com.main.plantvita.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel

sealed interface AuthUiState {
    object Idle: AuthUiState
    object Loading: AuthUiState
    object Success: AuthUiState
    data class Error(val message: String): AuthUiState
}

class AuthViewModel (application: Application): AndroidViewModel(application) {

}