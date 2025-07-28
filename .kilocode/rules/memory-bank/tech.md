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
    *   `ai-sdk-provider-claude-code`
    *   `ai-sdk-provider-gemini-cli`
    *   And many others (DeepSeek, X-AI, Perplexity, etc.)
*   **Rate-Limiter-Flexible**: A library to manage and enforce rate limits for each provider based on requests and token counts.
*   **Zod**: A TypeScript-first schema declaration and validation library. It is used to validate the structure and types of the main `config.jsonc` file.
*   **Pino**: A high-performance, low-overhead logger used for all application logging, configured with `pino-pretty` for development.
*   **lowdb**: A lightweight JSON database used for persisting historical usage data and application configuration.
*   **yargs**: A library for building interactive command-line tools, used here to parse command-line arguments.

## Frontend (Vue.js)

*   **Vue 3**: A progressive JavaScript framework for building the user interface, using the Composition API.
*   **Vite**: A modern frontend build tool that provides a faster and leaner development experience for modern web projects.
*   **Pinia**: The official state management library for Vue.js.
*   **Vue Router**: The official router for Vue.js.
*   **Axios**: A promise-based HTTP client for the browser and Node.js, used for making API requests from the UI.
*   **date-fns**: A modern JavaScript date utility library.
*   **vue-sparklines**: A component for generating simple, lightweight sparkline charts.

## Development & Build Tools

*   **npm**: The primary package manager for the project. `pnpm` should not be used.
*   **npx**: The standard way to execute locally installed npm package binaries. Tools like `prettier`, `tsc`, `tsx`, and `vue-tsc` should be invoked with `npx` (e.g., `npx prettier --write .`).
*   **tsx**: A tool for executing TypeScript files directly (`npx tsx`), used for hot-reloading the development server via `nodemon`.
*   **Nodemon**: Monitors for any changes in your source and automatically restarts your server.
*   **Concurrently**: A tool to run multiple commands concurrently (`npx concurrently ...`).
*   **TypeScript Compiler (`tsc`)**: Used to compile the TypeScript source code into JavaScript for production builds (`npx tsc`).
*   **Jest**: A JavaScript testing framework for unit and integration tests.
*   **Supertest**: A library for testing Node.js HTTP servers.
*   **Prettier**: Used for automated code formatting to maintain a consistent style (`npx prettier --write .`).