# LLM Gateway

An intelligent reverse proxy for routing requests to multiple Large Language Model (LLM) providers with real-time monitoring and cost optimization.

## Features

*   **Intelligent Routing**: Automatically selects providers based on model availability and rate-limit tracking.
*   **Real-time Monitoring**: A Vue.js dashboard provides a live view of usage statistics, including requests, tokens, and cost per provider.
*   **Dynamic Configuration**: Update provider settings, models, and limits from the UI without restarting the server.
*   **Extensive Provider Support**: Natively supports a wide range of LLM providers through the Vercel AI SDK.
*   **Unified API**: A single, consistent OpenAI-compatible endpoint for all backend providers.

## Getting Started (Development)

### Prerequisites

*   Node.js 22+
*   npm (comes with Node.js)

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/mcowger/CostRouter.git
    cd CostRouter
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create and configure your settings:**
    *   Create a `config` directory: `mkdir config`
    *   **Optional**: Copy the example configuration: `cp config.test.jsonc config/config.jsonc`.  If you dont create a config, you'll just start up with an empty config that you can edit via the UI.
    *   **Optional** Edit `config/config.jsonc` and add your provider API keys and settings.  

4.  **Run the application:**
    ```bash
    npm run dev
    ```
    This command starts both the backend server (on port 3000) and the frontend UI (on port 5173) concurrently.

5.  **Access the Dashboard:**
    Open [http://localhost:5173](http://localhost:5173) in your browser.

## Running with Docker

1.  **Build the Docker image:**
    ```bash
    docker build -t llm-gateway .
    ```



3.  **Run the Docker container:**
    ```bash
    docker run --rm -p 3000:3000 -v $(pwd)/my-config:/config --name llm-gateway-container llm-gateway
    ```
    *   The gateway will be accessible on `http://localhost:3000`.
    *   The UI is served from the same port at the `/` route.
    *   Configuration and the usage database are mounted from your host machine.  Again, if you dont have an existing config file, an empty one will be made for you.

## Basic Usage

Send requests to the gateway's OpenAI-compatible endpoint:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer any-string-is-valid" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Architecture

The gateway uses a pipeline pattern with singleton managers for core services:
*   **`ConfigManager`**: Loads and validates configuration.
*   **`UsageManager`**: Tracks and enforces rate limits in real-time.
*   **`Router`**: Selects the optimal provider for each incoming request.
*   **`UnifiedExecutor`**: Executes the request against the chosen provider using the Vercel AI SDK.
*   **`UsageDatabaseManager`**: Persists usage data for historical analysis.

## Technology Stack

*   **Backend**: Node.js, Express, TypeScript, Vercel AI SDK, Zod, Pino, rate-limiter-flexible
*   **Frontend**: Vue 3, Vite, Pinia, Vue Router
*   **Build Tools**: npm, tsx, Docker