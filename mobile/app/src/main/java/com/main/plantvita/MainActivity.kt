package com.main.plantvita

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.main.plantvita.data.HealthCheckWorker
import com.main.plantvita.navigation.AppNavigation
import com.main.plantvita.network.bindToWifiNetwork
import com.main.plantvita.ui.theme.PlantVitaTheme
import com.main.plantvita.viewmodel.AuthViewModel
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val workRequest = PeriodicWorkRequestBuilder<HealthCheckWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build())
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "plant_health_check",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )

        setContent {
            PlantVitaTheme {
                bindToWifiNetwork(this)
                val viewModel: AuthViewModel = viewModel()
                AppNavigation(viewModel = viewModel)
            }
        }
    }
}