package com.main.plantvita.viewmodel

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.main.plantvita.data.ESP32Service
import com.main.plantvita.data.WiFiNetwork
import kotlinx.coroutines.launch

sealed interface ProvisioningUiState {
    object Idle : ProvisioningUiState
    object Loading : ProvisioningUiState
    data class ScanSuccess(val networks: List<WiFiNetwork>) : ProvisioningUiState
    data class Error(val message: String) : ProvisioningUiState
    object SaveSuccess : ProvisioningUiState
}

class ProvisioningModel(application: Application): AndroidViewModel(application) {
    private val service: ESP32Service = ESP32Service.create()
    private val connectivityManager = application.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    var uiState: ProvisioningUiState by mutableStateOf(ProvisioningUiState.Idle)
        private set

    fun bindToNetwork(){
        uiState = ProvisioningUiState.Loading

        val request = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        networkCallback = object : ConnectivityManager.NetworkCallback(){
            override fun onAvailable(network: Network) {
                super.onAvailable(network)
                try {
                    connectivityManager.bindProcessToNetwork(network)
                    Log.d("Provisioning", "Bound process to WiFi Network: $network")
                    scanNetworks()
                } catch (e: Exception){
                    uiState = ProvisioningUiState.Error("Failed to bind to network: ${e.message}")
                }
            }

            override fun onLost(network: Network) {
                super.onLost(network)
                connectivityManager.bindProcessToNetwork(null)
            }

            override fun onUnavailable() {
                super.onUnavailable()
                uiState = ProvisioningUiState.Error("Please connect to 'Plant-Vita-Setup' WiFi manually.")
            }
        }
        connectivityManager.requestNetwork(request, networkCallback!!, 5000)
    }

    fun sendWiFiCredentials(ssid: String, pass: String) {
        uiState = ProvisioningUiState.Loading

        viewModelScope.launch {
            try {
                service.saveCredentialsToDevice(ssid, pass)
                uiState = ProvisioningUiState.SaveSuccess
                unbindNetwork()
            } catch (e: Exception) {
                uiState = ProvisioningUiState.SaveSuccess
                unbindNetwork()
            }
        }
    }

    fun scanNetworks() {
        uiState = ProvisioningUiState.Loading

        viewModelScope.launch {
            try {
                val networks = service.getNetworksFromDevice()
                val validNetworks = networks.filter { it.ssid.isNotEmpty() }
                uiState = ProvisioningUiState.ScanSuccess(validNetworks)
            } catch (e: Exception) {
                uiState = ProvisioningUiState.Error("Failed to connect to device. Make sure you are connected to the device's WiFi.")
            }
        }
    }

    fun unbindNetwork() {
        try {
            networkCallback?.let { connectivityManager.unregisterNetworkCallback(it) }
            connectivityManager.bindProcessToNetwork(null)
            networkCallback = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun resetState(){
        uiState = ProvisioningUiState.Idle
    }

    override fun onCleared() {
        super.onCleared()
        unbindNetwork()
    }
}