/**
 * Python Formatter
 * 
 * Uses Ruff WASM to format Python/PySpark code.
 * Handles Jupyter/IPython magic commands by preserving them.
 */

import type { LanguageFormatter, FormatterOptions, FormatResult } from '../types.js';
import { RUFF_WASM_CONFIG } from './config.js';

// Dynamic import for ruff WASM (loaded on demand)
let ruffModule: typeof import('@astral-sh/ruff-wasm-web') | null = null;
let workspace: InstanceType<typeof import('@astral-sh/ruff-wasm-web').Workspace> | null = null;

/** Options for initializing the WASM module */
export interface WasmInitOptions {
    /** URL to the .wasm file (for browser environments) */
    wasmUrl?: string | URL;
    /** WASM binary as ArrayBuffer or Uint8Array (for sync initialization) */
    wasmBinary?: ArrayBuffer | Uint8Array;
}

/** Options specific to Python formatting */
export interface PythonFormatterOptions extends FormatterOptions {
    /** Strip trailing newlines from formatted output */
    stripTrailingNewline?: boolean;
}

/**
 * Python formatter using Ruff WASM.
 */
export class PythonFormatter implements LanguageFormatter {
    readonly language = 'python';
    readonly displayName = 'Python (Ruff)';
    
    private initialized = false;
    private initError: string | null = null;
    private wasmOptions: WasmInitOptions | undefined;
    
    /**
     * Create a new Python formatter.
     * @param options - Optional WASM initialization options for browser environments
     */
    constructor(options?: WasmInitOptions) {
        this.wasmOptions = options;
    }
    
    isReady(): boolean {
        return this.initialized && !this.initError;
    }
    
    async initialize(): Promise<void> {
        if (this.initialized) return;
        
        try {
            // Dynamic import of ruff WASM
            ruffModule = await import('@astral-sh/ruff-wasm-web');
            
            // Initialize WASM module - this must be called before using any classes
            // The default export is the init function that loads the .wasm binary
            if (this.wasmOptions?.wasmBinary) {
                // Use synchronous initialization with provided binary
                ruffModule.initSync({ module: this.wasmOptions.wasmBinary });
            } else if (this.wasmOptions?.wasmUrl) {
                // Use async initialization with provided URL
                await ruffModule.default({ module_or_path: this.wasmOptions.wasmUrl });
            } else {
                // Default: let ruff-wasm-web use import.meta.url to find the WASM file
                // This works in Node.js and ESM environments but may fail in bundled IIFE
                await ruffModule.default();
            }
            
            // Create workspace with config
            // Note: ruff WASM prints debug info to stdout during Workspace creation
            // We suppress this by temporarily replacing stdout.write (Node.js only)
            const hasProcess = typeof process !== 'undefined' && process.stdout?.write;
            const originalWrite = hasProcess ? process.stdout.write.bind(process.stdout) : null;
            if (originalWrite) {
                process.stdout.write = () => true; // Suppress output
            }
            try {
                workspace = new ruffModule.Workspace(RUFF_WASM_CONFIG, ruffModule.PositionEncoding.Utf32);
            } finally {
                if (originalWrite) {
                    process.stdout.write = originalWrite; // Restore output
                }
            }
            
            this.initialized = true;
        } catch (error) {
            this.initError = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to initialize Python formatter: ${this.initError}`);
        }
    }
    
    format(code: string, options?: PythonFormatterOptions): FormatResult {
        if (!this.isReady() || !workspace) {
            return {
                formatted: code,
                changed: false,
                error: this.initError ?? 'Python formatter not initialized'
            };
        }
        
        try {
            // Check if the cell starts with a cell magic (%%magic)
            // %%pyspark and %%python contain Python code - format everything after the magic line
            // Other cell magics (%%sql, %%scala, %%r, %%sh, etc.) are not Python - return as-is
            const cellMagicMatch = code.match(/^(%%(\w+).*)\n?/);
            if (cellMagicMatch) {
                const magicLine = cellMagicMatch[1];
                const magicType = cellMagicMatch[2].toLowerCase();
                
                // Only format Python-based cell magics
                if (magicType === 'pyspark' || magicType === 'python') {
                    // Extract the code after the magic line
                    const codeAfterMagic = code.slice(cellMagicMatch[0].length);
                    if (!codeAfterMagic.trim()) {
                        return { formatted: code, changed: false };
                    }
                    
                    // Format the Python code
                    let formatted = workspace.format(codeAfterMagic);
                    
                    // Strip trailing newline if configured
                    if (options?.stripTrailingNewline) {
                        formatted = formatted.replace(/\n+$/, '');
                    }
                    
                    // Recombine with magic line
                    const result = magicLine + '\n' + formatted;
                    return { formatted: result, changed: result !== code };
                }
                
                // Non-Python cell magics - return as-is
                return { formatted: code, changed: false };
            }
            
            // Handle line magics (%magic) at the start of lines
            const lines = code.split('\n');
            const magicPrefix: string[] = [];
            let pythonStartIndex = 0;
            
            // Collect leading line magics and comments
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (trimmed.startsWith('%') || trimmed.startsWith('#') || trimmed === '') {
                    magicPrefix.push(lines[i]);
                    pythonStartIndex = i + 1;
                } else {
                    break;
                }
            }
            
            // If entire code is magics/comments, return as-is
            if (pythonStartIndex >= lines.length) {
                return { formatted: code, changed: false };
            }
            
            // Extract Python code to format
            const pythonCode = lines.slice(pythonStartIndex).join('\n');
            
            // Format the Python portion
            let formatted = workspace.format(pythonCode);
            
            // Post-processing: Strip trailing newline if configured
            if (options?.stripTrailingNewline) {
                formatted = formatted.replace(/\n+$/, '');
            }
            
            // Recombine with magic prefix
            if (magicPrefix.length > 0) {
                formatted = magicPrefix.join('\n') + '\n' + formatted;
            }
            
            const changed = formatted !== code;
            return { formatted, changed };
        } catch (error) {
            return {
                formatted: code,
                changed: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    needsFormatting(code: string, options?: PythonFormatterOptions): boolean {
        const result = this.format(code, options);
        return result.changed;
    }
}

/**
 * Detect if a cell/file is Python/PySpark.
 */
export function isPythonCode(cellType: string): boolean {
    return cellType === 'python' || cellType === 'pyspark';
}

/** Singleton instance */
let pythonFormatterInstance: PythonFormatter | null = null;

/**
 * Get the Python formatter instance (creates on first call).
 * @param options - Optional WASM initialization options. Only used on first call.
 */
export function getPythonFormatter(options?: WasmInitOptions): PythonFormatter {
    if (!pythonFormatterInstance) {
        pythonFormatterInstance = new PythonFormatter(options);
    }
    return pythonFormatterInstance;
}

/**
 * Reset the Python formatter instance (for testing or reinitialization with different options).
 */
export function resetPythonFormatter(): void {
    pythonFormatterInstance = null;
}
