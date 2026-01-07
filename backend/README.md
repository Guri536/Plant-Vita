# **Plant-Vita Backend Service**

## **Component Overview**

The Plant-Vita Backend Service functions as the central orchestration layer for the Smart Gardener ecosystem. It acts as the bridge between the distributed IoT hardware nodes and the client-facing applications. This service is responsible for secure data ingestion, persistent storage, business logic execution, and the integration of third-party artificial intelligence services for plant health diagnosis.

## **Core Responsibilities**

The backend architecture is designed to handle high-frequency telemetry data while providing responsive API endpoints for user interaction. Its primary functions include:

* **API Gateway:** Hosting a RESTful interface that facilitates user authentication, plant profile management, and retrieval of historical environmental data.  
* **Telemetry Aggregation:** Serving as the ingestion point for sensor data transmitted by ESP32 microcontrollers. This includes parsing incoming payloads containing soil moisture, temperature, humidity, and light intensity metrics.  
* **Data Persistence:** Managing the relational database schema to store time-series sensor readings, user credentials, and device configuration states.  
* **AI Orchestration:** Managing the pipeline for image analysis. This involves receiving image references, interacting with the Gemini API for biological assessment, and storing the resulting diagnostic reports.  
* **Asset Management:** Coordinating with cloud object storage services to securely archive high-resolution plant imagery captured by the hardware nodes.

## **Data Architecture**

The system utilizes a relational database structure optimized for both transactional integrity and time-series analysis. The data model is segregated into the following logical domains:

* **Identity Management:** Handles user accounts and secure authentication credentials.  
* **Device Registry:** Maintains unique identifiers (MAC addresses) and configuration profiles for each registered plant unit, including species-specific moisture thresholds.  
* **Environmental Logs:** Stores high-volume chronological data points for soil and atmospheric conditions, indexed for efficient querying and visualization.  
* **Visual History:** Records metadata for captured images, including timestamps, storage URLs, and computed health metrics such as green pixel density and AI-generated diagnoses.

## **Technology Stack**

The backend service is built upon the following technologies:

* **Runtime Environment:** Python  
* **Web Framework:** FastAPI  
* **Database:** PostgreSQL  
* **Object Relational Mapper (ORM):** SQLModel  
* **Cloud Storage:** Google Cloud Storage (Integration)  
* **Artificial Intelligence:** Google Gemini API
