import ts from 'typescript';


export interface ImportInfo {
	/** The import specifier (e.g., './MyComponent') */
	specifier:    string;
	/** The resolved absolute file path */
	resolvedPath: string;
	/** The file content if successfully loaded */
	content?:     string;
}

/**
 * Discover and resolve all imports from a source file.
 * @param filename - The absolute path of the file to analyze
 * @param code - The source code content
 * @param compilerOptions - TypeScript compiler options for resolution
 * @returns Array of resolved import information
 */
export const discoverImports = (
	filename: string,
	code: string,
	compilerOptions: ts.CompilerOptions,
): ImportInfo[] => {
	const normalizedFilename = filename.replace(/\\/g, '/');
	const imports: ImportInfo[] = [];

	// Parse the source file to extract imports
	const tempSourceFile = ts.createSourceFile(
		normalizedFilename,
		code,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);

	ts.forEachChild(tempSourceFile, function visit(node) {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			const importPath = node.moduleSpecifier.text;
			const resolution = ts.resolveModuleName(
				importPath,
				normalizedFilename,
				compilerOptions,
				ts.sys,
			);

			if (resolution.resolvedModule?.resolvedFileName) {
				const resolvedPath = resolution.resolvedModule.resolvedFileName.replace(/\\/g, '/');
				const importInfo: ImportInfo = {
					specifier:    importPath,
					resolvedPath: resolvedPath,
				};

				// Try to load the file content
				if (ts.sys.fileExists(resolvedPath)) {
					const content = ts.sys.readFile(resolvedPath);
					if (content)
						importInfo.content = content;
				}

				imports.push(importInfo);
			}
		}

		ts.forEachChild(node, visit);
	});

	return imports;
};

/**
 * Detect the TypeScript ScriptKind from a file extension.
 * @param filePath - The file path to analyze
 * @returns The appropriate ScriptKind for the file
 */
export const detectScriptKind = (filePath: string): ts.ScriptKind => {
	if (filePath.endsWith('.tsx'))
		return ts.ScriptKind.TSX;

	if (filePath.endsWith('.ts'))
		return ts.ScriptKind.TS;

	if (filePath.endsWith('.jsx'))
		return ts.ScriptKind.JSX;

	if (filePath.endsWith('.js'))
		return ts.ScriptKind.JS;

	return ts.ScriptKind.Unknown;
};
