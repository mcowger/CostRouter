<template>
  <div class="chart-container">
    <div class="chart-bars">
      <div
        v-for="item in chartData"
        :key="item.key"
        class="chart-bar-group"
      >
        <div class="chart-bar-container">
          <div
            class="chart-bar"
            :class="item.usage.limit === -1 ? 'infinite' : item.type"
            :style="{ height: getBarHeight(item.usage.percentage, item.usage.limit) }"
            :title="`${item.label}: ${formatValue(item.usage.consumed, item.usage.unit)} / ${formatValue(item.usage.limit, item.usage.unit)} (${item.usage.limit === -1 ? '0%' : item.usage.percentage + '%'})`"
          ></div>
        </div>
        <div class="chart-label">{{ item.shortLabel }}</div>
        <div class="chart-value">{{ formatValue(item.usage.consumed, item.usage.unit) }}</div>
      </div>
    </div>

    <!-- Legend -->
    <div class="chart-legend">
      <div class="legend-item">
        <div class="legend-color requests"></div>
        <span>Requests</span>
      </div>
      <div class="legend-item">
        <div class="legend-color tokens"></div>
        <span>Tokens</span>
      </div>
      <div class="legend-item">
        <div class="legend-color cost"></div>
        <span>Cost</span>
      </div>
      <div class="legend-item">
        <div class="legend-color infinite"></div>
        <span>Unlimited</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface LimitUsage {
  consumed: number;
  limit: number;
  percentage: number;
  msBeforeNext: number;
  unit: 'requests' | 'tokens' | 'USD';
}

interface Props {
  limits: Record<string, LimitUsage>;
}

const props = defineProps<Props>();

const chartData = computed(() => {
  const data = [];

  // Define the order and labels for the chart
  const limitTypes = [
    { key: 'requestsPerMinute', label: 'Requests Per Minute', shortLabel: 'Req/Min', type: 'requests' },
    { key: 'requestsPerHour', label: 'Requests Per Hour', shortLabel: 'Req/Hr', type: 'requests' },
    { key: 'requestsPerDay', label: 'Requests Per Day', shortLabel: 'Req/Day', type: 'requests' },
    { key: 'tokensPerMinute', label: 'Tokens Per Minute', shortLabel: 'Tok/Min', type: 'tokens' },
    { key: 'tokensPerHour', label: 'Tokens Per Hour', shortLabel: 'Tok/Hr', type: 'tokens' },
    { key: 'tokensPerDay', label: 'Tokens Per Day', shortLabel: 'Tok/Day', type: 'tokens' },
    { key: 'costPerMinute', label: 'Cost Per Minute', shortLabel: 'Cost/Min', type: 'cost' },
    { key: 'costPerHour', label: 'Cost Per Hour', shortLabel: 'Cost/Hr', type: 'cost' },
    { key: 'costPerDay', label: 'Cost Per Day', shortLabel: 'Cost/Day', type: 'cost' },
  ];

  for (const limitType of limitTypes) {
    if (props.limits[limitType.key]) {
      data.push({
        key: limitType.key,
        label: limitType.label,
        shortLabel: limitType.shortLabel,
        type: limitType.type,
        usage: props.limits[limitType.key]
      });
    }
  }

  return data;
});

const getBarHeight = (percentage: number, limit: number): string => {
  if (limit === -1) {
    // For infinite limits, show a small bar to indicate activity
    return '10px';
  }
  // Minimum height of 3px, maximum of 50px
  const height = Math.max(3, Math.min(50, percentage / 2));
  return `${height}px`;
};

const formatValue = (value: number, unit: string): string => {
  // Handle infinite limits (marked as -1)
  if (value === -1) {
    return '∞';
  }

  if (unit === 'USD') {
    return `$${value.toFixed(4)}`;
  } else if (unit === 'tokens' && value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
};
</script>

<style scoped>
/* Chart Layout */
.chart-container {
  padding: 7px;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 60px;
  margin-bottom: 7px;
  padding: 5px 0;
  border-bottom: 1px solid var(--color-border);
}

.chart-bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  margin: 0 1px;
}

.chart-bar-container {
  height: 50px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
}

.chart-bar {
  width: 15px;
  min-height: 3px;
  border-radius: 1px 1px 0 0;
  transition: all 0.3s ease;
  cursor: pointer;
}

.chart-bar:hover {
  opacity: 0.8;
  transform: scaleY(1.05);
}

.chart-bar.requests {
  background: linear-gradient(to top, #3498db, #2980b9);
}

.chart-bar.tokens {
  background: linear-gradient(to top, #2ecc71, #27ae60);
}

.chart-bar.cost {
  background: linear-gradient(to top, #e74c3c, #c0392b);
}

.chart-bar.infinite {
  background: linear-gradient(to top, #95a5a6, #7f8c8d);
  opacity: 0.7;
}

.chart-label {
  font-size: 8px;
  color: var(--color-text);
  text-align: center;
  margin-top: 2px;
  line-height: 1.1;
  font-weight: 500;
}

.chart-value {
  font-size: 7px;
  color: var(--color-text-muted);
  text-align: center;
  margin-top: 1px;
  font-weight: 600;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 7px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--color-text);
}

.legend-color {
  width: 8px;
  height: 8px;
  border-radius: 1px;
}

.legend-color.requests {
  background: linear-gradient(45deg, #3498db, #2980b9);
}

.legend-color.tokens {
  background: linear-gradient(45deg, #2ecc71, #27ae60);
}

.legend-color.cost {
  background: linear-gradient(45deg, #e74c3c, #c0392b);
}

.legend-color.infinite {
  background: linear-gradient(45deg, #95a5a6, #7f8c8d);
}
</style>
