<script lang="ts">
	import { configStore } from '$lib/stores/configStore';
	import type { PageData } from './$types';

	export let data: PageData;

	// Populate the store with the data received from the load function
	if (data.config) {
		configStore.set(data.config);
	}
</script>

<div class="p-8">
	<h1 class="text-2xl font-bold mb-4">Gateway Configuration</h1>
	<pre class="bg-gray-900 p-4 rounded-lg">{JSON.stringify($configStore, null, 2)}</pre>
</div>