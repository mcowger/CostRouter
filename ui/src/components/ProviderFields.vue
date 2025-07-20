<template>
  <div class="provider-fields">
    <!-- API Key field (for most providers) -->
    <div v-if="isApiKeyRequired(provider.type)" class="form-group">
      <label for="apiKey">
        API Key
        <span v-if="isApiKeyRequired(provider.type)" class="required">*</span>
      </label>
      <input 
        type="password" 
        :value="provider.apiKey || ''"
        @input="updateProvider('apiKey', $event.target.value)"
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
        :value="provider.baseURL || ''"
        @input="updateProvider('baseURL', $event.target.value)"
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
          :value="provider.resourceName || ''"
          @input="updateProvider('resourceName', $event.target.value)"
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
          :value="provider.deploymentName || ''"
          @input="updateProvider('deploymentName', $event.target.value)"
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
          :value="provider.accessKeyId || ''"
          @input="updateProvider('accessKeyId', $event.target.value)"
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
          :value="provider.secretAccessKey || ''"
          @input="updateProvider('secretAccessKey', $event.target.value)"
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
          :value="provider.region || ''"
          @input="updateProvider('region', $event.target.value)"
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
          :value="provider.resourceName || ''"
          @input="updateProvider('resourceName', $event.target.value)"
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
          :value="provider.region || ''"
          @input="updateProvider('region', $event.target.value)"
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
</template>

<script setup lang="ts">
import type { Provider, ProviderType } from '../../../schemas/provider.schema';

interface Props {
  provider: Provider;
}

interface Emits {
  (e: 'update', provider: Provider): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const updateProvider = (field: keyof Provider, value: string): void => {
  const updatedProvider = { ...props.provider };
  if (value === '') {
    delete updatedProvider[field];
  } else {
    updatedProvider[field] = value as any;
  }
  emit('update', updatedProvider);
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
</script>

<style scoped>
.provider-fields {
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

.form-input {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 14px;
  background: var(--color-background);
  color: var(--color-text);
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
</style>
