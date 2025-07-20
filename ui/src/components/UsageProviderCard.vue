<template>
  <div class="provider-card">
    <h3 class="provider-title">{{ provider.id }}</h3>

    <!-- Always show models since we now track everything -->
    <div class="models-container">
      <div
        v-for="model in provider.models"
        :key="model.name"
        class="model-section"
      >
        <h4 class="model-title">
          <span v-if="model.mappedName" class="mapped-name">{{ model.mappedName }}</span>
          <span v-if="model.mappedName" class="real-name">({{ model.name }})</span>
          <span v-else>{{ model.name }}</span>
        </h4>

        <ModelChart :limits="model.limits" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ModelChart from './ModelChart.vue';

interface LimitUsage {
  consumed: number;
  limit: number;
  percentage: number;
  msBeforeNext: number;
  unit: 'requests' | 'tokens' | 'USD';
}

interface ModelUsage {
  name: string;
  mappedName?: string;
  limits: {
    [key: string]: LimitUsage;
  };
}

interface ProviderUsage {
  id: string;
  models: ModelUsage[];
}

interface Props {
  provider: ProviderUsage;
}

defineProps<Props>();
</script>

<style scoped>
.provider-card {
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.provider-title {
  margin: 0 0 4px 0;
  color: var(--color-heading);
  font-size: 14px;
  font-weight: 600;
}

.models-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.model-section {
  background: var(--color-background-soft);
  border-radius: 3px;
  padding: 7px;
  border: 1px solid var(--color-border);
}

.model-title {
  margin: 0 0 3px 0;
  color: var(--color-heading);
  font-size: 12px;
  font-weight: 600;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border);
}

.mapped-name {
  font-weight: 600;
  color: var(--color-heading);
}

.real-name {
  font-weight: 400;
  color: var(--color-text-2);
  font-size: 10px;
  margin-left: 8px;
}

/* Responsive styles */
@media (max-width: 768px) {
  .provider-card {
    padding: 15px;
  }
}

@media (max-width: 480px) {
  .provider-card {
    padding: 6px;
  }

  .provider-title {
    font-size: 12px;
  }
}
</style>
