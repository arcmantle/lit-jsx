import { defineConfig } from 'vitest/config';
import type { TestUserConfig } from 'vitest/node';


export default defineConfig({
	test: {
		environment: 'node',
		globals:     true,
	},
}) as TestUserConfig;
