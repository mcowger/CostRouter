
<script lang="ts">
	import type { Provider } from '$schemas/provider.schema';


	import LimitsForm from './LimitsForm.svelte';
	import ModelsForm from './ModelsForm.svelte';

	export let provider: Provider;

	const providerTypes = [
		{ value: 'openai', name: 'OpenAI' },
		{ value: 'custom', name: 'Custom' },
		{ value: 'copilot', name: 'Copilot' }
	];
</script>

<div class="card w-1/2 bg-neutral text-neutral-content shadow-xl">
	<div class="card-body">
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<!-- Provider ID Input -->
			<label class="form-control w-full">
				<div class="label">
					<span class="label-text">Provider ID</span>
				</div>
				<input type="text" bind:value={provider.id} class="input input-bordered w-full" />
			</label>

			<!-- Provider Type Select -->
			<label class="form-control w-full">
				<div class="label">
					<span class="label-text">Provider Type</span>
				</div>
				<select bind:value={provider.type} class="select select-bordered w-full">
					{#each providerTypes as type (type.value)} <!-- ADDED KEY HERE -->
						<option value={type.value}>{type.name}</option>
					{/each}
				</select>
			</label>

			<!-- Base URL Input -->
			<label class="form-control w-full md:col-span-2">
				<div class="label">
					<span class="label-text">Base URL</span>
				</div>
				<input
					type="text"
					bind:value={provider.baseURL}
					disabled={provider.type !== 'openai'}
          placeholder={provider.type == 'openai' ? "Enter API Key" : "Not required for this provider type"}
					class="input input-bordered w-full"
				/>
			</label>

			<!-- API Key Input -->
			<label class="form-control w-full md:col-span-2">
				<div class="label">
					<span class="label-text">API Key</span>
				</div>
				<input
					type="password"
					bind:value={provider.apiKey}
					disabled={provider.type !== 'openai'}
          placeholder={provider.type == 'openai' ? "Enter API Key" : "Not required for this provider type"}
					class="input input-bordered w-full"
				/>
			</label>
		</div>

		<!-- Converted Accordion component -->
		<!-- DaisyUI 'collapse' component for accordion items -->
		<div class="mt-4 space-y-2">
			<!-- Limits Accordion Item -->
			<div class="collapse collapse-plus bg-base-200">
				<input type="checkbox" />
				<div class="collapse-title text-xl font-medium">Limits</div>
				<div class="collapse-content">
					<LimitsForm bind:limits={provider.limits} />
				</div>
			</div>

			<!-- Models Accordion Item -->
			<div class="collapse collapse-plus bg-base-200">
				<input type="checkbox" />
				<div class="collapse-title text-xl font-medium">Models</div>
				<div class="collapse-content">
					<ModelsForm bind:models={provider.models} />
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* You might need some custom styles here if DaisyUI's defaults aren't exact,
	   e.g., for specific text colors or hover states on form elements that
	   are not covered by DaisyUI's current theme or default utility classes. */
</style>
