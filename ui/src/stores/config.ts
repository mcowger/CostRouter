import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { AppConfig } from '#schemas/appConfig.schema';

export const useConfigStore = defineStore('config', () => {
  const config = ref<AppConfig | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

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

  return { config, loading, error, fetchConfig, updateProviderOAuthToken };
});