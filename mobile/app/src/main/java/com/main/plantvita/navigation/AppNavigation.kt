package com.main.plantvita.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.work.WorkManager
import androidx.work.impl.WorkManagerImpl
import com.main.plantvita.navigation.Routes.ADD_DEVICE
import com.main.plantvita.navigation.Routes.AUTH
import com.main.plantvita.navigation.Routes.HOME
import com.main.plantvita.navigation.Routes.PROFILE
import com.main.plantvita.screen.AddDeviceScreen
import com.main.plantvita.screen.AuthScreen
import com.main.plantvita.screen.HomeScreen
import com.main.plantvita.screen.ProfileScreen
import com.main.plantvita.viewmodel.AuthViewModel
import kotlinx.coroutines.launch

@Composable
fun AppNavigation(viewModel: AuthViewModel) {
    val navController = rememberNavController()
    val isLoggedIn by viewModel.isLoggedIn().collectAsStateWithLifecycle(initialValue = null)
    val userEmail by viewModel.getEmail().collectAsState(initial = null)
    val scope = rememberCoroutineScope()

    // Wait for the initial login state to be loaded from DataStore
    if (isLoggedIn == null) return

    NavHost(
        navController = navController,
        startDestination = if (isLoggedIn == true) HOME else AUTH
    ) {
        composable(AUTH) {
            AuthScreen(
                viewModel = viewModel,
                onAuthSuccess = {
                    navController.navigate(HOME) {
                        popUpTo(AUTH) { inclusive = true }
                    }
                }
            )
        }

        composable(HOME) {
            HomeScreen(
                onAddDeviceClick = {
                    navController.navigate(ADD_DEVICE)
                },
                onProfileClick = {
                    navController.navigate(PROFILE)
                }
            )
        }

        composable(ADD_DEVICE) {
            AddDeviceScreen(
                onComplete = {
                    navController.popBackStack()
                }
            )
        }

        composable(PROFILE) {
            ProfileScreen(
                email = userEmail,
                onLogout = {
                    scope.launch {
                        viewModel.logout()
                        WorkManager.getInstance(navController.context).cancelAllWork()
                        navController.navigate(AUTH) {
                            popUpTo(HOME) { inclusive = true }
                        }
                    }
                },
                onBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}
