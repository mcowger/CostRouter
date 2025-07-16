import type { PageServerLoad } from './$types';
//import type { ServerLoad } from '@sveltejs/kit'; // Or ServerLoad from '@sveltejs/kit'
import type { AppConfig } from '$schemas/appConfig.schema.js';
import { error } from '@sveltejs/kit';

const CONFIG_API_URL = 'http://localhost:3000/config/get';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch(CONFIG_API_URL);
		if (!response.ok) {
			throw error(response.status, `Failed to fetch config: ${response.statusText}`);
		}
		const config: AppConfig = await response.json();
		return {
			config
		};
	} catch (err) {
		if (err instanceof Error) {
			console.error('Error fetching config:', err.message);
			throw error(500, `Could not load configuration from the gateway server: ${err.message}`);
		}
		throw error(500, 'An unknown error occurred while loading configuration.');
	}
};
