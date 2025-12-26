import type { BabelFile } from '@babel/core';
import ts from 'typescript';


// Store TypeScript program and type checker globally for the plugin instance
export const tsProgram: { value: ts.Program | undefined; } = { value: undefined };
export const typeChecker: { value: ts.TypeChecker | undefined; } = { value: undefined };
export const sourceFileCache: Map<string, ts.SourceFile> = new Map();

/** Get the TypeScript type checker for use in other compiler modules */
export const getTypeChecker = (): ts.TypeChecker | undefined => typeChecker.value;

/** Get the TypeScript program for use in other compiler modules */
export const getTsProgram = (): ts.Program | undefined => tsProgram.value;

/** Get cached source file for a given filename */
export const getSourceFile = (filename: string): ts.SourceFile | undefined => sourceFileCache.get(filename);

/**
 * Initialize TypeScript program for type inference.
 * Called during Babel plugin pre() hook.
 */
export const initializeTypeInference = (file: BabelFile): void => {
	if (!file.opts.filename)
		return;

	const result = createTypeScriptProgram(
		{
			filename:       file.opts.filename,
			code:           file.code,
			resolveImports: true,
		},
		sourceFileCache,
	);

	if (result) {
		tsProgram.value = result.program;
		typeChecker.value = result.typeChecker;
	}
};

/**
 * Clean up TypeScript program after processing.
 * Called during Babel plugin post() hook.
 */
export const cleanupTypeInference = (): void => {
	tsProgram.value = undefined;
	typeChecker.value = undefined;
	sourceFileCache.clear();
};


export interface TypeScriptProgramResult {
	program:         ts.Program;
	typeChecker:     ts.TypeChecker;
	sourceFileCache: Map<string, ts.SourceFile>;
}

export interface CreateProgramOptions {
	filename:       string;
	code:           string;
	resolveImports: boolean;
}

/**
 * Creates a TypeScript program for type inference.
 * Uses lightweight approach: only loads current file + its direct imports.
 */
export const createTypeScriptProgram = (
	options: CreateProgramOptions,
	sourceFileCache: Map<string, ts.SourceFile>,
): TypeScriptProgramResult | undefined => {
	try {
		const normalizedFilename = options.filename.replace(/\\/g, '/');

		// Create source file for current code
		const currentSourceFile = ts.createSourceFile(
			normalizedFilename,
			options.code,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX,
		);
		sourceFileCache.set(normalizedFilename, currentSourceFile);

		// If import resolution disabled, use standalone mode
		if (!options.resolveImports) {
			const host: ts.CompilerHost = {
				...ts.createCompilerHost({}),
				getSourceFile:             (fileName) => fileName === normalizedFilename ? currentSourceFile : undefined,
				fileExists:                (fileName) => fileName === normalizedFilename,
				readFile:                  (fileName) => fileName === normalizedFilename ? options.code : undefined,
				getCurrentDirectory:       () => ts.sys.getCurrentDirectory(),
				getDirectories:            (path) => ts.sys.getDirectories(path),
				getCanonicalFileName:      (fileName) => fileName,
				useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
				getNewLine:                () => ts.sys.newLine,
			};

			const program = ts.createProgram({
				rootNames: [ normalizedFilename ],
				options:   {
					target: ts.ScriptTarget.Latest,
					module: ts.ModuleKind.ESNext,
					jsx:    ts.JsxEmit.Preserve,
				},
				host,
			});

			return {
				program,
				typeChecker: program.getTypeChecker(),
				sourceFileCache,
			};
		}

		// Auto-discover tsconfig for import resolution
		const tsConfigPath = ts.findConfigFile(
			normalizedFilename,
			ts.sys.fileExists,
			'tsconfig.json',
		);

		if (!tsConfigPath) {
			// No tsconfig found, fall back to standalone mode
			return createTypeScriptProgram({ ...options, resolveImports: false }, sourceFileCache);
		}

		// Load tsconfig for module resolution settings
		const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
		const parsedConfig = ts.parseJsonConfigFileContent(
			configFile.config,
			ts.sys,
			ts.sys.getCurrentDirectory(),
		);

		// Collect only the files we need: current file + resolved imports
		const filesToInclude: Set<string> = new Set([ normalizedFilename ]);
		const resolvedModules: Map<string, string> = new Map();

		// Find all import declarations in the current file
		ts.forEachChild(currentSourceFile, function visit(node) {
			if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
				const importPath = node.moduleSpecifier.text;

				// Resolve the import to an actual file path
				const resolution = ts.resolveModuleName(
					importPath,
					normalizedFilename,
					parsedConfig.options,
					ts.sys,
				);

				if (resolution.resolvedModule?.resolvedFileName) {
					const resolvedPath = resolution.resolvedModule.resolvedFileName.replace(/\\/g, '/');
					filesToInclude.add(resolvedPath);
					resolvedModules.set(importPath, resolvedPath);
				}
			}

			ts.forEachChild(node, visit);
		});

		// Create a minimal compiler host with only required files
		const defaultHost = ts.createCompilerHost(parsedConfig.options);
		const host: ts.CompilerHost = {
			...defaultHost,
			getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
				const normalizedFileName = fileName.replace(/\\/g, '/');

				// Return the current file from memory
				if (normalizedFileName === normalizedFilename)
					return currentSourceFile;


				// Only load files that are actually imported
				if (filesToInclude.has(normalizedFileName))
					return defaultHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);


				return undefined;
			},
		};

		const program = ts.createProgram({
			rootNames: Array.from(filesToInclude),
			options:   parsedConfig.options,
			host,
		});

		return {
			program,
			typeChecker: program.getTypeChecker(),
			sourceFileCache,
		};
	}
	catch (error) {
		// Silently fail if TypeScript program creation fails
		return undefined;
	}
};
