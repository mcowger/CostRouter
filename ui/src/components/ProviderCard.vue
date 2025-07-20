<template>
  <div class="provider-card">
    <div class="provider-header">
      <h3 class="provider-title">Provider Configuration</h3>
      <button 
        @click="$emit('remove')" 
        class="remove-button"
        title="Remove Provider"
      >
        <span class="button-icon">×</span>
      </button>
    </div>
    
    <div class="form-section">
      <div class="form-group">
        <label for="id">ID:</label>
        <input
          type="text"
          :value="provider.id"
          @input="updateProvider('id', $event.target.value)"
          id="id"
          class="form-input"
          placeholder="provider-id"
        />
      </div>
      
      <div class="form-group">
        <label for="type">Type:</label>
        <select 
          :value="provider.type" 
          @change="updateProvider('type', $event.target.value)"
          id="type" 
          class="form-input"
        >
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
      <ProviderFields
        :provider="provider"
        @update="updateProvider"
      />

      <!-- Models Section Accordion -->
      <details class="accordion">
        <summary class="accordion-header">
          <span>Models ({{ provider.models.length }})</span>
          <div class="header-actions">
            <button
              @click.stop="addModel"
              class="add-button secondary small"
              title="Add Model"
            >
              <span class="button-icon">+</span>
              Add Model
            </button>
            <span class="accordion-icon">▼</span>
          </div>
        </summary>
        <div class="accordion-content">
          <div v-if="provider.models && provider.models.length" class="models-list">
            <ModelCard
              v-for="(model, modelIndex) in provider.models"
              :key="modelIndex"
              :model="model"
              :model-index="modelIndex"
              @update="updateModel(modelIndex, $event)"
              @remove="removeModel(modelIndex)"
            />
          </div>
          <div v-else class="no-models">
            <p>No models configured. Click "Add Model" to get started.</p>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Provider, ProviderType } from '../../../schemas/provider.schema';
import type { Model } from '../../../schemas/model.schema';
import { ProviderTypeSchema } from '../../../schemas/provider.schema';
import ProviderFields from './ProviderFields.vue';
import ModelCard from './ModelCard.vue';

interface Props {
  provider: Provider;
}

interface Emits {
  (e: 'update', provider: Provider): void;
  (e: 'remove'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

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

const updateProvider = (field: keyof Provider | Provider, value?: string): void => {
  if (typeof field === 'object') {
    // If field is actually a provider object (from ProviderFields)
    emit('update', field);
  } else {
    // If field is a string key
    const updatedProvider = { ...props.provider };
    if (value === '') {
      delete updatedProvider[field];
    } else {
      updatedProvider[field] = value as any;
    }
    emit('update', updatedProvider);
  }
};

const addModel = (): void => {
  const newModel: Model = { name: '' };
  const updatedProvider = { 
    ...props.provider, 
    models: [...props.provider.models, newModel] 
  };
  emit('update', updatedProvider);
};

const removeModel = (modelIndex: number): void => {
  if (confirm('Are you sure you want to remove this model? This action cannot be undone.')) {
    const updatedProvider = { 
      ...props.provider, 
      models: props.provider.models.filter((_, index) => index !== modelIndex)
    };
    emit('update', updatedProvider);
  }
};

const updateModel = (modelIndex: number, model: Model): void => {
  const updatedModels = [...props.provider.models];
  updatedModels[modelIndex] = model;
  const updatedProvider = { ...props.provider, models: updatedModels };
  emit('update', updatedProvider);
};
</script>

<style scoped>
.provider-card {
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.provider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.provider-title {
  margin: 0;
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

.models-section {
  margin-top: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-header h4 {
  margin: 0;
  color: var(--color-heading);
}

.models-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.no-models {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-secondary, #666);
  font-style: italic;
}

.add-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-button.secondary {
  background: var(--color-background-soft);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.add-button.secondary:hover {
  background: var(--color-border);
}

.add-button.small {
  padding: 6px 12px;
  font-size: 12px;
}

.remove-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: #e74c3c;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
  line-height: 1;
}

.remove-button:hover {
  background: #c0392b;
}

.button-icon {
  font-weight: bold;
  line-height: 1;
}

.accordion {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  margin-top: 20px;
  overflow: hidden;
}

.accordion-header {
  background: var(--color-background-soft);
  padding: 12px 15px;
  cursor: pointer;
  font-weight: 500;
  color: var(--color-heading);
  transition: background-color 0.2s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
  list-style: none;
}

.accordion-header::-webkit-details-marker {
  display: none;
}

.accordion-header:hover {
  background: var(--color-border);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.accordion-icon {
  transition: transform 0.2s ease;
  font-size: 12px;
}

.accordion[open] .accordion-icon {
  transform: rotate(180deg);
}

.accordion-content {
  padding: 15px;
  background: var(--color-background);
  border-top: 1px solid var(--color-border);
}
</style>
