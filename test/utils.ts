export type BabelPlugins = NonNullable<NonNullable<babel.TransformOptions['parserOpts']>['plugins']>;


/**
 * Removes common leading whitespace from template strings to allow for clean indentation
 */
export const dedent = (str: string): string => {
	const lines = str.split('\n');

	// Remove leading and trailing empty lines
	while (lines.length > 0 && lines[0]?.trim() === '')
		lines.shift();

	while (lines.length > 0 && lines[lines.length - 1]?.trim() === '')
		lines.pop();

	if (lines.length === 0)
		return '';

	// Find the minimum indentation (excluding empty lines)
	const nonEmptyLines = lines.filter(line => line.trim() !== '');

	if (nonEmptyLines.length === 0)
		return '';

	const minIndent = Math.min(...nonEmptyLines.map(line => {
		const match = line.match(/^(\s*)/);

		return match?.[1]?.length ?? 0;
	}));

	// Remove the common indentation from all lines
	const dedentedLines = lines.map(line => {
		if (line.trim() === '')
			return '';

		return line.slice(minIndent);
	});

	return dedentedLines.join('\n');
};
