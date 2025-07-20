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
              <option
                v-for="option in providerTypeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>

          <!-- Provider-specific fields -->
          <div class="provider-fields">
            <!-- API Key field (for most providers) -->
            <div v-if="isApiKeyRequired(provider.type)" class="form-group">
              <label for="apiKey">
                API Key
                <span v-if="isApiKeyRequired(provider.type)" class="required">*</span>
              </label>
              <input
                type="password"
                v-model="provider.apiKey"
                id="apiKey"
                class="form-input"
                :placeholder="getApiKeyPlaceholder(provider.type)"
                :required="isApiKeyRequired(provider.type)"
              />
            </div>

            <!-- Base URL field (for OpenAI-compatible and some others) -->
            <div v-if="requiresBaseUrl(provider.type)" class="form-group">
              <label for="baseURL">
                Base URL
                <span v-if="isBaseUrlRequired(provider.type)" class="required">*</span>
              </label>
              <input
                type="url"
                v-model="provider.baseURL"
                id="baseURL"
                class="form-input"
                :placeholder="getBaseUrlPlaceholder(provider.type)"
                :required="isBaseUrlRequired(provider.type)"
              />
            </div>

            <!-- Azure-specific fields -->
            <div v-if="requiresAzureFields(provider.type)" class="azure-fields">
              <div class="form-group">
                <label for="resourceName">
                  Resource Name
                  <span class="required">*</span>
                </label>
                <input
                  type="text"
                  v-model="provider.resourceName"
                  id="resourceName"
                  class="form-input"
                  placeholder="your-azure-resource"
                  required
                />
              </div>

              <div class="form-group">
                <label for="deploymentName">
                  Deployment Name
                  <span class="required">*</span>
                </label>
                <input
                  type="text"
                  v-model="provider.deploymentName"
                  id="deploymentName"
                  class="form-input"
                  placeholder="your-deployment-name"
                  required
                />
              </div>
            </div>

            <!-- AWS Bedrock-specific fields -->
            <div v-if="requiresBedrockFields(provider.type)" class="bedrock-fields">
              <div class="form-group">
                <label for="accessKeyId">
                  AWS Access Key ID
                  <span class="required">*</span>
                </label>
                <input
                  type="text"
                  v-model="provider.accessKeyId"
                  id="accessKeyId"
                  class="form-input"
                  placeholder="AKIA..."
                  required
                />
              </div>

              <div class="form-group">
                <label for="secretAccessKey">
                  AWS Secret Access Key
                  <span class="required">*</span>
                </label>
                <input
                  type="password"
                  v-model="provider.secretAccessKey"
                  id="secretAccessKey"
                  class="form-input"
                  placeholder="Your AWS secret key"
                  required
                />
              </div>

              <div class="form-group">
                <label for="region">
                  AWS Region
                  <span class="required">*</span>
                </label>
                <input
                  type="text"
                  v-model="provider.region"
                  id="region"
                  class="form-input"
                  placeholder="us-east-1"
                  required
                />
              </div>
            </div>

            <!-- Google Vertex AI-specific fields -->
            <div v-if="requiresVertexFields(provider.type)" class="vertex-fields">
              <div class="form-group">
                <label for="resourceName">
                  Project ID
                  <span class="required">*</span>
                </label>
                <input
                  type="text"
                  v-model="provider.resourceName"
                  id="resourceName"
                  class="form-input"
                  placeholder="your-gcp-project-id"
                  required
                />
              </div>

              <div class="form-group">
                <label for="region">Location (optional)</label>
                <input
                  type="text"
                  v-model="provider.region"
                  id="region"
                  class="form-input"
                  placeholder="us-central1"
                />
              </div>
            </div>

            <!-- Provider-specific help text -->
            <div v-if="getProviderHelpText(provider.type)" class="help-text">
              <small>{{ getProviderHelpText(provider.type) }}</small>
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
                  <small class="field-help">The actual model name used by the provider</small>
                </div>

                <div class="form-group">
                  <label>Mapped Name (optional):</label>
                  <input
                    type="text"
                    v-model="model.mappedName"
                    class="form-input"
                    placeholder="gpt-4"
                  />
                  <small class="field-help">The name clients will use in requests (defaults to model name if not provided)</small>
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
import { ref, onMounted, computed } from 'vue';
import type { AppConfig } from '../../../schemas/appConfig.schema';
import { AppConfigSchema } from '../../../schemas/appConfig.schema';
import type { Provider, ProviderType } from '../../../schemas/provider.schema';
import { ProviderTypeSchema } from '../../../schemas/provider.schema';

const config = ref<AppConfig>({ providers: [] });
const isLoading = ref<boolean>(true);
const error = ref<string | null>(null);

// Save functionality state
const isSaving = ref<boolean>(false);
const saveMessage = ref<string>('');
const saveMessageType = ref<'success' | 'error'>('success');

