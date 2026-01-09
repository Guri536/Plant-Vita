package com.main.plantvita.screen

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.main.plantvita.data.WiFiNetwork
import com.main.plantvita.viewmodel.ProvisioningModel
import com.main.plantvita.viewmodel.ProvisioningUiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddDeviceScreen(
    onComplete: () -> Unit,
    viewModel: ProvisioningModel = viewModel()
) {
    val uiState = viewModel.uiState
    var showPassDialog by remember { mutableStateOf<WiFiNetwork?>(null) }


    if (showPassDialog != null) {
        WiFiPassDialog(
            network = showPassDialog!!,
            onDismiss = { showPassDialog = null },
            onConfirm = { ssid, pass ->
                showPassDialog = null
                viewModel.sendWiFiCredentials(ssid, pass)
            }
        )
    }

    LaunchedEffect(Unit) {
        if (uiState is ProvisioningUiState.Idle) {
            viewModel.bindToNetwork()
        }
    }

    LaunchedEffect(uiState) {
        if (uiState is ProvisioningUiState.SaveSuccess) {
            kotlinx.coroutines.delay(5000)
            onComplete()
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Setup New Device") },
            navigationIcon = {
                IconButton(onClick = onComplete) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = null
                    )
                }
            }) }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
        ) {
            Text(
                "Instructions:",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            InstructionStep("1. Power on your Plant Vita device.")
            InstructionStep("2. Check the Green LED. It should be blinking slowly.")
            InstructionStep("3. Connect your phone's WiFi to 'Plant-Vita-Setup'.")
            Spacer(modifier = Modifier.height(16.dp))

            when (uiState) {
                is ProvisioningUiState.Idle, is ProvisioningUiState.Error -> {
                    if (uiState is ProvisioningUiState.Error) {
                        Text(uiState.message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                    Button(
                        onClick = { viewModel.scanNetworks() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Search for Device")
                    }
                }

                is ProvisioningUiState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Spacer(Modifier.height(150.dp))
                        CircularProgressIndicator()
                    }
                }

                is ProvisioningUiState.SaveSuccess -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(
                            "WiFi Credentials saved. The Plant-Vita device will now restart.",
                            style = MaterialTheme.typography.bodyLarge
                        )
                    }
                }

                is ProvisioningUiState.ScanSuccess -> {
                    Text("Select a WiFi network:", style = MaterialTheme.typography.titleSmall)
                    LazyColumn(modifier = Modifier.weight(1f)) {
                        items(uiState.networks) { network ->
                            WifiListItem(network, onClick = { showPassDialog = network })
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun WifiListItem(network: WiFiNetwork, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(network.ssid) },
        supportingContent = { Text("Signal: ${network.rssi} dBm") },
        leadingContent = {
            Icon(Icons.Default.Wifi, contentDescription = null)
        },
        modifier = Modifier.clickable { onClick() }
    )
    HorizontalDivider()
}

@Composable
fun InstructionStep(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier.padding(bottom = 4.dp)
    )
}

@Composable
fun WiFiPassDialog(
    network: WiFiNetwork,
    onDismiss: () -> Unit,
    onConfirm: (String, String) -> Unit
) {
    var pass by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Connect to ${network.ssid}") },
        text = {
            OutlinedTextField(
                value = pass,
                onValueChange = { pass = it },
                label = { Text("Password") },
                singleLine = true
            )
        },
        confirmButton = {
            Button(onClick = { onConfirm(network.ssid, pass) }) {
                Text("Connect")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}