<template>
  <div class="logging-settings">
    <h3>Logging Settings</h3>
    <p class="description">
      Adjust the server logging level in real-time without requiring a restart.
    </p>

    <div v-if="loading" class="loading">
      Loading current log level...
    </div>

    <div v-else-if="error" class="error">
      Error: {{ error }}
    </div>

    <div v-else class="settings-container">
      <!-- Current Log Level Display -->
      <div class="current-level">
        <label class="current-label">Current Log Level:</label>
        <span class="level-badge" :class="`level-${currentLogLevel}`">
          {{ currentLogLevel.toUpperCase() }}
        </span>
      </div>

      <!-- Log Level Selection -->
      <div class="level-selection">
        <label for="logLevel" class="form-label">Select New Log Level:</label>
        <select 
          id="logLevel" 
          v-model="selectedLevel" 
          class="form-select"
          :disabled="isUpdating"
        >
          <option value="trace">TRACE - Most verbose, includes all details</option>
          <option value="debug">DEBUG - Debug information and above</option>
          <option value="info">INFO - General information and above</option>
          <option value="warn">WARN - Warnings and errors only</option>
          <option value="error">ERROR - Errors and fatal only</option>
          <option value="fatal">FATAL - Fatal errors only</option>
        </select>
      </div>

      <!-- Apply Button -->
      <div class="action-section">
        <button 
          @click="applyLogLevel" 
          :disabled="isUpdating || selectedLevel === currentLogLevel"
          class="apply-button"
        >
          {{ isUpdating ? 'Applying...' : 'Apply Log Level' }}
        </button>
      </div>

      <!-- Success/Error Messages -->
      <div v-if="message" class="message" :class="messageType">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Reactive state
const currentLogLevel = ref<string>('info')
const selectedLevel = ref<string>('info')
const loading = ref<boolean>(true)
const isUpdating = ref<boolean>(false)
const error = ref<string | null>(null)
const message = ref<string | null>(null)
const messageType = ref<'success' | 'error'>('success')

// Methods
const fetchCurrentLogLevel = async () => {
  try {
    loading.value = true
    error.value = null
    
    const response = await fetch('http://localhost:3000/admin/logging/level')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    currentLogLevel.value = data.level
    selectedLevel.value = data.level
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

const applyLogLevel = async () => {
  try {
    isUpdating.value = true
    message.value = null
    
    const response = await fetch('http://localhost:3000/admin/logging/level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: selectedLevel.value })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    currentLogLevel.value = selectedLevel.value
    message.value = data.message
    messageType.value = 'success'
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      message.value = null
    }, 3000)
    
  } catch (e: any) {
    message.value = e.message
    messageType.value = 'error'
  } finally {
    isUpdating.value = false
  }
}

// Lifecycle
onMounted(() => {
  fetchCurrentLogLevel()
})
</script>

<style scoped>
.logging-settings {
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.logging-settings h3 {
  color: var(--color-heading);
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.description {
  color: var(--color-text-muted);
  margin: 0 0 20px 0;
  font-size: 14px;
  line-height: 1.4;
}

.loading, .error {
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
}

.loading {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #bbdefb;
}

.error {
  background: #ffebee;
  color: #d32f2f;
  border: 1px solid #ffcdd2;
}

.settings-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.current-level {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-background-mute);
  border-radius: 6px;
  border: 1px solid var(--color-border-hover);
}

.current-label {
  font-weight: 500;
  color: var(--color-text);
}

.level-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.level-trace { background: #e8f5e8; color: #2e7d32; }
.level-debug { background: #e3f2fd; color: #1976d2; }
.level-info { background: #e0f2f1; color: #00695c; }
.level-warn { background: #fff3e0; color: #ef6c00; }
.level-error { background: #ffebee; color: #d32f2f; }
.level-fatal { background: #f3e5f5; color: #7b1fa2; }

.level-selection {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-weight: 500;
  color: var(--color-text);
  font-size: 14px;
}

.form-select {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.form-select:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.1);
}

.form-select:disabled {
  background: var(--color-background-mute);
  cursor: not-allowed;
  opacity: 0.6;
}

.action-section {
  display: flex;
  justify-content: flex-start;
}

.apply-button {
  background: #1976d2;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.apply-button:hover:not(:disabled) {
  background: #1565c0;
}

.apply-button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

.message {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

@media (max-width: 768px) {
  .current-level {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>