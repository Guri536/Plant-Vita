# **Plant-Vita Mobile Application**

## **Component Overview**

The Plant-Vita Mobile Application functions as the dedicated interface for hardware provisioning and persistent monitoring on the Android platform. While sharing visualization capabilities with the web dashboard, this application leverages native system integrations to handle the initial configuration of physical nodes and provide proactive, system-level alerts regarding plant health.

## **Functional Description**

The mobile client incorporates specific features essential for the hardware lifecycle and continuous observation:

* **Device Provisioning:** The application serves as the configuration tool for new hardware nodes. It utilizes Bluetooth Low Energy (BLE) to scan for broadcasting ESP32 devices, establishes a temporary local connection, and securely transmits local Wi-Fi credentials to the microcontroller to enable internet connectivity.  
* **Background Surveillance:** Independent of user interaction, the application maintains a background service that periodically synchronizes with the backend infrastructure. This ensures that the device checks for status updates even when the application is closed.  
* **Smart Notifications:** By leveraging local system notifications, the application alerts the user immediately if the background service receives a "Critical" health status report, ensuring prompt attention to environmental anomalies.  
* **Mobile Dashboard:** Provides a touch-optimized interface for viewing real-time sensor telemetry, historical graphs, and AI-generated visual diagnostic logs.

## **Architectural Design**

The application architecture is built around modern Android development standards, prioritizing efficient resource usage and reliable background execution.

* **Native Interface:** The user interface is constructed using a declarative UI toolkit, ensuring a responsive and cohesive visual experience consistent with the platform's design guidelines.  
* **System Integration Managers:**  
  * **Bluetooth Manager:** Orchestrates the complex state machine required for BLE scanning, connecting, and writing characteristics during the setup phase.  
  * **WorkManager:** Manages the scheduling of periodic background tasks (e.g., every 15 minutes). This component ensures reliable execution of API status checks while respecting system battery optimization protocols.

## **Technology Stack**

The mobile application is developed using the following technologies:

* **Language:** Kotlin  
* **UI Framework:** Jetpack Compose  
* **Asynchronous Processing:** Kotlin Coroutines  
* **Background Scheduling:** Android WorkManager  
* **Connectivity:** Android Bluetooth Low Energy (BLE) API
