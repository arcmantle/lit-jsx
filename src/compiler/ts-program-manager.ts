import type { BabelFile } from '@babel/core';
import ts from 'typescript';


// Language Service state - persists across transforms
let languageService: ts.LanguageService | undefined;
let compilerOptions: ts.CompilerOptions | undefined;
let moduleResolutionCache: ts.ModuleResolutionCache | undefined;
const fileVersions: Map<string, number> = new Map();
const fileContents: Map<string, string> = new Map();
const scriptKinds: Map<string, ts.ScriptKind> = new Map();
const importMaps: Map<string, Map<string, string>> = new Map(); // filename -> (symbolName -> resolvedPath)
const typeCheckCache: Map<string, Map<string, boolean | undefined>> = new Map(); // filename -> (symbolName -> isStatic)

// ScriptKind lookup table for O(1) extension detection
const extensionToScriptKind: Map<string, ts.ScriptKind> = new Map([
	[ '.tsx', ts.ScriptKind.TSX ],
	[ '.ts', ts.ScriptKind.TS ],
	[ '.jsx', ts.ScriptKind.JSX ],
	[ '.js', ts.ScriptKind.JS ],
]);

/**
 * Centralized path normalization to convert backslashes to forward slashes.
 */
function normalizePath(path: string): string {
	return path.replace(/\\/g, '/');
}

/**
 * Detect the TypeScript ScriptKind from a file extension.
 */
function detectScriptKind(filePath: string): ts.ScriptKind {
	const lastDot = filePath.lastIndexOf('.');
	if (lastDot === -1)
		return ts.ScriptKind.Unknown;

	const ext = filePath.slice(lastDot);

	return extensionToScriptKind.get(ext) ?? ts.ScriptKind.Unknown;
}

/** Get the TypeScript type checker for use in other compiler modules */
export const getTypeChecker = (): ts.TypeChecker | undefined => {
	return languageService?.getProgram()?.getTypeChecker();
};

/** Get the TypeScript program for use in other compiler modules */
export const getTsProgram = (): ts.Program | undefined => {
	return languageService?.getProgram();
};

/** Get cached source file for a given filename */
export const getSourceFile = (filename: string): ts.SourceFile | undefined => {
	const normalizedFilename = normalizePath(filename);

	return languageService?.getProgram()?.getSourceFile(normalizedFilename);
};

/** Get cached type-check result for a symbol */
export const getCachedTypeCheck = (filename: string, symbolName: string): boolean | undefined => {
	const normalized = normalizePath(filename);

	return typeCheckCache.get(normalized)?.get(symbolName);
};

/** Check if type-check result is cached for a symbol */
export const hasCachedTypeCheck = (filename: string, symbolName: string): boolean => {
	const normalized = normalizePath(filename);

	return typeCheckCache.get(normalized)?.has(symbolName) ?? false;
};

/** Cache type-check result for a symbol */
export const setCachedTypeCheck = (filename: string, symbolName: string, result: boolean | undefined): void => {
	const normalized = normalizePath(filename);
	let cache = typeCheckCache.get(normalized);
	if (!cache) {
		cache = new Map();
		typeCheckCache.set(normalized, cache);
	}

	cache.set(symbolName, result);
};

/**
 * Initialize TypeScript Language Service for type inference.
 * Creates service once, then incrementally updates on each file transform.
 * Much faster for dev servers with HMR!
 */
