# Product: LLM Gateway

## Core Problem

This project addresses the challenge of managing and utilizing multiple Large Language Model (LLM) providers in a resilient and cost-effective manner. Relying on a single provider can be risky due to downtime, and expensive if usage exceeds free-tier or paid limits.

## Solution

This project acts as an **intelligent reverse proxy** or **gateway** that sits in front of various LLM provider APIs. It exposes a single, unified API endpoint (`/v1/chat/completions`) that is compatible with the standard OpenAI format.

When a request comes in, the gateway intelligently routes it to the most suitable backend provider based on real-time usage, cost, and availability, according to rules in a central configuration file.

## Key Features

*   **Intelligent Routing**: Automatically selects the best provider based on model availability and real-time rate-limit tracking. Prioritizes free-tier or low-cost providers to minimize expenses.
*   **Real-Time Monitoring Dashboard**: A Vue.js-based web interface provides a live view of usage statistics, including requests, tokens, and cost per provider, with historical data visualization.
*   **Dynamic Configuration**: Provider settings, models, and limits can be updated live from the UI without restarting the server.
*   **Extensive Provider Support**: Natively supports a wide range of LLM providers through the Vercel AI SDK, including OpenAI, Anthropic, Google, Groq, Mistral, and any OpenAI-compatible API.
*   **Usage Persistence**: Persists historical usage data to a local JSON database (`lowdb`), enabling analytics and long-term tracking.
*   **Unified API**: Simplifies client-side integration by providing a single, consistent OpenAI-compatible endpoint for all backend providers.

## Key Goals & User Experience

*   **Resilience & Failover**: If a primary LLM provider is unavailable or has reached its rate limit, the gateway should automatically and seamlessly failover to a different provider.
*   **Cost Optimization**: Help users stay within free-tier or budgeted limits by intelligently distributing requests across multiple providers.
*   **Visibility & Control**: Provide clear, real-time visibility into LLM usage and costs through the web dashboard, and allow for centralized control over all provider configurations.
*   **Simplified Integration**: Enable developers to interact with multiple backend LLMs through a single, consistent API endpoint.
*   **Extensibility**: The architecture is designed to be modular, allowing new LLM providers to be added with minimal effort.