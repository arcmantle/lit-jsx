import { defineConfig } from 'vitest/config';
import type { UserConfig } from 'vitest/node';


export default defineConfig({
	test: {
		environment: 'node',
		globals:     true,
	},
}) as UserConfig;
