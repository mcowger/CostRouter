<template>
  <div class="configuration">
    <h2>Provider Configuration</h2>
    
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
            <label>ID:</label>
            <span class="readonly-field">{{ provider.id }}</span>
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
          
          <!-- Limits Accordion -->
          <details v-if="provider.limits" class="accordion">
            <summary class="accordion-header">Rate Limits</summary>
            <div class="accordion-content">
              <div 
                v-for="(value, key) in provider.limits" 
                :key="key" 
                class="form-group"
              >
                <label :for="key">{{ formatLimitKey(key) }}:</label>
                <input 
                  type="number" 
                  v-model="provider.limits[key]" 
                  :id="key" 
                  class="form-input"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
          </details>
          
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
import type { Provider } from '../../../schemas/provider.schema';

const config = ref<AppConfig>({ providers: [] });
const isLoading = ref<boolean>(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    // TODO: Uncomment this section to fetch from server
    // const response = await fetch('/config/get');
    // if (!response.ok) {
    //   throw new Error('Failed to load configuration.');
    // }
    // config.value = await response.json();

    // Mock data for development (remove when server is ready)
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
    config.value = {
      providers: [
        {
          id: "openroutera",
          type: "openai",
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: "sk-or-v1-",
          limits: {
            requestsPerMinute: 2,
            requestsPerHour: 10,
            requestsPerDay: 100,
            tokensPerMinute: 1000,
            tokensPerHour: 5000,
            tokensPerDay: 10000,
            costPerDay: 1.00
          },
          models: [
            {
              name: "moonshotai/kimi-k2:free",
              pricing: {
                inputCostPerMillionTokens: 5.0,
                outputCostPerMillionTokens: 15.0,
                costPerRequest: 0.0001
              }
            }
          ]
        },
        {
          id: "openrouterb",
          type: "openai",
          baseURL: "https://openrouter.ai/api/v1",
          apiKey: "sk-or-v1-",
          limits: {
            requestsPerMinute: 2,
            requestsPerHour: 10,
            requestsPerDay: 100,
            tokensPerMinute: 1000,
            tokensPerHour: 5000,
            tokensPerDay: 10000,
            costPerDay: 1.00
          },
          models: [
            {
              name: "moonshotai/kimi-k2:free",
              pricing: {
                inputCostPerMillionTokens: 5.0,
                outputCostPerMillionTokens: 15.0,
                costPerRequest: 0.0001
              }
            }
          ]
        },
        {
          id: "copilot-provider",
          type: "copilot",
          models: [
            { name: "gpt-4" },
            { name: "gpt-4.1" },
            { name: "gpt-4o" }
          ]
        }
      ]
    };
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
  background: #f8f9fa;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
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
