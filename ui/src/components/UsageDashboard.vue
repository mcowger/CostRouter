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

            <!-- Always show the limits container with usage data -->
            <div class="limits-container">
              <!-- Group limits by type (requests, tokens, cost) -->
              <div v-for="group in getLimitGroups(model.limits)" :key="group.type" class="limit-group">
                <h5 class="group-title">{{ group.title }}</h5>
                <div class="group-items">
                  <div
                    v-for="item in group.items"
                    :key="item.period"
                    class="compact-limit-item"
                  >
                    <div class="compact-header">
                      <span class="period-label">{{ item.period }}</span>
                      <span class="compact-values">
                        {{ formatValue(item.usage.consumed, item.usage.unit) }} / {{ formatValue(item.usage.limit, item.usage.unit) }}
                      </span>
                      <span class="compact-percentage" :class="getProgressBarClass(item.usage.percentage)">
                        {{ item.usage.limit === -1 ? '0%' : item.usage.percentage + '%' }}
                      </span>
                    </div>

                    <div class="compact-progress-container">
                      <div
                        class="compact-progress-bar"
                        :class="item.usage.limit === -1 ? 'infinite' : getProgressBarClass(item.usage.percentage)"
                        :style="{ width: item.usage.limit === -1 ? '100%' : Math.min(item.usage.percentage, 100) + '%' }"
                      ></div>
                    </div>

                    <div v-if="item.usage.msBeforeNext > 0" class="compact-reset-time">
                      Resets in {{ formatTimeRemaining(item.usage.msBeforeNext) }}
                    </div>
                  </div>
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
  padding: 20px;
  width: 100%;
}

.usage-dashboard h2 {
  text-align: center;
  margin-bottom: 30px;
  color: var(--color-heading);
}

.loading, .error {
  text-align: center;
  padding: 20px;
  font-size: 16px;
}

.error {
  color: #e74c3c;
  background-color: #fdf2f2;
  border: 1px solid #f5c6cb;
  border-radius: 5px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.provider-card {
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.provider-title {
  margin: 0 0 15px 0;
  color: var(--color-heading);
  font-size: 18px;
  font-weight: 600;
}

.models-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.model-section {
  background: var(--color-background-soft);
  border-radius: 6px;
  padding: 15px;
  border: 1px solid var(--color-border);
}

.model-title {
  margin: 0 0 12px 0;
  color: var(--color-heading);
  font-size: 16px;
  font-weight: 600;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.mapped-name {
  font-weight: 600;
  color: var(--color-heading);
}

.real-name {
  font-weight: 400;
  color: var(--color-text-2);
  font-size: 14px;
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
  font-size: 12px;
  color: var(--color-text);
  margin-top: 20px;
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
    padding: 15px;
  }

  .dashboard-grid {
    gap: 10px;
  }

  .provider-card {
    padding: 12px;
  }

  .provider-title {
    font-size: 16px;
  }

  .group-title {
    font-size: 12px;
  }

  .limit-group {
    padding: 8px;
  }
}
</style>
