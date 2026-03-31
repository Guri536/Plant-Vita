package com.main.plantvita

import android.content.Context
import android.net.ConnectivityManager
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
    private var networkCallback: ConnectivityManager.NetworkCallback? = null


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        networkCallback = bindToWifiNetwork(this)

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
                val viewModel: AuthViewModel = viewModel()
                AppNavigation(viewModel = viewModel)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // Crucial: Clean up the callback to prevent memory leaks
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        networkCallback?.let { cm.unregisterNetworkCallback(it) }
        cm.bindProcessToNetwork(null)
    }
}