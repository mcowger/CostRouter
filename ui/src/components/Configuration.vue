<template>
  <div class="configuration">
    <h2>Provider Configuration</h2>

    <!-- Save Button Section -->
    <div v-if="!isLoading && !error" class="save-section">
      <button
        @click="saveConfiguration"
        :disabled="isSaving"
        class="save-button"
      >
        {{ isSaving ? 'Saving...' : 'Save Configuration' }}
      </button>

      <!-- Success/Error Messages -->
      <div v-if="saveMessage" class="save-message" :class="saveMessageType">
        {{ saveMessage }}
      </div>
    </div>

    <div v-if="isLoading" class="loading">
      Loading configuration...
    </div>

    <div v-else-if="error" class="error">
      Error: {{ error }}
    </div>

    <div v-else class="config-grid">
      <div 
        v-for="(provider, index) in config.providers" 
        :key="provider.id || index" 
        class="provider-card"
      >
        <h3 class="provider-title">Provider Configuration</h3>
        
        <div class="form-section">
          <div class="form-group">
            <label for="id">ID:</label>
            <input
              type="text"
              v-model="provider.id"
              id="id"
              class="form-input"
              placeholder="provider-id"
            />
          </div>
          
          <div class="form-group">
            <label for="type">Type:</label>
            <select v-model="provider.type" id="type" class="form-input">
              <option value="openai">OpenAI</option>
              <option value="custom">Custom</option>
              <option value="copilot">Copilot</option>
            </select>
          </div>
          
          <!-- OpenAI-specific fields -->
          <div v-if="provider.type === 'openai'" class="openai-fields">
            <div class="form-group">
              <label for="baseURL">Base URL:</label>
              <input 
                type="text" 
                v-model="provider.baseURL" 
                id="baseURL" 
                class="form-input"
                placeholder="https://api.openai.com/v1"
              />
            </div>
            
            <div class="form-group">
              <label for="apiKey">API Key:</label>
              <input 
                type="password" 
                v-model="provider.apiKey" 
                id="apiKey" 
                class="form-input"
                placeholder="sk-..."
              />
            </div>
          </div>
          

          
          <!-- Models Accordion -->
          <details v-if="provider.models && provider.models.length" class="accordion">
            <summary class="accordion-header">Models</summary>
            <div class="accordion-content">
              <div 
                v-for="(model, modelIndex) in provider.models" 
                :key="modelIndex" 
                class="model-item"
              >
                <div class="form-group">
                  <label>Model Name:</label>
                  <input 
                    type="text" 
                    v-model="model.name" 
                    class="form-input"
                    placeholder="gpt-4"
                  />
                </div>
                
                <!-- Model Pricing -->
                <div v-if="model.pricing" class="pricing-section">
                  <h5>Pricing</h5>
                  <div
                    v-for="(value, key) in model.pricing"
                    :key="key"
                    class="form-group"
                  >
                    <label>{{ formatPricingKey(key) }}:</label>
                    <input
                      type="number"
                      v-model="model.pricing[key]"
                      class="form-input"
                      step="0.0001"
                      min="0"
                    />
                  </div>
                </div>

                <!-- Model Rate Limits -->
                <div v-if="model.limits" class="limits-section">
                  <h5>Rate Limits</h5>
                  <div
                    v-for="(value, key) in model.limits"
                    :key="key"
                    class="form-group"
                  >
                    <label>{{ formatLimitKey(key) }}:</label>
                    <input
                      type="number"
                      v-model="model.limits[key]"
                      class="form-input"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { AppConfig } from '../../../schemas/appConfig.schema';
import { AppConfigSchema } from '../../../schemas/appConfig.schema';
import type { Provider } from '../../../schemas/provider.schema';

const config = ref<AppConfig>({ providers: [] });
const isLoading = ref<boolean>(true);
const error = ref<string | null>(null);

// Save functionality state
const isSaving = ref<boolean>(false);
const saveMessage = ref<string>('');
const saveMessageType = ref<'success' | 'error'>('success');