export const initializeTypeInference = (file: BabelFile): void => {
	if (!file.opts.filename)
		return;

	const normalizedFilename = normalizePath(file.opts.filename);

	// Initialize Language Service on first use
	if (!languageService) {
		// Auto-discover tsconfig
		const tsConfigPath = ts.findConfigFile(
			normalizedFilename,
			ts.sys.fileExists,
			'tsconfig.json',
		);

		// Load compiler options from tsconfig
		if (tsConfigPath) {
			const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
			const parsedConfig = ts.parseJsonConfigFileContent(
				configFile.config,
				ts.sys,
				ts.sys.getCurrentDirectory(),
			);
			compilerOptions = parsedConfig.options;
		}
		else {
			compilerOptions = {
				target:           ts.ScriptTarget.Latest,
				module:           ts.ModuleKind.ESNext,
				jsx:              ts.JsxEmit.Preserve,
				moduleResolution: ts.ModuleResolutionKind.Bundler,
			};
		}

		// Create module resolution cache for faster import resolution
		moduleResolutionCache = ts.createModuleResolutionCache(
			ts.sys.getCurrentDirectory(),
			fileName => fileName,
			compilerOptions,
		);

		// Create Language Service Host
		const host: ts.LanguageServiceHost = {
			getScriptFileNames: () => Array.from(fileContents.keys()),
			getScriptVersion:   (fileName) => {
				const normalized = normalizePath(fileName);

				return String(fileVersions.get(normalized) ?? 0);
			},
			getScriptSnapshot: (fileName) => {
				const normalized = normalizePath(fileName);
				const content = fileContents.get(normalized);
				if (content !== undefined)
					return ts.ScriptSnapshot.fromString(content);

				// Fallback to disk for imports
				if (ts.sys.fileExists(fileName))
					return ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName) || '');

				return undefined;
			},
			getScriptKind: (fileName) => {
				const normalized = normalizePath(fileName);

				return scriptKinds.get(normalized) ?? ts.ScriptKind.Unknown;
			},
			getCurrentDirectory:    ts.sys.getCurrentDirectory,
			getCompilationSettings: () => compilerOptions!,
			getDefaultLibFileName:  (options) => ts.getDefaultLibFilePath(options),
			fileExists:             (fileName) => {
				const normalized = normalizePath(fileName);

				return fileContents.has(normalized) || ts.sys.fileExists(fileName);
			},
			readFile: (fileName) => {
				const normalized = normalizePath(fileName);

				return fileContents.get(normalized) ?? ts.sys.readFile(fileName);
			},
			resolveModuleNames: (moduleNames, containingFile) => {
				return moduleNames.map(moduleName => {
					const result = ts.resolveModuleName(
						moduleName,
						containingFile,
						compilerOptions!,
						ts.sys,
						moduleResolutionCache,
					);

					return result.resolvedModule;
				});
			},
		};

		languageService = ts.createLanguageService(host, ts.createDocumentRegistry());
	}

	// Update or add file to Language Service
	const currentVersion = fileVersions.get(normalizedFilename) ?? 0;
	const previousContent = fileContents.get(normalizedFilename);

	// Only increment version if content actually changed
	if (previousContent !== file.code) {
		fileVersions.set(normalizedFilename, currentVersion + 1);
		fileContents.set(normalizedFilename, file.code);
		scriptKinds.set(normalizedFilename, ts.ScriptKind.TSX);

		// Clear cached type-check results for this file since content changed
		typeCheckCache.delete(normalizedFilename);
	}
};

/**
 * Check if a file re-exports a symbol and return the source file path.
 * Handles: export { X } from './file', export { X as Y } from './file', export * from './file'
 */
function findReExportSource(
	filePath: string,
	symbolName: string,
): string | undefined {
	if (!compilerOptions || !moduleResolutionCache || !languageService)
		return undefined;

	const normalizedPath = normalizePath(filePath);

	// Use cached source file from Language Service instead of creating new one
	const sourceFile = languageService.getProgram()?.getSourceFile(normalizedPath);
	if (!sourceFile)
		return undefined;

	for (const statement of sourceFile.statements) {
		// Check: export { X } from './file' or export { X as Y } from './file'
		if (ts.isExportDeclaration(statement) &&
			statement.moduleSpecifier &&
			ts.isStringLiteral(statement.moduleSpecifier)) {
			const exportPath = statement.moduleSpecifier.text;
			let isReExported = false;

			// export * from './file' - re-exports everything
			if (!statement.exportClause) {
				isReExported = true;
			}
			// export { X, Y } from './file'
			else if (ts.isNamedExports(statement.exportClause)) {
				for (const element of statement.exportClause.elements) {
					// Check original name (before 'as')
					const originalName = element.propertyName?.text || element.name.text;
					if (originalName === symbolName || element.name.text === symbolName) {
						isReExported = true;
						break;
					}
				}
			}

			if (isReExported) {
				// Resolve the re-export source
				const resolution = ts.resolveModuleName(
					exportPath,
					normalizedPath,
					compilerOptions,
					ts.sys,
					moduleResolutionCache,
				);

				if (resolution.resolvedModule?.resolvedFileName)
					return normalizePath(resolution.resolvedModule.resolvedFileName);
			}
		}
	}

	return undefined;
}

/**
 * Helper function to resolve and load an import path.
 * Shared by both static and dynamic import handling.
 */
function resolveAndLoadImport(
	importPath: string,
	containingFile: string,
	importMap: Map<string, string>,
	symbolName: string,
): string | undefined {
	if (!compilerOptions || !moduleResolutionCache)
		return undefined;

	// Resolve the module using TypeScript's resolution with cache
	const resolution = ts.resolveModuleName(
		importPath,
		containingFile,
		compilerOptions,
		ts.sys,
		moduleResolutionCache,
	);

	if (resolution.resolvedModule?.resolvedFileName) {
		const resolvedPath = normalizePath(resolution.resolvedModule.resolvedFileName);

		// Cache the mapping
		importMap.set(symbolName, resolvedPath);

		// Lazy-load: Only load if not already in Language Service
		if (!fileContents.has(resolvedPath)) {
			const content = ts.sys.readFile(resolvedPath);
			if (content) {
				fileContents.set(resolvedPath, content);
				fileVersions.set(resolvedPath, 1);
				scriptKinds.set(resolvedPath, detectScriptKind(resolvedPath));
			}
		}

		// Check if this file re-exports the symbol from another file
		// This handles barrel exports: export { Component } from './component'
		// Follow re-export chain recursively
		let currentSource = resolvedPath;
		let depth = 0;
		const maxDepth = 10; // Prevent infinite loops

		while (depth < maxDepth) {
			const nextSource = findReExportSource(currentSource, symbolName);
			if (!nextSource || fileContents.has(nextSource))
				break;

			const nextContent = ts.sys.readFile(nextSource);
			if (!nextContent)
				break;

			fileContents.set(nextSource, nextContent);
			fileVersions.set(nextSource, 1);
			scriptKinds.set(nextSource, detectScriptKind(nextSource));

			currentSource = nextSource;
			depth++;
		}

		return resolvedPath;
	}

	return undefined;
}

