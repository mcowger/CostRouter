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

    <div v-else class="config-container">
      <!-- Add Provider Button -->
      <div class="add-provider-section">
        <button @click="addProvider" class="add-button primary">
          <span class="button-icon">+</span>
          Add Provider
        </button>
      </div>

      <div class="config-grid">
        <ProviderCard
          v-for="(provider, index) in config.providers"
          :key="index"
          :provider="provider"
          @update="updateProvider(index, $event)"
          @remove="removeProvider(index)"
        />
      </div>

      <!-- Message when no providers exist -->
      <div v-if="!config.providers.length" class="no-providers">
        <p>No providers configured. Click "Add Provider" to get started.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { AppConfig } from '../../../schemas/appConfig.schema';
import { AppConfigSchema } from '../../../schemas/appConfig.schema';
import type { Provider } from '../../../schemas/provider.schema';
import ProviderCard from './ProviderCard.vue';

const config = ref<AppConfig>({ providers: [] });
const isLoading = ref<boolean>(true);
const error = ref<string | null>(null);

// Save functionality state
const isSaving = ref<boolean>(false);
const saveMessage = ref<string>('');
const saveMessageType = ref<'success' | 'error'>('success');

// Factory function for creating default providers
const createDefaultProvider = (): Provider => {
  return {
    id: '',
    type: 'openai',
    models: []
  };
};

// CRUD functions for managing configuration elements
const addProvider = (): void => {
  const newProvider = createDefaultProvider();
  // Generate a unique ID
  const existingIds = config.value.providers.map(p => p.id);
  let counter = 1;
  let newId = `provider-${counter}`;
  while (existingIds.includes(newId)) {
    counter++;
    newId = `provider-${counter}`;
  }
  newProvider.id = newId;
  
  config.value.providers.push(newProvider);
};

const removeProvider = (index: number): void => {
  if (confirm('Are you sure you want to remove this provider? This action cannot be undone.')) {
    config.value.providers.splice(index, 1);
  }
};

const updateProvider = (index: number, provider: Provider): void => {
  // Ensure reactivity by replacing the array
  config.value.providers = [
    ...config.value.providers.slice(0, index),
    provider,
    ...config.value.providers.slice(index + 1)
  ];
};

onMounted(async () => {
  try {
    // Fetch configuration from server
    const response = await fetch('http://localhost:3000/config/get');
    if (!response.ok) {
      throw new Error('Failed to load configuration.');
    }
    config.value = await response.json();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
});

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
  max-width: 1200px;
  margin: 0 auto;
}

.configuration h2 {
  color: var(--color-heading);
  margin-bottom: 20px;
  font-size: 24px;
  font-weight: 600;
}

.save-section {
  margin-bottom: 20px;
  padding: 15px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.save-button {
  background: #27ae60;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.save-button:hover:not(:disabled) {
  background: #229954;
}

.save-button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.save-message {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
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
  padding: 40px 20px;
  font-size: 18px;
}

.loading {
  color: var(--color-text);
}

.error {
  color: #e74c3c;
  background: #fdf2f2;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
}

.config-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.add-provider-section {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 10px;
}

.config-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: 1fr;
}

/* Show 3 cards minimum on medium screens */
@media (min-width: 900px) {
  .config-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}

/* Show up to 4-5 cards on larger screens */
@media (min-width: 1400px) {
  .config-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }
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

.add-button.primary {
  background: #3498db;
  color: white;
}

.add-button.primary:hover {
  background: #2980b9;
}

.button-icon {
  font-weight: bold;
  line-height: 1;
}

.no-providers {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-secondary, #666);
  font-style: italic;
  background: var(--color-background-soft);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
}
</style>
