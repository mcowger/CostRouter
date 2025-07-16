<script lang="ts">
	import type { Limits } from '$schemas/limits.schema';
	export let limits: Limits | undefined = {};
</script>

<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
	<!-- Requests/Min Input -->
	<label class="form-control w-full">
		<div class="label">
			<span class="label-text">Requests/Min</span>
		</div>
		<input type="number" bind:value={limits.requestsPerMinute} class="input input-bordered w-full" />
	</label>

	<!-- Requests/Hour Input -->
	<label class="form-control w-full">
		<div class="label">
			<span class="label-text">Requests/Hour</span>
		</div>
		<input type="number" bind:value={limits.requestsPerHour} class="input input-bordered w-full" />
	</label>

	<!-- Requests/Day Input -->
	<label class="form-control w-full">
		<div class="label">
			<span class="label-text">Requests/Day</span>
		</div>
		<input type="number" bind:value={limits.requestsPerDay} class="input input-bordered w-full" />
	</label>

	<!-- Tokens/Min Input -->
	<label class="form-control w-full">
		<div class="label">
			<span class="label-text">Tokens/Min</span>
		</div>
		<input type="number" bind:value={limits.tokensPerMinute} class="input input-bordered w-full" />
	</label>

	<!-- Tokens/Hour Input -->
	<label class="form-control w-full">
		<div class="label">
			<span class="label-text">Tokens/Hour</span>
		</div>
		<input type="number" bind:value={limits.tokensPerHour} class="input input-bordered w-full" />
	</label>

	<!-- Tokens/Day Input -->
	<label class="form-control w-full">
		<div class="label">
			<span class="label-text">Tokens/Day</span>
		</div>
		<input type="number" bind:value={limits.tokensPerDay} class="input input-bordered w-full" />
	</label>

	<!-- Cost/Min Input -->
	<label class="form-control w-full">
		<div class="label">
			<span class="label-text">Cost/Min</span>
		</div>
		<input type="number" step="0.01" bind:value={limits.costPerMinute} class="input input-bordered w-full" />
	</label>

	<!-- Cost/Hour Input -->
	<label class="form-control w-full">
		<div class="label">
			<span class="label-text">Cost/Hour</span>
		</div>
		<input type="number" step="0.01" bind:value={limits.costPerHour} class="input input-bordered w-full" />
	</label>

	<!-- Cost/Day Input -->
	<label class="form-control w-full">
		<div class="label">
			<span class="label-text">Cost/Day</span>
		</div>
		<input type="number" step="0.01" bind:value={limits.costPerDay} class="input input-bordered w-full" />
	</label>
</div>
