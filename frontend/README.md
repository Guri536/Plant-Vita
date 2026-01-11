# **Plant-Vita Frontend Application**

## **Component Overview**

The Plant-Vita Frontend acts as the primary user interface for the Smart Gardener system. It is a responsive web-based dashboard designed to translate complex telemetry data into actionable visual insights. Built with React.js, this application facilitates real-time environmental monitoring, plant profile management, and remote system administration, allowing users to interact seamlessly with their connected hardware.

## **Functional Description**

The application provides a comprehensive suite of features for managing plant health:

* **Real-Time Dashboard:** Displays live telemetry streams from the hardware nodes. Users can monitor critical metrics such as soil moisture, temperature, and light intensity through dynamic visualizations.  
* **Data Visualization:** Incorporates charting libraries to render historical trends, enabling users to analyze environmental patterns over time.  
* **Plant Profile Management:** Allows users to register new plants, configure specific moisture thresholds (min/max), and manage device associations via MAC address.  
* **Visual Health Log:** Provides an interface to view the history of images captured by the device, complete with AI-generated diagnostic reports and growth metrics.  
* **System Status:** Indicators for connection health and critical alerts ensure users are immediately aware of any hardware or network anomalies.

## **Architectural Design**

The frontend architecture prioritizes data freshness and responsive interaction through a robust state management strategy.

* **Server State Management:** The application utilizes TanStack Query to manage asynchronous data. This layer handles data fetching, caching, synchronization, and server state updates, decoupling the UI from direct API implementation details.  
* **Optimized Polling:** To ensure real-time accuracy without manual refreshing, the system implements an automated polling mechanism. It periodically fetches recent sensor data (e.g., every 5 seconds) to update live graphs and status indicators.  
* **Intelligent Caching:** Plant profiles and static configurations are cached to minimize network overhead and provide instant navigation transitions between different views of the application.

## **Technology Stack**

The frontend application is developed using the following technologies:

* **Core Framework:** React.js  
* **State Management:** TanStack Query (React Query)  
* **Data Visualization:** Charting/Graphing Libraries (e.g., Recharts or similar)  
* **API Integration:** RESTful HTTP Client
