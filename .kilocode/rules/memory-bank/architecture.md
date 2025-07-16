# Architecture

## High-Level Overview

The LLM Gateway consists of two main parts: a Node.js backend built with Express.js that functions as an intelligent reverse proxy, and a SvelteKit frontend for management and monitoring.

The backend uses a pipeline pattern, processing incoming API requests through a series of middleware components, each with a distinct responsibility.

The core design revolves around a set of singleton manager classes that are initialized at startup and provide shared services throughout the application.

```mermaid
graph TD
    subgraph User Interaction
        J[UI (SvelteKit)]
    end

    subgraph Express Server (Backend)
        A[Incoming Request: POST /v1/chat/completions] --> B{Router Middleware};
        B --> C{Executor Middleware};
        C --> D[Response to Client];
    end

    subgraph Core Components (Singletons)
        E[ConfigManager] --> B;
        E --> F[UsageManager];
        F --> B;
        F --> G[All Executors];
    end

    subgraph Executors
        C --> G;
        G --> H[CopilotExecutor];
        G --> I[OpenAIExecutor];
    end

    J --> A;
    A -- "req.body.model" --> B;
    B -- "Adds chosenProvider to res.locals" --> C;
    C -- "Uses chosenProvider" --> G;
    G -- "Makes API call" --> D;

    style J fill:#cfc,stroke:#333,stroke-width:2px
    style "Express Server (Backend)" fill:#eef,stroke:#333,stroke-width:2px
    style "Core Components (Singletons)" fill:#f9f,stroke:#333,stroke-width:2px
    style Executors fill:#ccf,stroke:#333,stroke-width:2px
```

## Core Components

The system is composed of several key components across the backend and frontend.

### UI (SvelteKit)

The frontend is a SvelteKit application located in the `ui/` directory.

- **Responsibility**: Provides a web interface for users to monitor usage, manage provider configurations, and view the status of the gateway.
- **Interaction**: It communicates with the backend Express server via API calls to fetch data and send configuration updates.

### Backend Core Components

The backend is composed of several key singleton classes found in `server/components/`:

- **`ConfigManager.ts`**:
    - **Responsibility**: The source of truth for all configuration. It loads, validates (using Zod schemas), and holds the application configuration from a JSONC file specified via a command-line argument.
    - **Key Operations**:
        - Parses the config file on startup.
        - Validates the configuration against `AppConfigSchema`.
        - Provides static methods (`getInstance`, `getProviders`) to access the validated config.

- **`UsageManager.ts`**:
    - **Responsibility**: Manages and tracks usage for all configured providers to enforce rate limits.
    - **Key Library**: `rate-limiter-flexible`.
    - **Key Operations**:
        - Initializes a map of `RateLimiterMemory` instances based on the limits defined in `ConfigManager`.
        - Exposes `isUnderLimit(providerId)` to check if a provider can handle a request.
        - Exposes `consume(providerId, usage)` to record the resources used by a request.

- **`Router.ts`**:
    - **Responsibility**: To select the most appropriate provider for an incoming request. It acts as Express middleware.
    - **Key Operations**:
        - `chooseProvider(req, res, next)`: The main middleware function.
        - Finds all candidate providers that support the requested model (`req.body.model`).
        - Iterates through candidates, using `UsageManager.isUnderLimit()` to find the first one with available capacity.
        - Attaches the selected `Provider` object to `res.locals.chosenProvider` and passes control to the next middleware.

- **`Executor.ts`**:
    - **Responsibility**: To execute the API request against the provider chosen by the `Router`. It also acts as Express middleware.
    - **Key Operations**:
        - `execute(req, res)`: The main middleware function.
        - Retrieves the chosen provider from `res.locals.chosenProvider`.
        - Delegates the actual API call to a provider-specific executor (e.g., `OpenAIExecutor`, `CopilotExecutor`) based on the provider's `type`.
        - The specific executor is responsible for calling `UsageManager.consume()` after the request is complete.

## Request Lifecycle (The Pipeline)

1.  **Startup**: When `server/index.ts` is run, the `main` function initializes the singletons in the correct order: `ConfigManager`, then `UsageManager`, then `Router`.
2.  **Request Reception**: The Express server receives a `POST` request on `/v1/chat/completions`, potentially originating from the UI or another client application.
3.  **Routing (`Router.chooseProvider`)**:
    - The `Router` middleware identifies candidate providers for the requested model.
    - It checks each candidate's rate limits via the `UsageManager`.
    - The first available provider is selected and attached to the response object (`res.locals`).
4.  **Execution (`Executor.execute`)**:
    - The `Executor` middleware takes the selected provider.
    - It invokes the corresponding specific executor (e.g., `OpenAIExecutor`).
    - The specific executor uses the `ai-sdk` to make the final API call.
    - It streams the response back to the original client.
5.  **Usage Tracking**: After the stream is complete, the specific executor calls `usageManager.consume()` to update the rate limit counters for the provider that was used.

## Source Code Paths

- **Backend Entry Point**: [`server/index.ts`](server/index.ts)
- **Backend Core Components**: [`server/components/`](server/components/)
- **Specific Executors**: [`server/components/executors/`](server/components/executors/)
- **Configuration Schemas (Zod)**: [`server/schemas/`](server/schemas/)
- **Frontend Application**: [`ui/`](ui/)
