<script lang="ts">
	import { configStore } from '$lib/stores/configStore';
	import type { PageData } from './$types';

	import ProviderCard from '$lib/components/ProviderCard.svelte';

	export let data: PageData;

	// Populate the store with the data received from the load function
	if (data.config) {
		configStore.set(data.config);
	}
</script>

<div class="p-8">
<h1 class="text-3xl font-bold mb-6">Gateway Configuration</h1>
	<div class="space-y-4">
		{#each $configStore.providers as provider (provider.id)}
			<ProviderCard {provider} />
		{/each}
	</div>
</div>
