package com.main.plantvita.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.main.plantvita.screen.AddDeviceScreen
import com.main.plantvita.screen.AuthScreen
import com.main.plantvita.screen.HomeScreen
import com.main.plantvita.screen.ProfileScreen
import com.main.plantvita.viewmodel.AuthViewModel

@Composable
fun AppNavigation(viewModel: AuthViewModel) {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        // Using "home" as the landing page if logged in
        startDestination = if (viewModel.isLoggedIn()) "home" else "auth"
    ) {
        composable("auth") {
            AuthScreen(
                viewModel = viewModel,
                onAuthSuccess = {
                    navController.navigate("home") {
                        popUpTo("auth") { inclusive = true }
                    }
                }
            )
        }

        composable("home") {
            HomeScreen(
                onAddDeviceClick = {
                    navController.navigate("add_device")
                },
                onProfileClick = {
                    navController.navigate("profile")
                }
            )
        }

        composable("add_device") {
            AddDeviceScreen(
                onComplete = {
                    // Navigate back to Home after setup is finished or cancelled
                    navController.popBackStack()
                }
            )
        }


        composable("profile") {
            ProfileScreen(
                email = viewModel.getEmail(),
                onLogout = {
                    viewModel.logout()
                    navController.navigate("auth") {
                        popUpTo("home") { inclusive = true }
                    }
                },
                onBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}