/**
 * Recursively check for dynamic imports in AST nodes.
 * Looks for: const { Component } = await import('./mod') or const mod = await import('./mod')
 */
function checkDynamicImports(
	node: ts.Node,
	symbolName: string,
	normalizedFile: string,
	importMap: Map<string, string>,
): boolean {
	// Look for variable statements with dynamic imports
	if (ts.isVariableStatement(node)) {
		for (const declaration of node.declarationList.declarations) {
			const init = declaration.initializer;

			// Handle: await import('...')
			let importCall: ts.CallExpression | undefined;
			if (init && ts.isAwaitExpression(init) && ts.isCallExpression(init.expression))
				importCall = init.expression;
			// Handle: import('...')
			else if (init && ts.isCallExpression(init))
				importCall = init;

			if (importCall &&
				importCall.expression.kind === ts.SyntaxKind.ImportKeyword &&
				importCall.arguments.length > 0) {
				const firstArg = importCall.arguments[0];
				if (!firstArg || !ts.isStringLiteral(firstArg))
					continue;

				const importPath = firstArg.text;
				let matchesSymbol = false;

				// Check if the symbol matches the variable name
				if (ts.isIdentifier(declaration.name) && declaration.name.text === symbolName) { matchesSymbol = true; }
				// Check destructured imports: const { Component } = await import('...')
				else if (ts.isObjectBindingPattern(declaration.name)) {
					for (const element of declaration.name.elements) {
						if (ts.isIdentifier(element.name) && element.name.text === symbolName) {
							matchesSymbol = true;
							break;
						}
					}
				}

				if (matchesSymbol) {
					const resolvedPath = resolveAndLoadImport(importPath, normalizedFile, importMap, symbolName);
					if (resolvedPath)
						return true; // Found it!
				}
			}
		}
	}

	// Continue traversing
	return ts.forEachChild(node, n => checkDynamicImports(n, symbolName, normalizedFile, importMap)) || false;
}

/**
 * Lazy-load an imported file when its symbol is referenced.
 * Supports both static imports (import X from 'Y') and dynamic imports (await import('Y')).
 * Uses Language Service's AST to find the import declaration, then loads the file on-demand.
 * @param symbolName - The name of the symbol being referenced (e.g., 'MyComponent')
 * @param containingFile - The file that references the symbol
 */
export const ensureImportLoaded = (symbolName: string, containingFile: string): void => {
	if (!languageService || !compilerOptions)
		return;

	const normalizedFile = normalizePath(containingFile);

	// Check import map cache first (10x faster for files with multiple JSX elements)
	const cached = importMaps.get(normalizedFile);
	if (cached) {
		const resolvedPath = cached.get(symbolName);
		if (resolvedPath) {
			// Already discovered and loaded this import
			return;
		}
	}

	const program = languageService.getProgram();
	const sourceFile = program?.getSourceFile(normalizedFile);
	if (!sourceFile)
		return;

	// Initialize import map for this file if needed
	const importMap = cached || new Map<string, string>();
	if (!cached)
		importMaps.set(normalizedFile, importMap);

	// Single pass: check both static and dynamic imports
	for (const statement of sourceFile.statements) {
		// Check static imports
		if (ts.isImportDeclaration(statement) && statement.importClause) {
			const importClause = statement.importClause;
			let matchesSymbol = false;

			// Check default import: import MyComponent from './module'
			if (importClause.name?.text === symbolName)
				matchesSymbol = true;

			// Check named imports: import { MyComponent } from './module'
			if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
				for (const element of importClause.namedBindings.elements) {
					if (element.name.text === symbolName) {
						matchesSymbol = true;
						break;
					}
				}
			}

			// Check namespace import: import * as Module from './module'
			if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
				if (importClause.namedBindings.name.text === symbolName)
					matchesSymbol = true;
			}

			if (matchesSymbol && ts.isStringLiteral(statement.moduleSpecifier)) {
				const importPath = statement.moduleSpecifier.text;
				const resolvedPath = resolveAndLoadImport(importPath, normalizedFile, importMap, symbolName);
				if (resolvedPath)
					break; // Found in static import
			}
		}
		// Check for dynamic imports in this statement
		else if (checkDynamicImports(statement, symbolName, normalizedFile, importMap)) {
			break; // Found in dynamic import
		}
	}
};

/**
 * Clean up TypeScript Language Service.
 * In dev mode, you may want to keep it alive across transforms.
 */
export const cleanupTypeInference = (): void => {
	languageService?.dispose();
	languageService = undefined;
	compilerOptions = undefined;
	moduleResolutionCache = undefined;
	fileVersions.clear();
	fileContents.clear();
	scriptKinds.clear();
	importMaps.clear();
	typeCheckCache.clear();
};
