# Technology Stack

This document outlines the key technologies, libraries, and tools used in the LLM Gateway project.

## Core Runtime

- **Node.js**: The application is built to run on the Node.js runtime.
- **TypeScript**: The entire codebase is written in TypeScript for type safety and improved developer experience.

## Backend Frameworks & Libraries

- **Express.js**: A minimal and flexible Node.js web application framework used to build the core web server and API endpoints.
- **Vercel AI SDK (`ai` and `@ai-sdk/openai-compatible`)**: Used for building AI-powered applications, specifically for creating OpenAI-compatible provider integrations and handling streaming responses.
- **Rate-Limiter-Flexible**: A library to manage and enforce rate limits for each provider based on requests and token counts.
- **Zod**: A TypeScript-first schema declaration and validation library. It is used to validate the structure and types of the main `config.jsonc` file, ensuring the application starts in a valid state.
- **Pino**: A high-performance, low-overhead logger used for all application logging. It is configured with `pino-pretty` for human-readable logs in development.

## UI Frameworks & Libraries

- **SvelteKit**: A UI framework for building web applications of all sizes, with a beautiful development experience and flexible filesystem-based routing.
- **Vite**: A next-generation frontend tooling that provides an extremely fast development environment and bundles code for production.
- **DaisyUI**: A Tailwind CSS component library that provides a set of pre-styled components. It's used for the main UI components.

## Development & Build Tools

- **pnpm**: The primary package manager for the project. The project is a monorepo with multiple packages (`server`, `ui`).
- **tsx**: A tool for executing TypeScript files directly. The backend development server is run using `pnpm -w -F server run dev`. The UI development server is run with `pnpm -w -F ui run dev`. Both commands work regardless of the current working directory.
- **TypeScript Compiler (`tsc`)**: Used to compile the TypeScript source code into JavaScript for production builds.
- **Prettier**: Used for automated code formatting to maintain a consistent style.
- **Context7**: A service for retrieving up-to-date documentation and code examples for any library. It should be used to get API definitions where possible.

## Configuration

- **JSONC**: The configuration file format is JSON with Comments (`.jsonc`), allowing for comments within the configuration file for better documentation.
- **yargs**: A library for building interactive command-line tools, used here to parse command-line arguments, specifically for the path to the configuration file.
