package com.main.plantvita.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.main.plantvita.data.ApiService
import com.main.plantvita.data.DiagnosisRead
import com.main.plantvita.data.ImageRead
import com.main.plantvita.data.PlantRead
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class PlantDetailUiState {
    object Loading : PlantDetailUiState()
    data class Success(
        val plant: PlantRead,
        val diagnosis: DiagnosisRead?,
        val recentImages: List<ImageRead>
    ) : PlantDetailUiState()
    data class Error(val message: String) : PlantDetailUiState()
}

class PlantDetailViewModel(
    private val apiService: ApiService,
    private val plantId: Int
) : ViewModel() {

    private val _uiState = MutableStateFlow<PlantDetailUiState>(PlantDetailUiState.Loading)
    val uiState: StateFlow<PlantDetailUiState> = _uiState.asStateFlow()

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

                val plant = plantDeferred.await()
                val images = imagesDeferred.await()
                val diagnosis = diagnosisDeferred.await()

                _uiState.value = PlantDetailUiState.Success(plant, diagnosis, images)
            } catch (e: Exception) {
                _uiState.value = PlantDetailUiState.Error(e.message ?: "Failed to load plant details")
            }
        }
    }
}