package com.main.plantvita.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.main.plantvita.data.ApiService
import com.main.plantvita.data.CommandRequest
import com.main.plantvita.data.DiagnosisRead
import com.main.plantvita.data.ImageRead
import com.main.plantvita.data.PlantRead
import com.main.plantvita.data.SensorReadingRead
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class PlantDetailUiState {
    object Loading : PlantDetailUiState()
    data class Success(
        val plant: PlantRead,
        val diagnosis: DiagnosisRead?,
        val recentImages: List<ImageRead>,
        val sensorHistory: List<SensorReadingRead>
    ) : PlantDetailUiState()
    data class Error(val message: String) : PlantDetailUiState()
}

sealed class PumpState {
    object Idle : PumpState()
    object Loading : PumpState()
    object Success : PumpState()
    data class Error(val message: String) : PumpState()
}

class PlantDetailViewModel(
    private val apiService: ApiService,
    private val plantId: Int
) : ViewModel() {

    private val _uiState = MutableStateFlow<PlantDetailUiState>(PlantDetailUiState.Loading)
    val uiState: StateFlow<PlantDetailUiState> = _uiState.asStateFlow()

    private val _pumpState = MutableStateFlow<PumpState>(PumpState.Idle)
    val pumpState: StateFlow<PumpState> = _pumpState

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = PlantDetailUiState.Loading
            try {
                // Fetch all data concurrently
                val plantDeferred = async { apiService.getPlant(plantId) }
                val imagesDeferred = async { apiService.getPlantImages(plantId) }

                // Diagnosis might 404 if no images exist yet, handle gracefully
                val diagnosisDeferred = async {
                    try { apiService.getPlantDiagnosis(plantId) } catch (e: Exception) { null }
                }

                val sensorsDeferred = async {
                    try { apiService.getSensorHistory(plantId) } catch (e: Exception) { emptyList() }
                }

                val plant = plantDeferred.await()
                val images = imagesDeferred.await()
                val diagnosis = diagnosisDeferred.await()
                val sensorHistory = sensorsDeferred.await()

                _uiState.value = PlantDetailUiState.Success(plant, diagnosis, images, sensorHistory)
            } catch (e: Exception) {
                _uiState.value = PlantDetailUiState.Error(e.message ?: "Failed to load plant details")
            }
        }
    }

    fun triggerPump(macAddress: String) {
        viewModelScope.launch {
            _pumpState.value = PumpState.Loading
            try {
                apiService.createCommand(macAddress, CommandRequest())
                _pumpState.value = PumpState.Success
                // Reset back to idle after 2 seconds
                delay(2000)
                _pumpState.value = PumpState.Idle
            } catch (e: Exception) {
                _pumpState.value = PumpState.Error(e.message ?: "Failed to trigger pump")
                delay(2000)
                _pumpState.value = PumpState.Idle
            }
        }
    }
}