onMounted(async () => {
  try {
    // Fetch configuration from server
    const response = await fetch('http://localhost:3000/config/get');
    if (!response.ok) {
      throw new Error('Failed to load configuration.');
    }
    config.value = await response.json();

    // Fallback mock data for development (if server is not available)
    // await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
    // config.value = {
    //   providers: [
    //     {
    //       id: "openroutera",
    //       type: "openai",
    //       baseURL: "https://openrouter.ai/api/v1",
    //       apiKey: "sk-or-v1-",
    //       limits: {
    //         requestsPerMinute: 2,
    //         requestsPerHour: 10,
    //         requestsPerDay: 100,
    //         tokensPerMinute: 1000,
    //         tokensPerHour: 5000,
    //         tokensPerDay: 10000,
    //         costPerDay: 1.00
    //       },
    //       models: [
    //         {
    //           name: "moonshotai/kimi-k2:free",
    //           pricing: {
    //             inputCostPerMillionTokens: 5.0,
    //             outputCostPerMillionTokens: 15.0,
    //             costPerRequest: 0.0001
    //           }
    //         }
    //       ]
    //     },
    //     {
    //       id: "openrouterb",
    //       type: "openai",
    //       baseURL: "https://openrouter.ai/api/v1",
    //       apiKey: "sk-or-v1-",
    //       limits: {
    //         requestsPerMinute: 2,
    //         requestsPerHour: 10,
    //         requestsPerDay: 100,
    //         tokensPerMinute: 1000,
    //         tokensPerHour: 5000,
    //         tokensPerDay: 10000,
    //         costPerDay: 1.00
    //       },
    //       models: [
    //         {
    //           name: "moonshotai/kimi-k2:free",
    //           pricing: {
    //             inputCostPerMillionTokens: 5.0,
    //             outputCostPerMillionTokens: 15.0,
    //             costPerRequest: 0.0001
    //           }
    //         }
    //       ]
    //     },
    //     {
    //       id: "copilot-provider",
    //       type: "copilot",
    //       models: [
    //         { name: "gpt-4" },
    //         { name: "gpt-4.1" },
    //         { name: "gpt-4o" }
    //       ]
    //     }
    //   ]
    // };
  } catch (e: any) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
});

const formatLimitKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/per/gi, 'Per');
};

const formatPricingKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/cost/gi, 'Cost')
    .replace(/per/gi, 'Per');
};

// Save configuration function
const saveConfiguration = async (): Promise<void> => {
  // Clear previous messages
  saveMessage.value = '';
  isSaving.value = true;

  try {
    // Validate the configuration against the schema
    const validatedConfig = AppConfigSchema.parse(config.value);

    // Send POST request to /config/set endpoint
    const response = await fetch('http://localhost:3000/config/set', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedConfig),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const result = await response.json();
    saveMessage.value = result.message || 'Configuration saved successfully!';
    saveMessageType.value = 'success';

    // Clear success message after 3 seconds
    setTimeout(() => {
      saveMessage.value = '';
    }, 3000);

  } catch (validationError: any) {
    // Handle validation errors
    if (validationError.name === 'ZodError') {
      const errorMessages = validationError.errors.map((err: any) =>
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      saveMessage.value = `Validation error: ${errorMessages}`;
    } else {
      saveMessage.value = validationError.message || 'Failed to save configuration';
    }
    saveMessageType.value = 'error';
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.configuration {
  padding: 20px;
  width: 100%;
}

.configuration h2 {
  text-align: center;
  margin-bottom: 30px;
  color: var(--color-heading);
}

.save-section {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.save-button {
  background: #3498db;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 180px;
}

.save-button:hover:not(:disabled) {
  background: #2980b9;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
}

.save-button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.save-message {
  margin-top: 15px;
  padding: 10px 15px;
  border-radius: 4px;
  font-weight: 500;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.save-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.save-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.loading, .error {
  text-align: center;
  padding: 20px;
  font-size: 16px;
}

.error {
  color: #e74c3c;
  background-color: #fdf2f2;
  border: 1px solid #f5c6cb;
  border-radius: 5px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.provider-card {
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.provider-title {
  margin: 0 0 20px 0;
  color: var(--color-heading);
  font-size: 18px;
  font-weight: 600;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-weight: 500;
  color: var(--color-text);
  font-size: 14px;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  background: var(--color-background);
  color: var(--color-text);
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.readonly-field {
  padding: 8px 12px;
  background: var(--color-background-mute);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-heading);
  font-family: monospace;
}

.openai-fields {
  background: var(--color-background);
  padding: 15px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.accordion {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
}

.accordion-header {
  background: var(--color-background);
  padding: 12px 15px;
  cursor: pointer;
  font-weight: 600;
  color: var(--color-heading);
  border-bottom: 1px solid var(--color-border);
}

.accordion-header:hover {
  background: var(--color-background-soft);
}

.accordion-content {
  padding: 15px;
  background: var(--color-background-soft);
}

.model-item {
  padding: 15px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  margin-bottom: 10px;
}

.model-item:last-child {
  margin-bottom: 0;
}

.pricing-section {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--color-border);
}

.pricing-section h5 {
  margin: 0 0 10px 0;
  color: var(--color-heading);
  font-size: 14px;
  font-weight: 600;
}

.limits-section {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--color-border);
}

.limits-section h5 {
  margin: 0 0 10px 0;
  color: var(--color-heading);
  font-size: 14px;
  font-weight: 600;
}

/* Responsive design */
@media (max-width: 768px) {
  .config-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .provider-card {
    padding: 15px;
  }
}
</style>
