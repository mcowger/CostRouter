<template>
  <div class="overall-usage-section">
    <h3 class="section-title">Overall Model Usage</h3>
    <div class="overall-usage-grid">
      <div
        v-for="modelUsage in aggregatedModelUsage"
        :key="modelUsage.mappedName"
        class="overall-model-card"
      >
        <h4 class="overall-model-title">{{ modelUsage.mappedName }}</h4>
        <ModelChart :limits="modelUsage.aggregatedLimits" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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

interface UsageDashboardData {
  providers: ProviderUsage[];
  timestamp: number;
}

interface Props {
  usageData: UsageDashboardData | null;
}

const props = defineProps<Props>();

// Computed property to aggregate usage by mapped model names
const aggregatedModelUsage = computed(() => {
  if (!props.usageData) return [];

  const modelMap = new Map<string, {
    mappedName: string;
    aggregatedLimits: Record<string, LimitUsage>;
  }>();

  // Iterate through all providers and models
  props.usageData.providers.forEach(provider => {
    provider.models.forEach(model => {
      const mappedName = model.mappedName || model.name;
      
      if (!modelMap.has(mappedName)) {
        modelMap.set(mappedName, {
          mappedName,
          aggregatedLimits: {}
        });
      }

      const aggregatedModel = modelMap.get(mappedName)!;

      // Aggregate limits by summing consumed values
      Object.entries(model.limits).forEach(([limitType, limitUsage]) => {
        if (!aggregatedModel.aggregatedLimits[limitType]) {
          aggregatedModel.aggregatedLimits[limitType] = {
            consumed: 0,
            limit: limitUsage.limit,
            percentage: 0,
            msBeforeNext: limitUsage.msBeforeNext,
            unit: limitUsage.unit
          };
        }

        // Sum the consumed values
        aggregatedModel.aggregatedLimits[limitType].consumed += limitUsage.consumed;
        
        // Recalculate percentage based on aggregated consumed and original limit
        if (limitUsage.limit > 0) {
          aggregatedModel.aggregatedLimits[limitType].percentage = 
            Math.round((aggregatedModel.aggregatedLimits[limitType].consumed / limitUsage.limit) * 100);
        } else {
          aggregatedModel.aggregatedLimits[limitType].percentage = 0;
        }

        // Use the earliest reset time
        aggregatedModel.aggregatedLimits[limitType].msBeforeNext = 
          Math.min(aggregatedModel.aggregatedLimits[limitType].msBeforeNext, limitUsage.msBeforeNext);
      });
    });
  });

  return Array.from(modelMap.values()).sort((a, b) => a.mappedName.localeCompare(b.mappedName));
});
</script>

<style scoped>
/* Overall Usage Section */
.overall-usage-section {
  margin-bottom: 20px;
}

.section-title {
  margin: 0 0 15px 0;
  color: var(--color-heading);
  font-size: 1.3rem;
  font-weight: 600;
  text-align: center;
}

.overall-usage-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 10px;
  margin-bottom: 15px;
}

.overall-model-card {
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.overall-model-title {
  margin: 0 0 8px 0;
  color: var(--color-heading);
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border);
}

/* Responsive breakpoints */
@media (max-width: 1200px) {
  .overall-usage-grid {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }
}

@media (max-width: 900px) {
  .overall-usage-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }
}

@media (max-width: 768px) {
  .overall-usage-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .overall-model-card {
    padding: 15px;
  }
}

@media (max-width: 480px) {
  .overall-model-card {
    padding: 6px;
  }
}
</style>
