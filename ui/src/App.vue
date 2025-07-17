<script setup lang="ts">
import { onMounted } from 'vue';
import { useConfigStore } from './stores/config';

const configStore = useConfigStore();

onMounted(() => {
  configStore.fetchConfig();
});
</script>

<template>
  <div id="app">
    <h1>LLM Gateway Configuration</h1>
    <div v-if="configStore.loading">Loading configuration...</div>
    <div v-else-if="configStore.error" class="error">{{ configStore.error }}</div>
    <div v-else-if="configStore.config">
      <pre>{{ JSON.stringify(configStore.config, null, 2) }}</pre>
    </div>
    <div v-else>No configuration loaded.</div>
  </div>
</template>

<style scoped>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

pre {
  background-color: #f4f4f4;
  padding: 15px;
  border-radius: 5px;
  text-align: left;
  white-space: pre-wrap;       /* css-3 */
  white-space: -moz-pre-wrap;  /* Mozilla, since 1999 */
  white-space: -pre-wrap;      /* Opera 4-6 */
  white-space: -o-pre-wrap;    /* Opera 7 */
  word-wrap: break-word;       /* Internet Explorer 5.5+ */
  max-width: 800px;
  margin: 20px auto;
}

.error {
  color: red;
  font-weight: bold;
}
</style>
