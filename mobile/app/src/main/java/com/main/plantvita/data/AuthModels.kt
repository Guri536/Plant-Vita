package com.main.plantvita.data

data class UserCreate(
    val email: String,
    val password: String
)

data class LoginRequest(
    val username: String,
    val password: String
)

data class SocialLoginRequest(
    val email: String
)