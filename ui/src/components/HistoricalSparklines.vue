<template>
  <div class="historical-sparklines">
    <div class="sparklines-header">
      <h4>Historical Usage ({{ minutes }}m)</h4>
      <div class="time-selector">
        <button
          v-for="option in timeOptions"
          :key="option.value"
          @click="updateTimeRange(option)"
          :class="{ active: minutes === option.value }"
          class="time-button"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      Loading historical data...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else-if="availableProviders.length === 0" class="no-data">
      No historical data available
      <div class="debug-info" style="font-size: 12px; margin-top: 10px; color: #666;">
        Debug: Raw data count: {{ rawData?.length || 0 }}, Available providers: {{ availableProviders.length }}
      </div>
    </div>

    <div v-else class="sparklines-grid">
      <div 
        v-for="providerId in availableProviders" 
        :key="providerId"
        class="provider-sparklines"
      >
        <h5 class="provider-name">{{ providerId }}</h5>
        
        <div class="sparkline-row">
          <div class="sparkline-item">
            <span class="sparkline-label">Requests</span>
            <div class="sparkline-container">
              <sparklines :indicator-styles="requestIndicatorStyles">
                <sparkline-line
                  :width="200"
                  :height="40"
                  :data="getProviderData(providerId, 'requests')"
                  :styles="{ stroke: '#3498db', strokeWidth: 2, strokeLinejoin: 'miter', strokeLinecap: 'butt' }"
                  :has-spot="false"
                  :spot-styles="{ fill: '#3498db', stroke: '#2980b9', strokeWidth: 1, fillOpacity: 0.8, strokeOpacity: 1 }"
                  :spot-props="{ size: 3 }"
                />
              </sparklines>
              <span class="sparkline-value">
                {{ getLatestValue(providerId, 'requests') }}
              </span>
            </div>
          </div>

          <div class="sparkline-item">
            <span class="sparkline-label">Tokens</span>
            <div class="sparkline-container">
              <sparklines :indicator-styles="tokenIndicatorStyles">
                <sparkline-line
                  :width="200"
                  :height="40"
                  :data="getProviderData(providerId, 'tokens')"
                  :styles="{ stroke: '#2ecc71', strokeWidth: 2, strokeLinejoin: 'miter', strokeLinecap: 'butt' }"
                  :has-spot="true"
                  :spotlight="-1"
                  :spot-styles="{ fill: '#2ecc71', stroke: '#27ae60', strokeWidth: 1, fillOpacity: 0.8, strokeOpacity: 1 }"
                  :spot-props="{ size: 3 }"
                />
              </sparklines>
              <span class="sparkline-value">
                {{ formatTokens(getLatestValue(providerId, 'tokens')) }}
              </span>
            </div>
          </div>

          <div class="sparkline-item">
            <span class="sparkline-label">Cost</span>
            <div class="sparkline-container">
              <sparklines :indicator-styles="costIndicatorStyles">
                <sparkline-line
                  :width="200"
                  :height="40"
                  :data="getProviderData(providerId, 'costs')"
                  :styles="{ stroke: '#e74c3c', strokeWidth: 2, strokeLinejoin: 'miter', strokeLinecap: 'butt' }"
                  :has-spot="true"
                  :spotlight="-1"
                  :spot-styles="{ fill: '#e74c3c', stroke: '#c0392b', strokeWidth: 1, fillOpacity: 0.8, strokeOpacity: 1 }"
                  :spot-props="{ size: 3 }"
                />
              </sparklines>
              <span class="sparkline-value">
                ${{ getLatestValue(providerId, 'costs').toFixed(4) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Sparklines, SparklineLine, SparklineCurve, SparklineGradient } from 'vue-sparklines';
import { useHistoricalUsage } from '../composables/useHistoricalUsage';

const props = defineProps<{
  providerId?: string;
  model?: string;
}>();

const minutes = ref(60);
const aggregationMinutes = ref(5);
const timeOptions = [
  { label: '1m', value: 1, aggregation: 0.25 }, // 15-second aggregation
  { label: '5m', value: 5, aggregation: 0.5 },  // 30-second aggregation
  { label: '10m', value: 10, aggregation: 1 },  // 1-minute aggregation
  { label: '30m', value: 30, aggregation: 2 },  // 2-minute aggregation
  { label: '60m', value: 60, aggregation: 3 },  // 3-minute aggregation
];

const {
  loading,
  error,
  rawData,
  getSparklineData,
  fetchHistoricalUsage,
  availableProviders,
  getProviderSparklineData,
} = useHistoricalUsage();

// Styling for sparklines - different colors for each metric
const requestIndicatorStyles = {
  fill: '#3498db',
  fillOpacity: 0.8,
  stroke: '#2980b9',
  strokeWidth: 2,
  r: 3,
};

const tokenIndicatorStyles = {
  fill: '#2ecc71',
  fillOpacity: 0.8,
  stroke: '#27ae60',
  strokeWidth: 2,
  r: 3,
};

const costIndicatorStyles = {
  fill: '#e74c3c',
  fillOpacity: 0.8,
  stroke: '#c0392b',
  strokeWidth: 2,
  r: 3,
};

const textStyles = {
  fontSize: '12px',
  fill: '#7f8c8d',
  fontFamily: 'Arial, sans-serif',
};

const updateTimeRange = async (option: { value: number; aggregation: number }) => {
  console.log('Updating time range to:', option);
  minutes.value = option.value;
  aggregationMinutes.value = option.aggregation;
  await fetchHistoricalUsage(option.value, props.model, props.providerId);
  console.log('After fetch - rawData length:', rawData.value?.length, 'availableProviders:', availableProviders.value);
};

const getProviderData = (providerId: string, dataType: 'requests' | 'tokens' | 'costs'): number[] => {
  const data = getProviderSparklineData(providerId, aggregationMinutes.value);
  if (!data) return [];

  return data[dataType] || [];
};

const getLatestValue = (providerId: string, dataType: 'requests' | 'tokens' | 'costs'): number => {
  const data = getProviderData(providerId, dataType);
  return data.length > 0 ? data[data.length - 1] : 0;
};

const formatTokens = (tokens: number): string => {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toString();
};

onMounted(async () => {
  console.log('Component mounted, fetching initial data for', minutes.value, 'minutes');
  await fetchHistoricalUsage(minutes.value, props.model, props.providerId);
  console.log('Initial fetch complete - rawData length:', rawData.value?.length, 'availableProviders:', availableProviders.value);
});
</script>

<style scoped>
.historical-sparklines {
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.sparklines-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.sparklines-header h4 {
  margin: 0;
  color: var(--color-heading);
  font-size: 18px;
}

.time-selector {
  display: flex;
  gap: 5px;
}

.time-button {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.time-button:hover {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}

.time-button.active {
  background: #3498db;
  color: white !important;
  border-color: #3498db;
}

.loading, .error, .no-data {
  text-align: center;
  padding: 20px;
  font-size: 14px;
}

.error {
  color: #e74c3c;
  background-color: #fdf2f2;
  border: 1px solid #f5c6cb;
  border-radius: 5px;
}

.sparklines-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.provider-sparklines {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 15px;
  background: var(--color-background);
}

.provider-name {
  margin: 0 0 15px 0;
  color: var(--color-heading);
  font-size: 16px;
  font-weight: 600;
}

.sparkline-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 15px;
}

.sparkline-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sparkline-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sparkline-container {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sparkline-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  min-width: 60px;
  text-align: right;
}

@media (max-width: 768px) {
  .sparklines-header {
    flex-direction: column;
    gap: 15px;
    align-items: flex-start;
  }

  .time-selector {
    align-self: stretch;
    justify-content: space-between;
  }

  .sparkline-row {
    grid-template-columns: 1fr;
  }

  .sparkline-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }

  .sparkline-value {
    text-align: left;
    min-width: auto;
  }
}
</style>
