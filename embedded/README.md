# **Plant-Vita Embedded Firmware**

## **Component Overview**

This directory contains the source code and firmware configuration for the hardware nodes within the Plant-Vita ecosystem. The embedded system acts as the physical interface for the Smart Gardener, responsible for direct environmental sensing, image capture, and autonomous actuation. It operates on a robust microcontroller architecture designed to maintain optimal plant conditions through local closed-loop control while simultaneously synchronizing telemetry data with the central backend infrastructure.

## **Functional Description**

The firmware is engineered to perform four primary operations cyclically:

* **Data Acquisition:** The system continuously polls a suite of analog and digital sensors to gather precise environmental metrics. This includes measuring soil volumetric water content at varying depths (surface and root level), ambient temperature, relative humidity, atmospheric pressure, and photosynthetically active radiation (light intensity).  
* **Autonomous Control:** Independent of server connectivity, the local logic executes a hysteresis-based control algorithm. It monitors soil moisture levels against pre-configured thresholds. If conditions indicate dehydration, the system automatically engages the submersible water pump mechanism until the target saturation point is reached, ensuring consistent hydration.  
* **Telemetry Transmission:** Aggregated sensor data is serialized and transmitted to the backend server via secure MQTT or HTTP protocols. This ensures that the remote dashboard reflects the real-time status of the plant environment.  
* **Visual Sampling:** The integrated camera module is triggered at scheduled intervals to capture high-resolution images of the plant. These images are uploaded to the cloud storage infrastructure for subsequent growth analysis and disease diagnosis.

## **Hardware Architecture**

The physical layer is constructed around a central processing unit that interfaces with various peripheral modules:

* **Primary Controller:** An ESP32 microcontroller serves as the main processing core, handling sensor fusion, network communication, and actuator logic.  
* **Visual Module:** An ESP32-CAM module is utilized specifically for image capture operations.  
* **Sensor Array:**  
  * Capacitive Soil Moisture Sensors (Dual-channel for depth profiling)  
  * Digital Environmental Sensor (Temperature, Humidity, Pressure)  
  * Photometric Sensor (Ambient Light/Lux)  
* **Actuation System:** A relay-controlled submersible water pump responsible for irrigation.

## **Firmware Logic**

The software is structured around a non-blocking loop architecture. Upon initialization, the system performs a self-diagnostic routine and attempts to establish a Wi-Fi connection using stored credentials. During normal operation, the firmware manages distinct tasks for sensor polling, network keep-alive, and actuator state management. The provisioning mode allows for initial configuration via Bluetooth Low Energy (BLE), permitting secure transfer of network credentials to the device.

## **Technology Stack**

The embedded software is developed using the following technologies:

* **Language:** C++  
* **Framework:** Arduino Framework for ESP32  
* **Communication Protocols:** MQTT, HTTP/HTTPS, BLE (Bluetooth Low Energy)  
* **Data Serialization:** JSON
