<template>
  <div class="optional-section">
    <!-- The v-if correctly guards against null/undefined props -->
    <div v-if="pricing" class="pricing-section">
      <div class="section-header">
        <h5>Pricing</h5>
        <button
          @click="$emit('remove')"
          class="remove-button small"
          title="Remove Pricing"
        >
          <span class="button-icon">×</span>
        </button>
      </div>
      <!-- The v-for uses the new, strongly-typed pricingFields array -->
      <div
        v-for="field in pricingFields"
        :key="field.key"
        class="form-group"
      >
        <label>{{ field.label }}:</label>
        <input
          type="number"
          :value="pricing[field.key] || ''"
          @input="updatePricing(field.key, $event)"
          class="form-input"
          :placeholder="pricing[field.key] !== undefined ? '' : 'Not Configured'"
          step="0.0001"
          min="0"
        />
      </div>
    </div>
    <div v-else class="add-section">
      <button
        @click="$emit('add')"
        class="add-button secondary"
      >
        <span class="button-icon">+</span>
        Add Pricing
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// --- FIXED: Use path alias for import
import type { Pricing } from '@schemas/pricing.schema';

// --- FIXED: Use inline definitions for props and emits
const props = defineProps<{
  pricing?: Pricing | null; // Allow null for consistency
}>();

const emit = defineEmits<{
  (e: 'add'): void;
  (e: 'remove'): void;
  (e: 'update', pricing: Pricing): void;
}>();

// --- FIXED: Define the shape of the field objects
interface FieldDefinition {
  label: string;
  key: keyof Pricing; // This ensures keys are valid
}

// --- FIXED: Apply the strong type to the array
const pricingFields: FieldDefinition[] = [
  { key: 'inputCostPerMillionTokens', label: 'Input Cost Per Million Tokens' },
  { key: 'outputCostPerMillionTokens', label: 'Output Cost Per Million Tokens' },
  { key: 'costPerRequest', label: 'Cost Per Request' }
];

// --- FIXED: Refactor function to accept the event and be fully type-safe
const updatePricing = (key: keyof Pricing, event: Event): void => {
  const target = event.target as HTMLInputElement;
  const value = target.value;

  if (!props.pricing) return;

  const updatedPricing = { ...props.pricing };
  const numValue = parseFloat(value);

  // No type assertion needed here anymore
  updatedPricing[key] = isNaN(numValue) ? undefined : numValue;

  emit('update', updatedPricing);
};
</script>

<style scoped>
.optional-section {
  margin-top: 15px;
}

.pricing-section {
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
