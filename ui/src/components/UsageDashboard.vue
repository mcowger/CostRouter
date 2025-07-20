<template>
  <div class="usage-dashboard">
    <h2>Real-time Usage Dashboard</h2>

    <div v-if="loading" class="loading">
      Loading usage data...
    </div>
    
    <div v-else-if="error" class="error">
      {{ error }}
    </div>
    
    <div v-else class="dashboard-grid">
      <div
        v-for="provider in usageData?.providers"
        :key="provider.id"
        class="provider-card"
      >
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

            <!-- Compact vertical bar chart display -->
            <div class="chart-container">
              <div class="chart-bars">
                <div
                  v-for="item in getChartData(model.limits)"
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
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="usageData" class="last-updated">
      Last updated: {{ formatTimestamp(usageData.timestamp) }}
    </div>

    <!-- Historical Data Sparklines -->
    <HistoricalSparklines />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import HistoricalSparklines from './HistoricalSparklines.vue';

// Types matching the server-side interfaces
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

const usageData = ref<UsageDashboardData | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
let refreshInterval: number | null = null;

const fetchUsageData = async () => {
  try {
    const response = await fetch('http://localhost:3000/usage/current');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: UsageDashboardData = await response.json();
    usageData.value = data;
    error.value = null;
  } catch (e: any) {
    error.value = e.message;
    console.error('Failed to fetch usage data:', e);
  } finally {
    loading.value = false;
  }
};

const getLimitGroups = (limits: { [key: string]: LimitUsage }) => {
  const groups = [
    {
      type: 'requests',
      title: 'Requests',
      items: [] as Array<{ period: string; usage: LimitUsage }>
    },
    {
      type: 'tokens',
      title: 'Tokens',
      items: [] as Array<{ period: string; usage: LimitUsage }>
    },
    {
      type: 'cost',
      title: 'Cost',
      items: [] as Array<{ period: string; usage: LimitUsage }>
    }
  ];

  // Map limit types to their groups and periods
  const limitMapping: { [key: string]: { groupIndex: number; period: string } } = {
    requestsPerMinute: { groupIndex: 0, period: 'per minute' },
    requestsPerHour: { groupIndex: 0, period: 'per hour' },
    requestsPerDay: { groupIndex: 0, period: 'per day' },
    tokensPerMinute: { groupIndex: 1, period: 'per minute' },
    tokensPerHour: { groupIndex: 1, period: 'per hour' },
    tokensPerDay: { groupIndex: 1, period: 'per day' },
    costPerMinute: { groupIndex: 2, period: 'per minute' },
    costPerHour: { groupIndex: 2, period: 'per hour' },
    costPerDay: { groupIndex: 2, period: 'per day' }
  };

  // Populate groups with available limits
  Object.entries(limits).forEach(([limitType, usage]) => {
    const mapping = limitMapping[limitType];
    if (mapping) {
      groups[mapping.groupIndex].items.push({
        period: mapping.period,
        usage
      });
    }
  });

  // Return only groups that have items
  return groups.filter(group => group.items.length > 0);
};

const hasAnyActiveLimits = (provider: ProviderUsage): boolean => {
  // Since we now track all models, we should always show them
  // The "no limits" message should only show if there are truly no models
  return provider.models.length > 0;
};

const getChartData = (limits: Record<string, any>) => {
  const chartData = [];

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
    if (limits[limitType.key]) {
      chartData.push({
        key: limitType.key,
        label: limitType.label,
        shortLabel: limitType.shortLabel,
        type: limitType.type,
        usage: limits[limitType.key]
      });
    }
  }

  return chartData;
};

const getBarClass = (percentage: number): string => {
  if (percentage >= 90) return 'danger';
  if (percentage >= 75) return 'warning';
  return 'success';
};

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

const formatTimeRemaining = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

const getProgressBarClass = (percentage: number): string => {
  if (percentage >= 90) return 'danger';
  if (percentage >= 70) return 'warning';
  return 'success';
};

onMounted(() => {
  fetchUsageData();
  // Refresh every 1 second
  refreshInterval = window.setInterval(fetchUsageData, 1000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
.usage-dashboard {
  padding: 10px;
  width: 100%;
}

.usage-dashboard h2 {
  text-align: center;
  margin-bottom: 15px;
  color: var(--color-heading);
  font-size: 1.5rem;
  font-weight: 600;
}

.loading, .error {
  text-align: center;
  padding: 10px;
  font-size: 12px;
}

.error {
  color: #e74c3c;
  background-color: #fdf2f2;
  border: 1px solid #f5c6cb;
  border-radius: 3px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

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

.limits-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.limit-group {
  background: var(--color-background);
  padding: 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.group-title {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-heading);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compact-limit-item {
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border);
}

.compact-limit-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.compact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  gap: 0px;
}

.period-label {
  font-weight: 500;
  color: var(--color-text);
  font-size: 13px;
  min-width: 80px;
}

.compact-values {
  font-family: monospace;
  font-size: 12px;
  color: var(--color-text);
  flex: 1;
  text-align: center;
  white-space: nowrap;
}

.compact-percentage {
  font-weight: 600;
  font-size: 12px;
  min-width: 35px;
  text-align: right;
}

.compact-percentage.success {
  color: #27ae60;
}

.compact-percentage.warning {
  color: #f39c12;
}

.compact-percentage.danger {
  color: #e74c3c;
}

.compact-progress-container {
  width: 100%;
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 2px;
}

.compact-progress-bar {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.compact-progress-bar.success {
  background-color: #27ae60;
}

.compact-progress-bar.warning {
  background-color: #f39c12;
}

.compact-progress-bar.danger {
  background-color: #e74c3c;
}

.compact-progress-bar.infinite {
  background: linear-gradient(90deg, #95a5a6, #7f8c8d);
  opacity: 0.6;
}

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

.compact-reset-time {
  font-size: 10px;
  color: var(--color-text);
  font-style: italic;
  text-align: right;
  opacity: 0.8;
}

.no-limits {
  text-align: center;
  color: var(--color-text);
  font-style: italic;
  padding: 20px;
}

.no-model-limits {
  text-align: center;
  color: #888;
  font-style: italic;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  margin: 10px 0;
  font-size: 14px;
}

.last-updated {
  text-align: center;
  font-size: 10px;
  color: var(--color-text);
  margin-top: 10px;
}

/* Responsive breakpoints for better card layout */
@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}

@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  }
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .provider-card {
    padding: 15px;
  }

  .compact-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .compact-values {
    font-size: 11px;
    text-align: left;
  }

  .period-label {
    font-size: 12px;
    min-width: auto;
  }

  .compact-percentage {
    font-size: 11px;
    text-align: left;
  }
}

@media (max-width: 480px) {
  .usage-dashboard {
    padding: 7px;
  }

  .dashboard-grid {
    gap: 5px;
  }

  .provider-card {
    padding: 6px;
  }

  .provider-title {
    font-size: 12px;
  }

  .group-title {
    font-size: 12px;
  }

  .limit-group {
    padding: 8px;
  }
}
</style>
