# Product: LLM Gateway

## Core Problem

This project addresses the challenge of managing and utilizing multiple Large Language Model (LLM) providers in a resilient and cost-effective manner. Relying on a single provider can be risky due to downtime, and expensive if usage exceeds free-tier or paid limits.

## Solution

This project acts as an **intelligent reverse proxy** or **gateway** that sits in front of various LLM provider APIs. It exposes a single, unified API endpoint (`/v1/chat/completions`) that is compatible with the standard OpenAI format. When a request comes in, the gateway intelligently routes it to the most suitable backend provider based on real-time usage, cost, and availability, according to rules in a central configuration file.

The gateway is paired with a comprehensive **web interface** for real-time monitoring, historical usage analytics, and dynamic configuration management.

## Key Features

*   **Intelligent Routing**: Automatically selects the best provider based on model availability and real-time rate-limit tracking. It explicitly prioritizes available zero-cost providers to minimize expenses before falling back to other available options.

*   **Real-Time Monitoring Dashboard**: A Vue.js-based web interface provides a live view of usage statistics for all configured providers and models, including requests, tokens, and cost, updated in real-time.

*   **Dynamic Configuration**: Provider settings, models, and limits can be updated live from the UI without restarting the server. The backend handles atomic updates to the configuration file.

*   **Extensive Provider Support**: Natively supports a wide range of LLM providers through the Vercel AI SDK, including OpenAI, Anthropic, Google, Groq, Mistral, `claude-code`, `gemini-cli`, and any OpenAI-compatible API. The architecture is designed for easy extension.

*   **Usage Persistence & Analytics**: Persists historical usage data to a local JSON database (`lowdb`), enabling analytics and long-term tracking. The UI includes sparkline charts to visualize historical trends.

*   **Dynamic Pricing Data**: Automatically fetches and caches model pricing data from the Helicone API on startup, allowing for accurate, real-time cost calculations without hardcoding prices. The configuration also allows for manual price overrides per model.

*   **Unified API**: Simplifies client-side integration by providing a single, consistent OpenAI-compatible endpoint (`/v1/chat/completions` and `/v1/models`) for all backend providers.

*   **GitHub Copilot Integration**: Includes a `CopilotTokenManager` for fetching and managing GitHub Copilot authentication tokens, enabling seamless integration with Copilot-powered models.

## Key Goals & User Experience

*   **Resilience & Failover**: If a primary LLM provider is unavailable or has reached its rate limit, the gateway should automatically and seamlessly failover to a different provider that supports the requested model.

*   **Cost Optimization**: Help users stay within free-tier or budgeted limits by intelligently distributing requests across multiple providers, with a strong preference for zero-cost options.

*   **Visibility & Control**: Provide clear, real-time visibility into LLM usage and costs through the web dashboard. Allow for centralized, dynamic control over all provider configurations via the UI.

*   **Simplified Integration**: Enable developers to interact with multiple backend LLMs through a single, consistent API endpoint without changing their client-side code.

*   **Extensibility**: The architecture is designed to be modular, allowing new LLM providers supported by the Vercel AI SDK to be added with minimal effort.