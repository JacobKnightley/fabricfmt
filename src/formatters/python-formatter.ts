/**
 * Python Formatter
 * 
 * Uses Ruff WASM to format Python/PySpark code.
 * Handles Jupyter/IPython magic commands by preserving them.
 */

import type { LanguageFormatter, FormatterOptions, FormatResult } from './types.js';
import { loadRuffConfig, toRuffWasmConfig, type RuffConfig } from '../config.js';

// Dynamic import for ruff WASM (loaded on demand)
let ruffModule: typeof import('@astral-sh/ruff-wasm-nodejs') | null = null;
let workspace: InstanceType<typeof import('@astral-sh/ruff-wasm-nodejs').Workspace> | null = null;
let ruffConfig: RuffConfig | null = null;

/** Options specific to Python formatting */
export interface PythonFormatterOptions extends FormatterOptions {
    /** Strip trailing newlines from formatted output */
    stripTrailingNewline?: boolean;
    /** Path to search for ruff config (ruff.toml, pyproject.toml) */
    configPath?: string;
}

/**
 * Python formatter using Ruff WASM.
 */
export class PythonFormatter implements LanguageFormatter {
    readonly language = 'python';
    readonly displayName = 'Python (Ruff)';
    
    private initialized = false;
    private initError: string | null = null;
    
    isReady(): boolean {
        return this.initialized && !this.initError;
    }
    
    async initialize(configPath?: string): Promise<void> {
        if (this.initialized) return;
        
        try {
            // Load ruff configuration
            ruffConfig = loadRuffConfig(configPath);
            
            // Dynamic import of ruff WASM
            ruffModule = await import('@astral-sh/ruff-wasm-nodejs');
            
            // Create workspace with loaded config
            // Note: ruff WASM prints debug info to stdout during Workspace creation
            // We suppress this by temporarily replacing stdout.write
            const wasmConfig = toRuffWasmConfig(ruffConfig);
            const originalWrite = process.stdout.write.bind(process.stdout);
            process.stdout.write = () => true; // Suppress output
            try {
                workspace = new ruffModule.Workspace(wasmConfig, ruffModule.PositionEncoding.Utf32);
            } finally {
                process.stdout.write = originalWrite; // Restore output
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
            // These are not Python code and should be returned as-is
            const cellMagicMatch = code.match(/^(%%\w+.*)/);
            if (cellMagicMatch) {
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
 */
export function getPythonFormatter(): PythonFormatter {
    if (!pythonFormatterInstance) {
        pythonFormatterInstance = new PythonFormatter();
    }
    return pythonFormatterInstance;
}
