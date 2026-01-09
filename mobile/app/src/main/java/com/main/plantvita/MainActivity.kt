package com.main.plantvita

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.main.plantvita.screen.AddDeviceScreen
import com.main.plantvita.screen.HomeScreen
import com.main.plantvita.ui.theme.PlantVitaTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PlantVitaTheme {
                val navController = rememberNavController()

                NavHost(navController = navController, startDestination = "home") {
                    composable("home") {
                        HomeScreen(
                            onClick = {
                                navController.navigate("add_device")
                            }
                        )
                    }
                    composable("add_device") {
                        AddDeviceScreen(
                            onComplete = {
                                navController.popBackStack()
                            }
                        )
                    }
                }
            }
        }
    }
}