import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { AppConfig } from '#schemas/appConfig.schema';

export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const logLevel = ref<string>('info');

  async function fetchConfig() {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('http://localhost:3000/config/get');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: AppConfig = await response.json();
      config.value = data;
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  async function updateProviderOAuthToken(providerId: string, oauthToken: string | undefined) {
    if (!config.value) return;

    const newConfig = JSON.parse(JSON.stringify(config.value));
    const provider = newConfig.providers.find((p: any) => p.id === providerId);

    if (provider) {
      provider.oauthToken = oauthToken;
      config.value = newConfig; // Optimistic update

      try {
        const response = await fetch('http://localhost:3000/config/set', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConfig),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        await fetchConfig(); // Refresh from server to be sure
      } catch (e: any) {
        error.value = e.message;
        await fetchConfig(); // Revert on failure
      }
    }
  }

  async function fetchCurrentLogLevel() {
    try {
      const response = await fetch('http://localhost:3000/admin/logging/level');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      logLevel.value = data.level;
      return data.level;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    }
  }

  async function updateLogLevel(level: string) {
    try {
      const response = await fetch('http://localhost:3000/admin/logging/level', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      logLevel.value = level;
      return data;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    }
  }

  return { 
    config, 
    loading, 
    error, 
    logLevel,
    fetchConfig, 
    updateProviderOAuthToken,
    fetchCurrentLogLevel,
    updateLogLevel 
  };
});