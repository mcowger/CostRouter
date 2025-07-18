import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { AppConfig } from '../../../schemas/appConfig.schema';

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

  return { config, loading, error, fetchConfig };
});