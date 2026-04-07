package com.main.plantvita.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.work.WorkManager
import androidx.work.impl.WorkManagerImpl
import com.main.plantvita.navigation.Routes.ADD_DEVICE
import com.main.plantvita.navigation.Routes.AUTH
import com.main.plantvita.navigation.Routes.HOME
import com.main.plantvita.navigation.Routes.PLANT_DETAIL
import com.main.plantvita.navigation.Routes.PROFILE
import com.main.plantvita.navigation.Routes.SETUP_PLANT
import com.main.plantvita.network.RetrofitClient
import com.main.plantvita.screen.AddDeviceScreen
import com.main.plantvita.screen.AuthScreen
import com.main.plantvita.screen.HomeScreen
import com.main.plantvita.screen.PlantDetailScreen
import com.main.plantvita.screen.PlantSetupScreen
import com.main.plantvita.screen.ProfileScreen
import com.main.plantvita.viewmodel.AuthViewModel
import com.main.plantvita.viewmodel.HomeViewModel
import com.main.plantvita.viewmodel.PlantDetailViewModel
import kotlinx.coroutines.launch

@Composable
fun AppNavigation(viewModel: AuthViewModel, homeViewModel: HomeViewModel) {
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
                homeViewModel,
                onAddDeviceClick = {
                    navController.navigate(ADD_DEVICE)
                },
                onProfileClick = {
                    navController.navigate(PROFILE)
                },
                onNavigateToPlantDetail = { id ->
                    navController.navigate(Routes.createPlantDetailRoute(id))
                },
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

        composable(
            route = SETUP_PLANT,
            arguments = listOf(navArgument("plantId") { type = NavType.IntType })
        ) { backStackEntry ->
            val plantId = backStackEntry.arguments?.getInt("plantId") ?: 0
            PlantSetupScreen(
                plantId = plantId,
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable(
            route = PLANT_DETAIL,
            arguments = listOf(navArgument("plantId") { type = NavType.IntType })
        ) { backStackEntry ->
            val plantId = backStackEntry.arguments?.getInt("plantId") ?: return@composable

            val context = LocalContext.current

            val viewModel: PlantDetailViewModel = viewModel(
                factory = object : ViewModelProvider.Factory {
                    override fun <T : ViewModel> create(modelClass: Class<T>): T {
                        return PlantDetailViewModel(
                            apiService = RetrofitClient.getInstance(context),
                            plantId = plantId
                        ) as T
                    }
                }
            )
            PlantDetailScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToSetup = { id ->  // ADD THIS
                    navController.navigate(Routes.createSetupPlantRoute(id))
                }
            )
        }
    }
}
