import { writable } from 'svelte/store';
import type { AppConfig } from '$schemas/appConfig.schema.js';

/**
 * A Svelte store to hold the global application configuration.
 * It is initialized with an empty providers array.
 */
export const configStore = writable<AppConfig>({ providers: [] });
