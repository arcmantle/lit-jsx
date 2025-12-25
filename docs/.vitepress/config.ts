import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitepress';

const __dirname = dirname(fileURLToPath(import.meta.url));


export default defineConfig({
	title:       'lit-jsx',
	description: 'A JSX runtime and compiler that transforms JSX into Lit templates',

	base: '/lit-jsx/',

	themeConfig: {
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Guide', link: '/guide/getting-started' },
			{ text: 'API', link: '/api/index' },
		],

		sidebar: {
			'/guide/': [
				{
					text:  'Introduction',
					items: [
						{ text: 'Getting Started', link: '/guide/getting-started' },
						{ text: 'Installation', link: '/guide/installation' },
					],
				},
				{
					text:  'Core Concepts',
					items: [
						{ text: 'JSX Syntax', link: '/guide/jsx-syntax' },
						{ text: 'Components', link: '/guide/components' },
						{ text: 'Functional Components', link: '/guide/functional-components' },
						{ text: 'Custom Elements', link: '/guide/custom-elements' },
						{ text: 'Bindings', link: '/guide/bindings' },
						{ text: 'Directives', link: '/guide/directives' },
					],
				},
				{
					text:  'Advanced',
					items: [
						{ text: 'Vite Plugin', link: '/guide/vite-plugin' },
						{ text: 'TypeScript', link: '/guide/typescript' },
						{ text: 'Performance', link: '/guide/performance' },
					],
				},
			],
			'/api/': generateApiSidebar(),
		},

		socialLinks: [ { icon: 'github', link: 'https://github.com/arcmantle/lit-jsx' } ],

		search: {
			provider: 'local',
		},

		footer: {
			message:   'Released under the Apache-2.0 License.',
			copyright: 'Copyright © 2025 Kristoffer Roen-Lie',
		},
	},
});


/**
 * Generate sidebar items from TypeDoc output directory
 */
function generateApiSidebar() {
	const apiRefPath = resolve(__dirname, '../api/reference');

	const items: any[] = [
		{
			text:  'API Reference',
			items: [
				{ text: 'Overview', link: '/api/index' },
				{ text: 'Complete API', link: '/api/reference/README' },
			],
		},
	];

	try {
		const entries = readdirSync(apiRefPath, { withFileTypes: true });

		// Process directories (categories like compiler, runtime, shared)
		const directories = entries
			.filter(entry => entry.isDirectory())
			.sort((a, b) => a.name.localeCompare(b.name));

		for (const dir of directories) {
			const categoryPath = join(apiRefPath, dir.name);
			const files = readdirSync(categoryPath)
				.filter(file => file.endsWith('.md'))
				.map(file => {
					const name = file.replace('.md', '');
					const displayName = name
						.split('-')
						.map(word => word.charAt(0).toUpperCase() + word.slice(1))
						.join(' ');

					return {
						text: displayName,
						link: `/api/reference/${ dir.name }/${ name }`,
					};
				})
				.sort((a, b) => a.text.localeCompare(b.text));

			if (files.length > 0) {
				items.push({
					text:      dir.name.charAt(0).toUpperCase() + dir.name.slice(1),
					collapsed: false,
					items:     files,
				});
			}
		}

		// Process top-level markdown files (like utils.md, external.md)
		const mdFiles = entries
			.filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
			.sort((a, b) => a.name.localeCompare(b.name));

		for (const file of mdFiles) {
			const name = file.name.replace('.md', '');
			const displayName = name
				.split('-')
				.map(word => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' ');

			items.push({
				text:  displayName,
				items: [ { text: displayName, link: `/api/reference/${ name }` } ],
			});
		}
	}
	catch {
		// Directory doesn't exist yet, return minimal sidebar
	}

	return items;
}
