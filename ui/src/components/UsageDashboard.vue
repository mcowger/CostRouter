<template>
  <div class="usage-dashboard">
    <h2>Real-time Usage Dashboard</h2>

    <div v-if="loading" class="loading">
      Loading usage data...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else>
      <!-- Overall Model Usage Section -->
      <OverallModelUsage :usage-data="usageData" />

      <!-- Provider Cards Section -->
      <div class="dashboard-grid">
        <UsageProviderCard
          v-for="provider in usageData?.providers"
          :key="provider.id"
          :provider="provider"
        />
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
import OverallModelUsage from './OverallModelUsage.vue';
import UsageProviderCard from './UsageProviderCard.vue';

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

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
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
}

@media (max-width: 480px) {
  .usage-dashboard {
    padding: 7px;
  }

  .dashboard-grid {
    gap: 5px;
  }
}
</style>
