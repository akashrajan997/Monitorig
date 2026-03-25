# WorkPulse Enterprise Agent (v1.0.0)

This agent script monitors active window usage and sends real-time activity logs to your WorkPulse Enterprise dashboard.

## Prerequisites

1.  **Python 3.8+** installed on your device.
2.  **Required Libraries**:
    ```bash
    pip install requests pygetwindow
    ```

## Deployment Instructions

1.  **Download the Agent**: Copy the `agent.py` script to your local machine.
2.  **Configure API URL**: Ensure the `API_BASE_URL` in `agent.py` matches your deployed WorkPulse Enterprise URL:
    `https://ais-dev-dcqtpiorrosbnvxelksfzi-35471052083.asia-east1.run.app`
3.  **Run the Agent**:
    ```bash
    python agent.py
    ```

## Features

-   **Real-time Ingestion**: Sends activity logs to the enterprise ingestion endpoint.
-   **Policy-Driven**: Automatically fetches monitoring intervals and modules from the global policy.
-   **Cross-Platform**: Supports Windows, macOS, and Linux window tracking.
-   **Batch Processing**: Efficiently batches events to minimize network overhead.

## Security

-   **Device Identification**: Uses a unique hardware-based ID for each device.
-   **Encrypted Transport**: All data is sent over HTTPS.
-   **Policy Control**: Behavior is strictly controlled by the central administrative portal.

---
*Note: This agent is for enterprise monitoring. Ensure your organization's privacy policy is communicated to all monitored employees.*
