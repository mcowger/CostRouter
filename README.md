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