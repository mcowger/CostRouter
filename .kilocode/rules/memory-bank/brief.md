### System Persona

Your primary goal is to help build an intelligent LLM Gateway. Adherence to the following architectural patterns and coding standards is mandatory.

### 1. Guiding Principles

* **Modularity and Separation of Concerns:** Every piece of code must have a single, clear responsibility. We follow the Pipeline pattern.
* **Configuration-Driven Logic:** Avoid hard-coding values. All logic should be driven by the central `ConfigManager`.
* **Type-Safety is Non-Negotiable:** All code must be strongly typed. Any data entering the system from an external source (API requests, files) **must** be validated at runtime.
* **Leverage Best-in-Class Libraries:** Do not write code for functionality that is well-solved by established libraries. Use `Express` for the web server, `ai-sdk` for OpenAI compatibility, and `rate-limiter-flexible` for all dynamic usage tracking and enforcement.

### 2. Component Design & Implementation

* **`ConfigManager.ts`:** A singleton class responsible for loading the config from a database, validating it with Zod, holding it in memory, and providing a safe way to update and save it.
  * It includes primarily a list of Provider objects.
  * In the future it should be extensible to other options.
  * On startup, read the specified database from the command line arguments. The location of the configuration database should be a required argument to the application. If it is not provided, the application should exit.
  * Immediately after reading, parse the raw JSON content to ensure it aligns to the definition of an AppConfig. If validation fails, the application should fail to start, preventing it from running in an invalid state.
  * Hold the validated `AppConfig` object in a private property, making it available to the rest of the application via type-safe getter methods.
  * The AppConfig object should be a list of Provider objects to start with.
  * Do not create methods to save configurations.
* **`Limits.ts`:** A type representing limits that should be respected when selecting providers.  The following should be included, all as optional:
  * Requests per Minute
  * Requests per Hour
  * Requests per Day
  * Tokens per Minute
  * Tokens per Hour
  * Tokens per Day
* **`Pricing.ts`:** A type representing the cost of a request to a Provider.   It should include the following, all as optional values:
  * Input Token Cost
  * Output Token Cost
  * Message Cost
* **`Provider.ts`:** A type representing a single Provider configuration. This should be a fairly thin wrapper around @ai-sdk/openai-compatible, but includes additional details:
  * a unique identifier for the system.  Use something short - no more than 8 characters.
  * the baseURL to use
  * the API key to use
  * an instance of the Limits defined above.
  * an instance of Pricing as defined above.
* **`UsageManager.ts`:** An singleton orchestrator class for rate limiting. It uses `rate-limiter-flexible` and is configured based on the rules provided by the `ConfigManager`. It exposes `consume()` and `isUnderLimit()` methods.  It is not express middleware.
* **`Router.ts`:** A stateless class that takes a request object and returns a single Provider object representing the best choice for executing the request made.  It should use UsageManager.isUnderLimit() to determine the first candidate Provider to be used that has available capacity.  It adds that Provider to the req object as `res.locals.chosenProvider`.  The Router class follows the express middleware contract.
* **`Executor`:** A stateless class that accepts the request object and a Provider, and executes the API request, returning the result back to the caller.  It uses the req.selectedProvider value to construct the appropriate request with createOpenAICompatible from @ai-sdk/openai-compatible and calling generateText().  When complete, it calls the appropriate consume() function to record the usage of the request.

### 3. High Level Flow & Core Architectural Pattern: The Intelligent Gateway Pipeline

The system must be implemented as a request-processing pipeline. For an incoming API request (`/v1/chat/completions`), the logical flow within the Express route handler using middleware is as follows:

* The incoming request is handed to the Candidate class, which will identify candidates for the request
* The request then moves to Router, which selects the final provider
* The request then moves to Executor, which executes the request and returns the result.

### 4. Technology Stack & Mandatory Usage Rules

* **Web Framework:** **`Express.js`**
* **AI SDK:** **`ai-sdk/openai-compatible`** and **`ai-sdk`**
* **Database:** **`lowdb`** for all configuration and usage data.
* **Usage Tracking & Enforcement:** **`rate-limiter-flexible`**
* **Validation:** **`zod`**

### 5. Code Style

* Do not write tests or documentation unless requested.  
* Use `async/await` and `try/catch` for I/O and rate-limiting logic.
* Organize files into logical directories (`src/server`, `src/schemas`, `src/ui`).
* Follow standard TypeScript and ESLint best practices.
