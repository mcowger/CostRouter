# Tasks

This document outlines common, repetitive tasks to ensure consistency and speed up development.

---

## Add a New AI Provider

This task documents the steps required to add support for a new LLM provider to the gateway.

**Last performed:** 2025-07-20

### Files to Modify

*   **`schemas/provider.schema.ts`**: Add the new provider `type` to the Zod schema to allow it in the configuration.
*   **`server/components/UnifiedExecutor.ts`**: Register the new provider's factory function.

### Step-by-Step Workflow

1.  **Update the Provider Schema**:
    *   Open [`schemas/provider.schema.ts`](schemas/provider.schema.ts).
    *   Find the `ProviderTypeSchema` enum.
    *   Add the new provider's identifier to the list (e.g., `"new-provider"`). This ensures that the configuration validation will accept the new type.

2.  **Register the Provider in the Executor**:
    *   Open [`server/components/UnifiedExecutor.ts`](server/components/UnifiedExecutor.ts).
    *   Import the provider's factory function from the Vercel AI SDK (e.g., `import { createNewProvider } from "@ai-sdk/new-provider";`).
    *   Add a new entry to the `PROVIDER_FACTORIES` map.

### Example Implementation

Here is an example of adding a fictitious "NexusAI" provider:

**1. In `schemas/provider.schema.ts`:**

```typescript
// schemas/provider.schema.ts

// ... other imports
export const ProviderTypeSchema = z.enum([
    "openai",
    "anthropic",
    "google",
    "google-vertex",
    "claude-code",
    "gemini-cli",
    // ... other providers
    "nexusai", // Add the new provider type here
]);
```

**2. In `server/components/UnifiedExecutor.ts`:**

```typescript
// server/components/UnifiedExecutor.ts

// ... other imports
import { createNexusAI } from "@ai-sdk/nexusai"; // 1. Import the factory

// ...
export class UnifiedExecutor {
  // ...
  private static readonly PROVIDER_FACTORIES = new Map<string, (config: Provider) => any>([
    // ... other provider entries
    
    // 2. Add the new provider to the map
    ["nexusai", (config) => createNexusAI({
      apiKey: config.apiKey,
    })],
  ]);
  // ...
}
```

### Important Notes

*   Ensure the AI SDK you are adding is already listed as a dependency in `package.json`. If not, add it using `npx npm add @ai-sdk/new-provider-name`.
*   Verify if the new provider requires any unique configuration properties (like `resourceName` for Google Vertex) and update the `ProviderSchema` accordingly if necessary.
*   After adding the provider, update the `config.jsonc` file with a new provider entry to test the integration.