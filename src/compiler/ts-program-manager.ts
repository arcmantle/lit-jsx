import type { BabelFile } from '@babel/core';
import ts from 'typescript';

import { detectScriptKind, discoverImports } from './ts-import-resolution.ts';


// Language Service state - persists across transforms
let languageService: ts.LanguageService | undefined;
let compilerOptions: ts.CompilerOptions | undefined;
const fileVersions: Map<string, number> = new Map();
const fileContents: Map<string, string> = new Map();
const scriptKinds: Map<string, ts.ScriptKind> = new Map();

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
	const normalizedFilename = filename.replace(/\\/g, '/');

	return languageService?.getProgram()?.getSourceFile(normalizedFilename);
};

/**
 * Initialize TypeScript Language Service for type inference.
 * Creates service once, then incrementally updates on each file transform.
 * Much faster for dev servers with HMR!
 */
export const initializeTypeInference = (file: BabelFile): void => {
	if (!file.opts.filename)
		return;

	const normalizedFilename = file.opts.filename.replace(/\\/g, '/');

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

		// Create Language Service Host
		const host: ts.LanguageServiceHost = {
			getScriptFileNames: () => Array.from(fileContents.keys()),
			getScriptVersion:   (fileName) => {
				const normalized = fileName.replace(/\\/g, '/');

				return String(fileVersions.get(normalized) ?? 0);
			},
			getScriptSnapshot: (fileName) => {
				const normalized = fileName.replace(/\\/g, '/');
				const content = fileContents.get(normalized);
				if (content !== undefined)
					return ts.ScriptSnapshot.fromString(content);

				// Fallback to disk for imports
				if (ts.sys.fileExists(fileName))
					return ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName) || '');

				return undefined;
			},
			getScriptKind: (fileName) => {
				const normalized = fileName.replace(/\\/g, '/');

				return scriptKinds.get(normalized) ?? ts.ScriptKind.Unknown;
			},
			getCurrentDirectory:    ts.sys.getCurrentDirectory,
			getCompilationSettings: () => compilerOptions!,
			getDefaultLibFileName:  (options) => ts.getDefaultLibFilePath(options),
			fileExists:             (fileName) => {
				const normalized = fileName.replace(/\\/g, '/');

				return fileContents.has(normalized) || ts.sys.fileExists(fileName);
			},
			readFile: (fileName) => {
				const normalized = fileName.replace(/\\/g, '/');

				return fileContents.get(normalized) ?? ts.sys.readFile(fileName);
			},
			resolveModuleNames: (moduleNames, containingFile) => {
				return moduleNames.map(moduleName => {
					const result = ts.resolveModuleName(
						moduleName,
						containingFile,
						compilerOptions!,
						ts.sys,
					);

					return result.resolvedModule;
				});
			},
		};

		languageService = ts.createLanguageService(host, ts.createDocumentRegistry());
	}

	// Update or add file to Language Service
	const currentVersion = fileVersions.get(normalizedFilename) ?? 0;
	fileVersions.set(normalizedFilename, currentVersion + 1);
	fileContents.set(normalizedFilename, file.code);
	scriptKinds.set(normalizedFilename, ts.ScriptKind.TSX);

	// Pre-load imports into Language Service using separated import discovery
	const imports = discoverImports(normalizedFilename, file.code, compilerOptions!);

	for (const importInfo of imports) {
		// Add import to Language Service if not already tracked
		if (!fileContents.has(importInfo.resolvedPath) && importInfo.content) {
			fileContents.set(importInfo.resolvedPath, importInfo.content);
			fileVersions.set(importInfo.resolvedPath, 1);
			scriptKinds.set(importInfo.resolvedPath, detectScriptKind(importInfo.resolvedPath));
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
	fileVersions.clear();
	fileContents.clear();
	scriptKinds.clear();
};
