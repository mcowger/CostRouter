# Technology Stack

This document outlines the key technologies, libraries, and tools used in the LLM Gateway project.

## Core Runtime

*   **Node.js**: The application is built to run on the Node.js runtime.
*   **TypeScript**: The entire codebase is written in TypeScript for type safety and improved developer experience.

## Frameworks & Libraries

*   **Express.js**: A minimal and flexible Node.js web application framework used to build the core web server and API endpoints.
*   **Vercel AI SDK (`ai` and `@ai-sdk/openai-compatible`)**: Used for building AI-powered applications, specifically for creating OpenAI-compatible provider integrations and handling streaming responses.
*   **Rate-Limiter-Flexible**: A library to manage and enforce rate limits for each provider based on requests and token counts.
*   **Zod**: A TypeScript-first schema declaration and validation library. It is used to validate the structure and types of the main `config.jsonc` file, ensuring the application starts in a valid state.
*   **Pino**: A high-performance, low-overhead logger used for all application logging. It is configured with `pino-pretty` for human-readable logs in development.

## Development & Build Tools

*   **pnpm**: The primary package manager for the project.
*   **tsx**: A tool for executing TypeScript files directly. The development server is run using `pnpm -w -F server run dev`, which uses `tsx` for hot-reloading.
*   **TypeScript Compiler (`tsc`)**: Used to compile the TypeScript source code into JavaScript for production builds.
*   **Prettier**: Used for automated code formatting to maintain a consistent style.

## Configuration

*   **JSONC**: The configuration file format is JSON with Comments (`.jsonc`), allowing for comments within the configuration file for better documentation.
*   **yargs**: A library for building interactive command-line tools, used here to parse command-line arguments, specifically for the path to the configuration file.