# Architecture

## High-Level Overview

The LLM Gateway is a Node.js application built with Express.js that functions as an intelligent reverse proxy for multiple Large Language Model (LLM) providers. It uses a pipeline pattern, processing incoming API requests through a series of middleware components, each with a distinct responsibility.

The core design revolves around a set of singleton manager classes that are initialized at startup and provide shared services throughout the application.

```mermaid
graph TD
    subgraph Express Server
        A[Incoming Request: POST /v1/chat/completions] --> B{Router Middleware};
        B --> C{UnifiedExecutor Middleware};
        C --> D[Response to Client];
    end

    subgraph Core Components (Singletons)
        E[ConfigManager] --> F[UsageManager];
        E --> G[UsageDatabaseManager];
        E --> H[PriceData];
        F --> B;
        F --> C;
        H --> C;
    end
    
    subgraph Unified AI SDK Executor
      C -- "Delegates to..." --> I{ai-sdk Instances};
      I -- "Handles all providers" --> J[OpenAI, Anthropic, Google, claude-code, gemini-cli, etc.];
    end

    A -- "req.body.model" --> B;
    B -- "Adds chosenProvider & chosenModel to res.locals" --> C;
    C -- "Uses chosenProvider to call correct SDK instance" --> I;
    I -- "Makes API call" --> J;
    J -- "API Response" --> C;
    C -- "Streams response back" --> D;
    
    style "Core Components (Singletons)" fill:#f9f,stroke:#333,stroke-width:2px
    style "Unified AI SDK Executor" fill:#ccf,stroke:#333,stroke-width:2px
```

## Core Components

The system is composed of several key singleton classes found in `server/components/`:

*   **`ConfigManager.ts`**:
    *   **Responsibility**: The source of truth for all configuration. It loads, validates (using Zod schemas), and holds the application configuration from a JSONC file specified via a command-line argument. It also handles dynamic updates to the configuration at runtime.
    *   **Key Operations**: Parses and validates the config on startup, provides static methods to access the config, and handles atomic writes for updates.

*   **`UsageManager.ts`**:
    *   **Responsibility**: Manages and tracks usage for all configured providers to enforce rate limits in real-time.
    *   **Key Library**: `rate-limiter-flexible`.
    *   **Key Operations**: Initializes a map of `RateLimiterMemory` instances, exposes `isUnderLimit()` for pre-flight checks, and `consume()` to record usage after a request.

*   **`UsageDatabaseManager.ts`**:
    *   **Responsibility**: Persists historical usage data to a local JSON file for long-term analytics and dashboard visualization.
    *   **Key Library**: `lowdb`.
    *   **Key Operations**: Initializes the database, provides `recordUsage()` to save data, and `getUsage()` to query historical records.

*   **`PriceData.ts`**:
    *   **Responsibility**: Manages pricing information for all models, providing a centralized way to calculate the cost of a request. It uses a combination of hardcoded values and provider-specific pricing from the configuration.

*   **`Router.ts`**:
    *   **Responsibility**: To select the most appropriate provider for an incoming request using a tiered, cost-based strategy. It acts as Express middleware.
    *   **Key Operations**: Finds candidate providers for the requested model, checks their rate limits with `UsageManager.isUnderLimit()`, and selects the best option. The selection process first prioritizes any available zero-cost providers. If none are available, it selects the lowest-cost paid provider based on input and output token prices. Finally, it attaches the selected `Provider` and `Model` objects to `res.locals`.

*   **`UnifiedExecutor.ts`**:
    *   **Responsibility**: To execute the API request against the provider chosen by the `Router`, using the Vercel AI SDK. It acts as Express middleware.
    *   **Key Operations**: Retrieves the chosen provider, gets or creates a cached AI SDK instance for that provider type, calls the AI SDK to make the API call, and streams the response back to the client. It is responsible for calling `UsageManager.consume()` after the request is complete.

## Request Lifecycle (The Pipeline)

1.  **Startup**: When `server/index.ts` is run, the `main` function initializes the singletons in the correct order: `ConfigManager`, `PriceData`, `UsageManager`, `UsageDatabaseManager`, and `Router`.
2.  **Request Reception**: The Express server receives a `POST` request on `/v1/chat/completions`.
3.  **Routing (`Router.chooseProvider`)**:
    *   The `Router` middleware identifies candidate providers for the requested model.
    *   It filters out any providers that are over their rate limits by checking with the `UsageManager`.
    *   It implements a tiered selection strategy:
        *   **Tier 1 (Zero-Cost)**: It first checks for any available providers that have a configured cost of zero. If found, one is selected randomly from this group.
        *   **Tier 2 (Lowest Cost)**: If no zero-cost providers are available, it sorts the remaining (paid) providers by their input token cost, then by their output token cost, and selects the cheapest one.
    *   The chosen provider and model are attached to the response object (`res.locals`) for the next step in the pipeline.
4.  **Execution (`UnifiedExecutor.execute`)**:
    *   The `UnifiedExecutor` middleware takes the selected provider.
    *   It uses a factory pattern to get the correct Vercel AI SDK instance for the provider's `type` (e.g., `createOpenAI`, `createAnthropic`).
    *   It uses the `ai-sdk` (`streamText` or `generateText`) to make the final API call.
    *   It streams the response back to the original client in the standard OpenAI format.
5.  **Usage Tracking**: After the stream is complete, the `UnifiedExecutor` calculates the cost and calls `UsageManager.consume()` to update the rate limit counters and `UsageDatabaseManager.recordUsage()` to persist the data.

## Source Code Paths

*   **Main Entry Point**: [`server/index.ts`](server/index.ts)
*   **Core Components**: [`server/components/`](server/components/)
*   **Configuration Schemas (Zod)**: [`schemas/`](schemas/)
*   **UI Source**: [`ui/src/`](ui/src/)