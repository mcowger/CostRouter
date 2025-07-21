# Technology Stack

This document outlines the key technologies, libraries, and tools used in the LLM Gateway project.

## Backend (Node.js/TypeScript)

*   **Node.js**: The application is built to run on the Node.js runtime.
*   **TypeScript**: The entire codebase is written in TypeScript for type safety and improved developer experience.
*   **Express.js**: A minimal and flexible Node.js web application framework used to build the core web server and API endpoints.
*   **Vercel AI SDK**: The core SDK for building AI-powered applications. We use a wide range of provider-specific packages, including:
    *   `ai` (Core SDK)
    *   `@ai-sdk/openai` and `@ai-sdk/openai-compatible`
    *   `@ai-sdk/anthropic`
    *   `@ai-sdk/google` and `@ai-sdk/google-vertex`
    *   `@ai-sdk/groq`
    *   `@ai-sdk/mistral`
    *   And many others (DeepSeek, X-AI, Perplexity, etc.)
*   **Rate-Limiter-Flexible**: A library to manage and enforce rate limits for each provider based on requests and token counts.
*   **Zod**: A TypeScript-first schema declaration and validation library. It is used to validate the structure and types of the main `config.jsonc` file.
*   **Pino**: A high-performance, low-overhead logger used for all application logging, configured with `pino-pretty` for development.
*   **lowdb**: A lightweight JSON database used for persisting historical usage data.

## Frontend (Vue.js)

*   **Vue 3**: A progressive JavaScript framework for building the user interface, using the Composition API.
*   **Vite**: A modern frontend build tool that provides a faster and leaner development experience for modern web projects.
*   **Pinia**: The official state management library for Vue.js.
*   **Vue Router**: The official router for Vue.js.
*   **vue-sparklines**: A component for generating simple, lightweight sparkline charts.

## Development & Build Tools

*   **pnpm**: The primary package manager for the project.
*   **tsx**: A tool for executing TypeScript files directly, used for hot-reloading the development server.
*   **TypeScript Compiler (`tsc`)**: Used to compile the TypeScript source code into JavaScript for production builds.
*   **Prettier**: Used for automated code formatting to maintain a consistent style.
*   **Jest**: A JavaScript testing framework used for unit and integration tests.
*   **Supertest**: A library for testing Node.js HTTP servers.

## Configuration

*   **JSONC**: The configuration file format is JSON with Comments (`.jsonc`), allowing for better documentation within the config file.
*   **yargs**: A library for building interactive command-line tools, used here to parse command-line arguments.