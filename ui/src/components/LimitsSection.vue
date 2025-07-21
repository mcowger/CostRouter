<template>
  <div class="optional-section">
    <div v-if="props.limits" class="limits-section">
      <div class="section-header">
        <h5>Rate Limits</h5>
        <button
          @click="emit('remove')"
          class="remove-button small"
          title="Remove Limits"
        >
          <span class="button-icon">×</span>
        </button>
      </div>
      <div
        v-for="field in limitsFields"
        :key="field.key"
        class="form-group"
      >
        <label>{{ field.label }}:</label>
        <input
          type="number"
          :value="props.limits[field.key] || ''"
          @input="updateLimits(field.key, $event)"
          class="form-input"
          :placeholder="props.limits[field.key] !== undefined ? '' : 'Not Configured'"
          step="0.01"
          min="0"
        />
      </div>
    </div>
    <div v-else class="add-section">
      <button
        @click="emit('add')"
        class="add-button secondary"
      >
        <span class="button-icon">+</span>
        Add Limits
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Limits } from '#schemas/limits.schema';

const props = defineProps<{
  limits: Limits | null;
}>();

const emit = defineEmits<{
  (e: 'add'): void;
  (e: 'remove'): void;
  (e: 'update', limits: Limits): void;
}>();

interface FieldDefinition {
  label: string;
  key: keyof Limits;
}

const limitsFields: FieldDefinition[] = [
  { key: 'requestsPerMinute', label: 'Requests Per Minute' },
  { key: 'requestsPerHour', label: 'Requests Per Hour' },
  { key: 'requestsPerDay', label: 'Requests Per Day' },
  { key: 'tokensPerMinute', label: 'Tokens Per Minute' },
  { key: 'tokensPerHour', label: 'Tokens Per Hour' },
  { key: 'tokensPerDay', label: 'Tokens Per Day' },
  { key: 'costPerMinute', label: 'Cost Per Minute' },
  { key: 'costPerHour', label: 'Cost Per Hour' },
  { key: 'costPerDay', label: 'Cost Per Day' },
];

const updateLimits = (key: keyof Limits, event: Event): void => {
  const target = event.target as HTMLInputElement;
  const value = target.value;

  if (!props.limits) return;

  const updatedLimits = { ...props.limits };
  const numValue = parseFloat(value);

  updatedLimits[key] = isNaN(numValue) ? undefined : numValue;

  emit('update', updatedLimits);
};
</script>

<style scoped>
.optional-section {
  margin-top: 15px;
}

.limits-section {
  padding: 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.section-header h5 {
  margin: 0;
  color: var(--color-heading);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 10px;
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

.form-input::placeholder {
  color: var(--color-text-secondary, #999);
  font-style: italic;
}

.add-section {
  display: flex;
  justify-content: center;
  padding: 20px;
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

.remove-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 4px;
  background: #e74c3c;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  line-height: 1;
}

.remove-button:hover {
  background: #c0392b;
}

.button-icon {
  font-weight: bold;
  line-height: 1;
}
</style>
