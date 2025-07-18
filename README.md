# LLM Gateway

An intelligent gateway for routing requests to Large Language Model (LLM) providers.

## Description

This project provides a reverse proxy server that sits in front of one or more LLM provider APIs (like OpenAI, Anthropic, etc.). It offers a single API endpoint for chat completions and intelligently routes incoming requests to the most suitable backend provider based on model availability and configured rate limits.

The primary goal is to provide a resilient and cost-effective way to interact with LLMs by staying within free-tier limits offered by various providers wherever possible.

## Core Features

*   **Unified API Endpoint**: Provides a single `/v1/chat/completions` endpoint, compatible with the OpenAI API standard.
*   **Intelligent Routing**: Selects the best provider for a given model based on real-time availability and usage limits.
*   **Rate Limiting**: Monitors usage for each provider to avoid exceeding rate limits.
*   **Failover**: Automatically routes requests to an alternative provider if the primary one is at its limit.
*   **Configuration-driven**: All providers, models, and limits are defined in a central configuration file.
*   **Extensible**: Designed to be easily extended with new provider integrations.

## Getting Started

### Prerequisites

*   Node.js (version specified in `.nvmrc`)
*   pnpm

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd llm-gateway
    ```

2.  Install dependencies:
    ```bash
    pnpm install
    ```

### Configuration

1.  Create a `config.jsonc` file in the root directory. You can use the `config.example.jsonc` as a template.
2.  Define your LLM providers, their API keys, the models they support, and any rate limits you want to enforce.

### Running the Server

*   **Development mode (with hot-reloading):**
    ```bash
    pnpm dev
    ```

*   **Production mode:**
    First, build the TypeScript source:
    ```bash
    pnpm build
    ```
    Then, start the server:
    ```bash
    pnpm start
    ```

The server will start on port 3000 by default.

## Usage Dashboard

The LLM Gateway includes a real-time usage dashboard that provides visibility into rate limit consumption across all configured providers.

### Accessing the Dashboard

1. Start both the server and UI:
   ```bash
   # Terminal 1: Start the server
   cd server && npm run dev

   # Terminal 2: Start the UI
   cd ui && npm run dev
   ```

2. Open your browser and navigate to `http://localhost:5173/`

3. Click on the "Usage Dashboard" tab to view real-time usage metrics

### Dashboard Features

- **Real-time Updates**: Automatically refreshes every second
- **Provider Cards**: Shows one card per configured provider
- **Usage Metrics**: Displays current consumption vs. limits for:
  - Requests per minute/hour/day
  - Tokens per minute/hour/day
  - Cost per minute/hour/day (in USD)
- **Visual Indicators**: Color-coded progress bars (green/yellow/red)
- **Reset Timers**: Shows when limits will reset
- **Responsive Design**: Works on desktop and mobile devices

### Testing the Dashboard

To test the dashboard with simulated usage data, you can use the simulation endpoint:

```bash
# Simulate usage for a provider
curl -X POST http://localhost:3000/usage/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "openroutera",
    "tokens": 500,
    "cost": 0.05
  }'

# Simulate usage for another provider
curl -X POST http://localhost:3000/usage/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "openrouterb",
    "tokens": 200,
    "cost": 0.02
  }'
```

**Parameters:**
- `providerId` (string): The ID of the provider to simulate usage for (must match a configured provider)
- `tokens` (number, optional): Number of tokens to consume (default: 100)
- `cost` (number, optional): Cost in USD to consume (default: 0.01)

The simulated usage will immediately appear in the dashboard, allowing you to see how the real-time monitoring works.

### API Endpoints

- `GET /usage/current` - Returns current usage data for all providers
- `POST /usage/simulate` - Simulates usage for testing (development only)

## Dependencies

### Production Dependencies

*   [`@ai-sdk/openai-compatible`](https://npmjs.com/package/@ai-sdk/openai-compatible): For OpenAI-compatible provider integrations.
*   [`ai`](https://npmjs.com/package/ai): Vercel AI SDK for building AI-powered applications.
*   [`express`](https://npmjs.com/package/express): Web application framework for Node.js.
*   [`jsonc-parser`](https://npmjs.com/package/jsonc-parser): A robust parser for JSON with comments.
*   [`lodash`](https://npmjs.com/package/lodash): A modern JavaScript utility library delivering modularity, performance & extras.
*   [`pino`](https://npmjs.com/package/pino): A very low-overhead logger for Node.js.
*   [`pino-pretty`](https://npmjs.com/package/pino-pretty): A pretty-printer for pino logs.
*   [`rate-limiter-flexible`](https://npmjs.com/package/rate-limiter-flexible): A flexible rate limiter for Node.js applications.
*   [`yargs`](https://npmjs.com/package/yargs): A library for building interactive command-line tools.
*   [`zod`](https://npmjs.com/package/zod): TypeScript-first schema validation with static type inference.

### Development Dependencies

*   `@types/express`
*   `@types/lodash`
*   `@types/node`
*   `@types/yargs`
*   `axios`
*   `prettier`
*   `tsx`
*   `typescript`