package com.main.plantvita.screen

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Co2
import androidx.compose.material.icons.filled.DeviceThermostat
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Grass
import androidx.compose.material.icons.filled.Opacity
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.*
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.main.plantvita.data.DiagnosisRead
import com.main.plantvita.data.ImageRead
import com.main.plantvita.data.SensorReadingRead
import com.main.plantvita.viewmodel.PlantDetailUiState
import com.main.plantvita.viewmodel.PlantDetailViewModel
import dev.jeziellago.compose.markdowntext.MarkdownText

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlantDetailScreen(
    viewModel: PlantDetailViewModel,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val isRefreshing = uiState is PlantDetailUiState.Loading // Simplistic check
    val refreshState = rememberPullToRefreshState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Plant Details") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Default.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        PullToRefreshBox(
            state = refreshState,
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.loadData() },
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is PlantDetailUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }

                is PlantDetailUiState.Error -> {
                    Column(
                        modifier = Modifier.align(Alignment.Center),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(state.message, color = MaterialTheme.colorScheme.error)
                        Button(onClick = { viewModel.loadData() }) { Text("Retry") }
                    }
                }

                is PlantDetailUiState.Success -> {
                    DetailContent(state)
                }
            }
        }
    }
}

@Composable
fun DetailContent(state: PlantDetailUiState.Success) {
    val latestHealth = state.diagnosis?.detectedHealth?.lowercase()

    // Only show if diagnosis exists AND is not healthy
    val showDiagnosis = state.diagnosis != null &&
            latestHealth != "healthy" &&
            latestHealth != null

    val healthColor = when (state.diagnosis?.detectedHealth?.lowercase()) {
        "warning", "unhealthy", "infected", "wilting" -> MaterialTheme.colorScheme.errorContainer
        else -> MaterialTheme.colorScheme.secondaryContainer
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        // 1. Featured Image with Overlay
        Box(modifier = Modifier
            .height(300.dp)
            .fillMaxWidth()) {
            AsyncImage(
                model = state.diagnosis?.imageUrl ?: state.recentImages.firstOrNull()?.imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            // Gradient overlay for better text readability
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                Color.Transparent,
                                Color.Black.copy(alpha = 0.6f)
                            )
                        )
                    )
            )

            Text(
                text = state.plant.name,
                style = MaterialTheme.typography.headlineLarge,
                color = Color.White,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(16.dp)
            )
        }

        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {

            // 2. AI Diagnosis Section (Color-coded)
            // AI Diagnosis: Now Expandable and Markdown-compatible
            if (showDiagnosis) {
                AiDiagnosisCard(state.diagnosis, healthColor)
            }

            // Environment: Now with placeholders
            val latestSensor = state.plant.sensorReadings.lastOrNull() //
            SensorSection(latestSensor)

            // Growth History
            if (state.recentImages.isNotEmpty()) {
                SectionHeader("Photo History")
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(bottom = 16.dp)
                ) {
                    items(state.recentImages) { img ->
                        HistoryThumbnail(img)
                    }
                }
            }
        }
    }
}

@Composable
fun SectionHeader(title: String) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.secondary
    )
}

@Composable
fun HistoryThumbnail(img: ImageRead) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        AsyncImage(
            model = img.imageUrl,
            contentDescription = "Plant History Image",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(120.dp)
                .clip(RoundedCornerShape(12.dp)),
            // Useful for debugging why it's not loading:
            onLoading = { println("Loading image: ${img.imageUrl}") },
            onError = { println("Failed to load image: ${it.result.throwable}") }
        )
        Text(
            text = img.timestamp.take(10),
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@Composable
fun AiDiagnosisCard(diagnosis: DiagnosisRead, color: Color) {
    var expanded by remember { mutableStateOf(false) }

    Card(
        colors = CardDefaults.cardColors(containerColor = color),
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize() // Smooth expansion animation
            .clickable { expanded = !expanded }
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.AutoAwesome, contentDescription = "AI", tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "AI Health Assessment",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                // Expand/Collapse Icon
                Icon(
                    imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = null
                )
            }

            // Always show the quick status
            Text(
                text = "Condition: ${diagnosis.detectedHealth ?: "Unknown"}",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold
            )

            // Show full diagnosis only if expanded
            if (expanded) {
                HorizontalDivider(
                    modifier = Modifier.padding(vertical = 12.dp),
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)
                )

                // Renders the Markdown from OpenRouter
                MarkdownText(
                    markdown = diagnosis.aiDiagnosis ?: "_No detailed report generated yet._",
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        }
    }
}

@Composable
fun SensorItem(
    icon: ImageVector,
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    val isMissing = value == "--"

    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = if (isMissing)
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            else
                MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp).fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (isMissing) MaterialTheme.colorScheme.outline else MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = if (isMissing) MaterialTheme.colorScheme.outline else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun SensorSection(sensor: SensorReadingRead?) {
    var expanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .animateContentSize()
            .clickable { expanded = !expanded },
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            SectionHeader("Vitals & Sensors")
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = if (expanded) "Show Less" else "View All",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary
            )
            Icon(
                imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
            )
        }

        // 1. Primary Grid (Always Visible)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            SensorItem(Icons.Default.Opacity, "Soil", sensor?.soilRootPct?.let { "${it.toInt()}%" } ?: "--", Modifier.weight(1f))
            SensorItem(Icons.Default.DeviceThermostat, "Temp", sensor?.tempC?.let { "$it°C" } ?: "--", Modifier.weight(1f))
            SensorItem(Icons.Default.WbSunny, "Light", sensor?.lightLux?.let { "${it.toInt()} lx" } ?: "--", Modifier.weight(1f))
        }

        // 2. Expanded Grid (Hidden by default)
        if (expanded) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SensorItem(Icons.Default.Cloud, "Humidity", sensor?.humidityPct?.let { "${it.toInt()}%" } ?: "--", Modifier.weight(1f))
                    SensorItem(Icons.Default.Air, "Air Quality", sensor?.airQualityPct?.let { "${it.toInt()}%" } ?: "--", Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SensorItem(Icons.Default.Co2, "CO2 (PPM)", sensor?.airPpm?.let { "${it.toInt()}" } ?: "--", Modifier.weight(1f))
                    SensorItem(Icons.Default.Grass, "Surface", sensor?.soilSurfacePct?.let { "${it.toInt()}%" } ?: "--", Modifier.weight(1f))
                    SensorItem(Icons.Default.Thermostat, "Soil Temp", sensor?.soilTempC?.let { "$it°C" } ?: "--", Modifier.weight(1f))
                }
            }
        }
    }
}