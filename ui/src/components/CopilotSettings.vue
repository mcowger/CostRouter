<template>
  <div class="copilot-settings">
    <h3>GitHub Copilot Authentication</h3>
    <div v-if="!isAuthorized">
      <p>Connect your GitHub account to use Copilot models.</p>
      <button @click="startAuth" :disabled="isLoading">
        {{ isLoading ? 'Waiting...' : 'Connect to GitHub' }}
      </button>
      <div v-if="authData" class="auth-details">
        <p>1. Go to: <a :href="authData.verification_uri" target="_blank">{{ authData.verification_uri }}</a></p>
        <p>2. Enter this code: <strong>{{ authData.user_code }}</strong></p>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
    <div v-else>
      <p class="success">Successfully authorized with GitHub.</p>
      <button @click="disconnect">Disconnect</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import axios from 'axios';
import { useConfigStore } from '../stores/config';
import type { Provider } from '../../../schemas/provider.schema';

const props = defineProps({
  providerId: {
    type: String,
    required: true,
  },
});

const configStore = useConfigStore();
const isLoading = ref(false);
const isAuthorized = ref(false);
const authData = ref<any>(null);
const error = ref<string | null>(null);
const pollController = ref<{ stop: () => void } | null>(null);

watch(() => configStore.config, (newConfig) => {
  const provider = newConfig?.providers.find((p: Provider) => p.id === props.providerId);
  isAuthorized.value = !!provider?.oauthToken;
}, { immediate: true, deep: true });

async function startAuth() {
  isLoading.value = true;
  error.value = null;
  authData.value = null;

  try {
    const response = await axios.post('http://localhost:3000/api/copilot/auth/start');
    authData.value = response.data;
    pollController.value = pollForToken(response.data.device_code, response.data.interval);
  } catch (err) {
    error.value = 'Failed to start authentication. Please try again.';
    isLoading.value = false;
  }
}

function pollForToken(deviceCode: string, initialInterval: number) {
  let isStopped = false;
  let currentInterval = (initialInterval || 5) * 1000;
  let timeoutId: number | null = null;

  const poll = async () => {
    if (isStopped) return;

    try {
      const response = await axios.post('http://localhost:3000/api/copilot/auth/poll', {
        device_code: deviceCode,
        providerId: props.providerId,
      });

      const data = response.data;

      if (data.access_token) {
        isLoading.value = false;
        authData.value = null;
        await configStore.fetchConfig();
        stop();
        return;
      }

      if (data.error === 'authorization_pending') {
        // Continue polling at the current interval
      } else if (data.error === 'slow_down') {
        currentInterval += 5000; // Increase interval by 5 seconds
        error.value = `Polling too frequently. Increasing delay to ${currentInterval / 1000}s.`;
      } else {
        error.value = data.error_description || 'An error occurred during authorization.';
        stop();
        return;
      }
    } catch (err) {
      error.value = 'Failed to poll for token. Please try again.';
      stop();
      return;
    }

    if (!isStopped) {
      timeoutId = setTimeout(poll, currentInterval);
    }
  };

  const stop = () => {
    isStopped = true;
    if (timeoutId) clearTimeout(timeoutId);
    isLoading.value = false;
  };

  // Start the first poll after an initial delay
  timeoutId = setTimeout(poll, currentInterval);

  return { stop };
}

async function disconnect() {
  await configStore.updateProviderOAuthToken(props.providerId, undefined);
}

watch(() => props.providerId, () => {
  pollController.value?.stop();
  isLoading.value = false;
  authData.value = null;
  error.value = null;
});

onUnmounted(() => {
  pollController.value?.stop();
});
</script>

<style scoped>
.copilot-settings {
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-top: 1rem;
}
.auth-details {
  margin-top: 1rem;
  padding: 1rem;
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
}
.error {
  color: #d9534f;
}
.success {
  color: #5cb85c;
}
</style>
