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
        
        <div class="limits-container">
          <div 
            v-for="(usage, limitType) in provider.limits" 
            :key="limitType"
            class="limit-item"
          >
            <div class="limit-header">
              <span class="limit-name">{{ formatLimitName(limitType as string) }}</span>
              <span class="limit-values">
                {{ formatValue(usage.consumed, usage.unit) }} / {{ formatValue(usage.limit, usage.unit) }}
              </span>
            </div>
            
            <div class="progress-bar-container">
              <div 
                class="progress-bar"
                :class="getProgressBarClass(usage.percentage)"
                :style="{ width: Math.min(usage.percentage, 100) + '%' }"
              ></div>
            </div>
            
            <div class="limit-details">
              <span class="percentage">{{ usage.percentage }}%</span>
              <span class="reset-time" v-if="usage.msBeforeNext > 0">
                Resets in {{ formatTimeRemaining(usage.msBeforeNext) }}
              </span>
            </div>
          </div>
          
          <!-- Show message if no limits are configured -->
          <div v-if="Object.keys(provider.limits).length === 0" class="no-limits">
            No rate limits configured for this provider
          </div>
        </div>
      </div>
    </div>
    
    <div v-if="usageData" class="last-updated">
      Last updated: {{ formatTimestamp(usageData.timestamp) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

// Types matching the server-side interfaces
interface LimitUsage {
  consumed: number;
  limit: number;
  percentage: number;
  msBeforeNext: number;
  unit: 'requests' | 'tokens' | 'USD';
}

interface ProviderUsage {
  id: string;
  limits: {
    [key: string]: LimitUsage;
  };
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

const formatLimitName = (limitType: string): string => {
  const nameMap: { [key: string]: string } = {
    requestsPerMinute: 'Requests/min',
    requestsPerHour: 'Requests/hour',
    requestsPerDay: 'Requests/day',
    tokensPerMinute: 'Tokens/min',
    tokensPerHour: 'Tokens/hour',
    tokensPerDay: 'Tokens/day',
    costPerMinute: 'Cost/min',
    costPerHour: 'Cost/hour',
    costPerDay: 'Cost/day'
  };
  return nameMap[limitType] || limitType;
};

const formatValue = (value: number, unit: string): string => {
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
  max-width: 1200px;
  margin: 0 auto;
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
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
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

.limits-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.limit-item {
  background: var(--color-background);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.limit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.limit-name {
  font-weight: 500;
  color: var(--color-text);
}

.limit-values {
  font-family: monospace;
  font-size: 14px;
  color: var(--color-text);
}

.progress-bar-container {
  width: 100%;
  height: 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-bar.success {
  background-color: #27ae60;
}

.progress-bar.warning {
  background-color: #f39c12;
}

.progress-bar.danger {
  background-color: #e74c3c;
}

.limit-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--color-text);
}

.percentage {
  font-weight: 600;
}

.reset-time {
  font-style: italic;
}

.no-limits {
  text-align: center;
  color: var(--color-text);
  font-style: italic;
  padding: 20px;
}

.last-updated {
  text-align: center;
  font-size: 12px;
  color: var(--color-text);
  margin-top: 20px;
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  
  .limit-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
</style>
