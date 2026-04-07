package com.main.plantvita.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.LocalFlorist
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import com.main.plantvita.viewmodel.PlantSetupViewModel
import com.main.plantvita.viewmodel.SetupUiState
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SingleChoiceSegmentedButtonRow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlantSetupScreen(
    plantId: Int,
    onNavigateBack: () -> Unit,
    viewModel: PlantSetupViewModel = viewModel()
) {
    val uiState = viewModel.uiState

    // Load plant data on first composition
    LaunchedEffect(plantId) {
        viewModel.loadPlant(plantId)
    }

    // Handle save completion
    LaunchedEffect(uiState) {
        if (uiState is SetupUiState.SaveComplete) {
            onNavigateBack()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Plant Settings") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            when (uiState) {
                is SetupUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is SetupUiState.Error -> {
                    Column(
                        modifier = Modifier.align(Alignment.Center).padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(uiState.message, color = MaterialTheme.colorScheme.error)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(onClick = { viewModel.loadPlant(plantId) }) {
                            Text("Retry")
                        }
                    }
                }
                is SetupUiState.Success, is SetupUiState.SaveComplete -> {
                    PlantSetupForm(viewModel = viewModel, plantId = plantId)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlantSetupForm(viewModel: PlantSetupViewModel, plantId: Int) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // --- Image Header ---
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            if (viewModel.latestImageUrl != null) {
                AsyncImage(
                    model = viewModel.latestImageUrl,
                    contentDescription = "Plant Image",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.LocalFlorist,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("No image available yet", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // --- Core Details ---
        Text("Basic Info", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

        OutlinedTextField(
            value = viewModel.plantName,
            onValueChange = { viewModel.plantName = it },
            label = { Text("Plant Name") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        OutlinedTextField(
            value = viewModel.species,
            onValueChange = { viewModel.species = it },
            label = { Text("Species (Optional)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

        // --- Moisture Thresholds ---
        Text("Soil Moisture Thresholds (%)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(
            text = "Maintain moisture between ${viewModel.moistureRange.start.toInt()}% and ${viewModel.moistureRange.endInclusive.toInt()}%",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        RangeSlider(
            value = viewModel.moistureRange,
            onValueChange = { viewModel.moistureRange = it },
            valueRange = 0f..100f,
            steps = 100,
            modifier = Modifier.fillMaxWidth()
        )

        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

        // --- Toggles & Advanced ---
        Text("Device Behavior", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Environment")
            SingleChoiceSegmentedButtonRow {
                SegmentedButton(
                    selected = viewModel.isIndoor,
                    onClick = { viewModel.isIndoor = true },
                    shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2)
                ) { Text("Indoor") }
                SegmentedButton(
                    selected = !viewModel.isIndoor,
                    onClick = { viewModel.isIndoor = false },
                    shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2)
                ) { Text("Outdoor") }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Watering Mode")
            SingleChoiceSegmentedButtonRow {
                SegmentedButton(
                    selected = viewModel.wateringMode == "manual",
                    onClick = { viewModel.wateringMode = "manual" },
                    shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2)
                ) { Text("Manual") }
                SegmentedButton(
                    selected = viewModel.wateringMode == "auto",
                    onClick = { viewModel.wateringMode = "auto" },
                    shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2)
                ) { Text("Auto") }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Enable Notifications")
            Switch(
                checked = viewModel.notificationsEnabled,
                onCheckedChange = { viewModel.notificationsEnabled = it }
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = { viewModel.savePlant(plantId) },
            modifier = Modifier.fillMaxWidth().height(50.dp)
        ) {
            Text("Save Changes")
        }

        Spacer(modifier = Modifier.height(32.dp)) // Bottom padding
    }
}