# Product: LLM Gateway

## Core Problem

This project addresses the challenge of managing and utilizing multiple Large Language Model (LLM) providers (like OpenAI, Anthropic, Google, etc.) in a resilient and cost-effective manner. Relying on a single provider can be risky due to downtime, and expensive if usage exceeds free-tier limits.

## Solution

This project acts as an **intelligent reverse proxy** or **gateway** that sits in front of various LLM provider APIs. It exposes a single, unified API endpoint (`/v1/chat/completions`) that is compatible with the standard OpenAI format.

When a request comes in, the gateway intelligently routes it to the most suitable backend provider based on a set of rules defined in a central configuration file.

## Key Goals & User Experience

*   **Resilience & Failover**: If a primary LLM provider is unavailable or has reached its rate limit, the gateway should automatically and seamlessly failover to a different provider that supports the requested model. The end-user or application should not be aware of this switch.
*   **Cost Optimization**: The system is designed to help users stay within the free-tier or lower-cost limits offered by various providers. By monitoring usage for each provider, it can prioritize those that have not yet exceeded their limits.
*   **Simplified Integration**: Developers can interact with multiple backend LLMs through a single, consistent API endpoint, drastically simplifying their application code. They don't need to write separate logic for each provider.
*   **Centralized Control**: All provider details (API keys, models, rate limits) are managed in a single `config.jsonc` file, making it easy to add, remove, or modify provider configurations without changing code.
*   **Extensibility**: The architecture is designed to be modular, allowing new LLM providers to be added with minimal effort.