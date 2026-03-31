package com.main.plantvita.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.main.plantvita.R
import com.main.plantvita.network.RetrofitClient
import kotlinx.coroutines.flow.first

class HealthCheckWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val session = SessionManager(applicationContext)
        if (!session.isLoggedIn.first()) return Result.success()

        return try {
            val api = RetrofitClient.getInstance(applicationContext)
            val status = api.getPlantStatus()  // add this endpoint to ApiService
            if (status.isCritical) {
                sendNotification("Plant-Vita Alert", status.message)
            }
            Result.success()
        } catch (e: Exception) {
            Log.e("HealthCheck", "Failed: ${e.message}")
            Result.retry()
        }
    }

    private fun sendNotification(title: String, message: String) {
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        val channel =
            NotificationChannel("plant_alerts", "Plant Alerts", NotificationManager.IMPORTANCE_HIGH)
        manager.createNotificationChannel(channel)

        val intent = applicationContext.packageManager
            .getLaunchIntentForPackage(applicationContext.packageName)

        val pendingIntent = PendingIntent.getActivity(
            applicationContext,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(applicationContext, "plant_alerts")
            .setSmallIcon(R.drawable.logo)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent) // Add this
            .setAutoCancel(true)
            .build()

        manager.notify(1, notification)
    }
}