<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useConfigStore } from './stores/config';
import UsageDashboard from './components/UsageDashboard.vue';
import Configuration from './components/Configuration.vue';

const configStore = useConfigStore();
const activeTab = ref<'dashboard' | 'config'>('dashboard');

onMounted(() => {
  configStore.fetchConfig();
});
</script>

<template>
  <div id="app">
    <header class="app-header">
      <nav class="tab-nav">
        <button
          @click="activeTab = 'dashboard'"
          :class="{ active: activeTab === 'dashboard' }"
          class="tab-button"
        >
          Usage Dashboard
        </button>
        <button
          @click="activeTab = 'config'"
          :class="{ active: activeTab === 'config' }"
          class="tab-button"
        >
          Configuration
        </button>
      </nav>
    </header>

    <main class="app-main">
      <UsageDashboard v-if="activeTab === 'dashboard'" />

      <Configuration v-else-if="activeTab === 'config'" />
    </main>
  </div>
</template>

<style scoped>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--color-text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
  padding: 20px;
  text-align: center;
}

.tab-nav {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.tab-button {
  padding: 10px 20px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.tab-button:hover {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}

.tab-button.active {
  background: #3498db;
  color: white !important;
  border-color: #3498db;
}

.app-main {
  flex: 1;
  padding: 0;
}

.config-section {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.config-section h2 {
  text-align: center;
  margin-bottom: 30px;
  color: var(--color-heading);
}

pre {
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  padding: 15px;
  border-radius: 5px;
  text-align: left;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-width: 800px;
  margin: 20px auto;
  font-size: 12px;
  line-height: 1.4;
}

.error {
  color: #e74c3c;
  font-weight: bold;
  background-color: #fdf2f2;
  border: 1px solid #f5c6cb;
  border-radius: 5px;
  padding: 15px;
  margin: 20px auto;
  max-width: 600px;
}

@media (max-width: 768px) {
  .tab-nav {
    flex-direction: column;
    align-items: center;
  }

  .tab-button {
    width: 200px;
  }
}
</style>
