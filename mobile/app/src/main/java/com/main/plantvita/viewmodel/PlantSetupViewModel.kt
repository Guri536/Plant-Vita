package com.main.plantvita.viewmodel

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.main.plantvita.data.ApiService
import com.main.plantvita.data.PlantRead
import com.main.plantvita.data.PlantUpdate
import com.main.plantvita.network.RetrofitClient
import kotlinx.coroutines.async
import kotlinx.coroutines.launch

sealed class SetupUiState {
    object Loading : SetupUiState()
    data class Success(val plant: PlantRead) : SetupUiState()
    data class Error(val message: String) : SetupUiState()
    object SaveComplete : SetupUiState()
}

class PlantSetupViewModel(application: Application) : AndroidViewModel(application) {

    private val api: ApiService get() = RetrofitClient.getInstance(getApplication())

    var uiState by mutableStateOf<SetupUiState>(SetupUiState.Loading)
        private set

    // Form State
    var plantName by mutableStateOf("")
    var species by mutableStateOf("")
    var moistureRange by mutableStateOf(20f..80f)
    var isIndoor by mutableStateOf(true)
    var wateringMode by mutableStateOf("manual") // "manual" or "auto"
    var pumpDuration by mutableStateOf(5)
    var captureRate by mutableStateOf(30)
    var notificationsEnabled by mutableStateOf(true)

    // For the UI header image
    var latestImageUrl by mutableStateOf<String?>(null)

    fun loadPlant(plantId: Int) {
        viewModelScope.launch {
            uiState = SetupUiState.Loading
            try {
                val plantDeferred = async { api.getPlant(plantId) }
                val imagesDeferred = async { api.getPlantImages(plantId) }

                val plant = plantDeferred.await()
                val images = imagesDeferred.await()

                // Populate form fields
                plantName = plant.name
                species = plant.species ?: ""
                moistureRange = plant.moistureThresholdMin.toFloat()..plant.moistureThresholdMax.toFloat()
                isIndoor = plant.indoor ?: true
                wateringMode = plant.wateringMode ?: "manual"
                pumpDuration = plant.pumpDuration ?: 5
                captureRate = plant.captureRate ?: 30
                notificationsEnabled = plant.notificationsEnabled == true

                // Get latest image from history if available
                latestImageUrl = images.firstOrNull()?.imageUrl

                uiState = SetupUiState.Success(plant)
            } catch (e: Exception) {
                uiState = SetupUiState.Error(e.message ?: "Failed to load plant details")
            }
        }
    }

    fun savePlant(plantId: Int) {
        viewModelScope.launch {
            uiState = SetupUiState.Loading
            try {
                val updateData = PlantUpdate(
                    name = plantName,
                    species = species.ifBlank { null },
                    moistureThresholdMin = moistureRange.start.toInt(),
                    moistureThresholdMax = moistureRange.endInclusive.toInt(),
                    indoor = isIndoor,
                    wateringMode = wateringMode,
                    pumpDuration = pumpDuration,
                    captureRate = captureRate,
                    notificationsEnabled = notificationsEnabled
                )

                api.updatePlant(plantId, updateData)
                uiState = SetupUiState.SaveComplete
            } catch (e: Exception) {
                uiState = SetupUiState.Error(e.message ?: "Failed to save updates")
            }
        }
    }
}