// Provider type options derived from schema
const providerTypeOptions = computed(() => {
  return ProviderTypeSchema.options.map(type => ({
    value: type,
    label: getProviderDisplayName(type)
  }));
});

// Helper function to get display names for provider types
const getProviderDisplayName = (type: ProviderType): string => {
  const displayNames: Record<ProviderType, string> = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic (Claude)',
    'google': 'Google Generative AI',
    'google-vertex': 'Google Vertex AI',
    'azure': 'Azure OpenAI',
    'bedrock': 'Amazon Bedrock',
    'groq': 'Groq',
    'mistral': 'Mistral AI',
    'deepseek': 'DeepSeek',
    'xai': 'xAI (Grok)',
    'perplexity': 'Perplexity',
    'togetherai': 'Together AI',
    'openrouter': 'OpenRouter',
    'ollama': 'Ollama',
    'qwen': 'Qwen',
    'openai-compatible': 'OpenAI Compatible',
    'claude-code': 'Claude Code (VS Code)',
    'gemini-cli': 'Gemini CLI',
    'custom': 'Custom (Legacy)'
  };
  return displayNames[type] || type;
};

// Helper functions to determine which fields to show for each provider type
const requiresApiKey = (type: ProviderType): boolean => {
  const apiKeyRequired = [
    'openai', 'anthropic', 'google', 'google-vertex', 'azure',
    'groq', 'mistral', 'deepseek', 'xai', 'perplexity', 'togetherai',
    'openrouter', 'qwen'
  ];
  return apiKeyRequired.includes(type);
};

const requiresBaseUrl = (type: ProviderType): boolean => {
  const baseUrlRequired = ['openai-compatible', 'custom'];
  const baseUrlOptional = ['openai', 'ollama'];
  return baseUrlRequired.includes(type) || baseUrlOptional.includes(type);
};

const requiresAzureFields = (type: ProviderType): boolean => {
  return type === 'azure';
};

const requiresBedrockFields = (type: ProviderType): boolean => {
  return type === 'bedrock';
};

const requiresVertexFields = (type: ProviderType): boolean => {
  return type === 'google-vertex';
};

const isBaseUrlRequired = (type: ProviderType): boolean => {
  return ['openai-compatible', 'custom'].includes(type);
};

const isApiKeyRequired = (type: ProviderType): boolean => {
  return requiresApiKey(type) || ['openai-compatible', 'custom'].includes(type);
};

// Helper functions for placeholders and help text
const getApiKeyPlaceholder = (type: ProviderType): string => {
  const placeholders: Partial<Record<ProviderType, string>> = {
    'openai': 'sk-...',
    'anthropic': 'sk-ant-...',
    'google': 'Your Google AI API key',
    'google-vertex': 'Your Google Cloud API key',
    'azure': 'Your Azure OpenAI API key',
    'groq': 'gsk_...',
    'mistral': 'Your Mistral API key',
    'deepseek': 'Your DeepSeek API key',
    'xai': 'Your xAI API key',
    'perplexity': 'pplx-...',
    'togetherai': 'Your Together AI API key',
    'openrouter': 'sk-or-v1-...',
    'qwen': 'Your Qwen API key',
    'openai-compatible': 'Your API key',
    'custom': 'Your API key'
  };
  return placeholders[type] || 'Your API key';
};

const getBaseUrlPlaceholder = (type: ProviderType): string => {
  const placeholders: Partial<Record<ProviderType, string>> = {
    'openai': 'https://api.openai.com/v1',
    'openrouter': 'https://openrouter.ai/api/v1',
    'ollama': 'http://localhost:11434',
    'openai-compatible': 'https://api.example.com/v1',
    'custom': 'https://api.example.com/v1'
  };
  return placeholders[type] || 'https://api.example.com/v1';
};

const getProviderHelpText = (type: ProviderType): string => {
  const helpTexts: Partial<Record<ProviderType, string>> = {
    'gemini-cli': 'Uses OAuth authentication. Run "gemini auth" in your terminal first.',
    'claude-code': 'Uses VS Code authentication. No additional configuration needed.',
    'ollama': 'Make sure Ollama is running locally or provide a custom base URL.',
    'google-vertex': 'Requires Google Cloud authentication and project setup.',
    'azure': 'Requires Azure OpenAI service setup with resource and deployment.',
    'bedrock': 'Requires AWS credentials with Bedrock access permissions.'
  };
  return helpTexts[type] || '';
};

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

.required {
  color: #e74c3c;
  margin-left: 2px;
}

.help-text {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--color-background-soft);
  border-left: 3px solid var(--color-border);
  border-radius: 4px;
}

.help-text small {
  color: var(--color-text-secondary, #666);
  font-size: 12px;
  line-height: 1.4;
}

.field-help {
  color: var(--color-text-secondary, #666);
  font-size: 11px;
  margin-top: 4px;
  display: block;
}

.provider-fields {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.azure-fields,
.bedrock-fields,
.vertex-fields {
  padding: 15px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  margin-top: 10px;
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
