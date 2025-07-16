<script lang="ts">
	import type { Model } from '$schemas/model.schema';
	export let models: Model[] = [];
</script>

<div class="space-y-4">
	{#each models as model (model.name)}
		<div class="grid grid-cols-1 gap-4">
			<!-- Model Name Input -->
			<label class="form-control w-full">
				<div class="label">
					<span class="label-text">Model Name</span>
				</div>
				<input type="text" bind:value={model.name} class="input input-bordered w-full" />
			</label>
		</div>
	{/each}
</div>
