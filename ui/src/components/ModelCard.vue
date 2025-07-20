<template>
  <div class="model-item">
    <div class="model-header">
      <h5>Model {{ modelIndex + 1 }}</h5>
      <button 
        @click="$emit('remove')" 
        class="remove-button small"
        title="Remove Model"
      >
        <span class="button-icon">×</span>
      </button>
    </div>

    <div class="form-group">
      <label>Model Name:</label>
      <input 
        type="text" 
        :value="model.name"
        @input="updateModel('name', $event.target.value)"
        class="form-input"
        placeholder="gpt-4"
      />
      <small class="field-help">The actual model name used by the provider</small>
    </div>
    
    <div class="form-group">
      <label>Mapped Name (optional):</label>
      <input 
        type="text" 
        :value="model.mappedName || ''"
        @input="updateModel('mappedName', $event.target.value)"
        class="form-input"
        placeholder="gpt-4"
      />
      <small class="field-help">The name clients will use in requests (defaults to model name if not provided)</small>
    </div>

    <!-- Model Pricing Accordion -->
    <details class="accordion">
      <summary class="accordion-header">
        <span>Pricing</span>
        <span class="accordion-icon">▼</span>
      </summary>
      <div class="accordion-content">
        <PricingSection
          :pricing="model.pricing"
          @add="addPricing"
          @remove="removePricing"
          @update="updatePricing"
        />
      </div>
    </details>

    <!-- Model Rate Limits Accordion -->
    <details class="accordion">
      <summary class="accordion-header">
        <span>Rate Limits</span>
        <span class="accordion-icon">▼</span>
      </summary>
      <div class="accordion-content">
        <LimitsSection
          :limits="model.limits"
          @add="addLimits"
          @remove="removeLimits"
          @update="updateLimits"
        />
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import type { Model } from '../../../schemas/model.schema';
import type { Pricing } from '../../../schemas/pricing.schema';
import type { Limits } from '../../../schemas/limits.schema';
import PricingSection from './PricingSection.vue';
import LimitsSection from './LimitsSection.vue';

interface Props {
  model: Model;
  modelIndex: number;
}

interface Emits {
  (e: 'update', model: Model): void;
  (e: 'remove'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const updateModel = (field: keyof Model, value: string): void => {
  const updatedModel = { ...props.model };
  if (field === 'mappedName' && value === '') {
    delete updatedModel.mappedName;
  } else {
    updatedModel[field] = value as any;
  }
  emit('update', updatedModel);
};

const addPricing = (): void => {
  const updatedModel = { 
    ...props.model, 
    pricing: {
      inputCostPerMillionTokens: 0,
      outputCostPerMillionTokens: 0,
      costPerRequest: undefined
    }
  };
  emit('update', updatedModel);
};

const removePricing = (): void => {
  if (confirm('Are you sure you want to remove the pricing configuration? This action cannot be undone.')) {
    const updatedModel = { ...props.model };
    delete updatedModel.pricing;
    emit('update', updatedModel);
  }
};

const updatePricing = (pricing: Pricing): void => {
  const updatedModel = { ...props.model, pricing };
  emit('update', updatedModel);
};

const addLimits = (): void => {
  const updatedModel = { 
    ...props.model, 
    limits: {
      requestsPerMinute: undefined,
      requestsPerHour: undefined,
      requestsPerDay: undefined,
      tokensPerMinute: undefined,
      tokensPerHour: undefined,
      tokensPerDay: undefined,
      costPerMinute: undefined,
      costPerHour: undefined,
      costPerDay: undefined
    }
  };
  emit('update', updatedModel);
};

const removeLimits = (): void => {
  if (confirm('Are you sure you want to remove the limits configuration? This action cannot be undone.')) {
    const updatedModel = { ...props.model };
    delete updatedModel.limits;
    emit('update', updatedModel);
  }
};

const updateLimits = (limits: Limits): void => {
  const updatedModel = { ...props.model, limits };
  emit('update', updatedModel);
};
</script>

<style scoped>
.model-item {
  padding: 15px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.model-header h5 {
  margin: 0;
  color: var(--color-heading);
  font-size: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 15px;
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

.field-help {
  color: var(--color-text-secondary, #666);
  font-size: 11px;
  margin-top: 4px;
  display: block;
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

.accordion {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  margin-top: 15px;
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
