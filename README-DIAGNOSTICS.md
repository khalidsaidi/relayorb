# RelayOrb Diagnostic & Testing Tools

These scripts are located in your project root to help you monitor and test the system.

## 1. Trade Monitoring
*   **`node check-positions.cjs`**: Lists all open paper positions.
*   **`node check-history.cjs`**: Shows recent Buy/Sell history.
*   **`node test-automation.cjs`**: Simulates the server-side auto-close logic.

## 2. Market & Bots
*   **`node check-prices.cjs`**: Displays current market prices in Firestore.
*   **`node list-all-bots.cjs`**: Lists your configured bot IDs.

## 3. System Testing
*   **`node place-test-trade.cjs`**: Places a test trade to verify the automation loop.
