package com.main.plantvita

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.main.plantvita.data.AppNavigation
import com.main.plantvita.screen.AddDeviceScreen
import com.main.plantvita.screen.HomeScreen
import com.main.plantvita.ui.theme.PlantVitaTheme
import com.main.plantvita.viewmodel.AuthViewModel
import androidx.lifecycle.ViewModelProvider

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PlantVitaTheme {
                val viewModel: AuthViewModel = viewModel()
                AppNavigation(viewModel = viewModel)
            }
        }
    }
}