/**
 * Cell Formatter
 * 
 * Low-level API for formatting raw cell content by type.
 * Use this when you already know the cell type (e.g., from a Chrome extension
 * that reads the cell metadata directly).
 * 
 * @example
 * ```typescript
 * import { formatCell, formatCellSync, initializePythonFormatter } from 'fabricfmt';
 * 
 * // Format Spark SQL (synchronous)
 * const result = formatCellSync('select * from table', 'sparksql');
 * console.log(result.formatted); // 'SELECT * FROM table'
 * 
 * // Format Python (async - needs initialization)
 * await initializePythonFormatter();
 * const result = formatCell('x=1', 'python');
 * console.log(result.formatted); // 'x = 1'
 * ```
 */

import { getFormatterRegistry } from './formatters/index.js';
import { formatSql as formatSqlDirect } from './formatters/sparksql/index.js';
import { getPythonFormatter, resetPythonFormatter, type WasmInitOptions } from './formatters/python/index.js';

// ============================================================================
// Types
// ============================================================================

/** Result from formatCell */
export interface FormatCellResult {
    /** The formatted content */
    formatted: string;
    /** Whether the content was changed */
    changed: boolean;
    /** Error message if formatting failed */
    error?: string;
}

/** Supported cell types for formatCell */
export type CellType = 
    | 'sparksql' 
    | 'python' 
    | 'pyspark';    // Treated as Python

// ============================================================================
// Python Formatter State
// ============================================================================

/** State for Python formatter initialization */
let pythonFormatterReady = false;
let pythonFormatterInitPromise: Promise<void> | null = null;

/**
 * Initialize the Python formatter (must be called before formatting Python cells).
 * This is async because the Ruff WASM module needs to be loaded.
 * 
 * @param options - Optional WASM initialization options for browser environments.
 *   - wasmUrl: URL to the .wasm file (use this in Chrome extensions with chrome.runtime.getURL)
 *   - wasmBinary: WASM binary as ArrayBuffer or Uint8Array (for sync initialization)
 */
export async function initializePythonFormatter(options?: WasmInitOptions): Promise<void> {
    if (pythonFormatterReady) return;
    if (pythonFormatterInitPromise) return pythonFormatterInitPromise;
    
    pythonFormatterInitPromise = (async () => {
        // If options provided, reset the formatter to use new options
        if (options) {
            resetPythonFormatter();
        }
        
        // Get or create the formatter with options
        const pythonFormatter = getPythonFormatter(options);
        
        // Re-register in the registry so formatCell uses the correct instance
        const registry = getFormatterRegistry();
        registry.register(pythonFormatter);
        
        if (!pythonFormatter.isReady()) {
            await pythonFormatter.initialize();
        }
        pythonFormatterReady = true;
    })();
    
    return pythonFormatterInitPromise;
}

/**
 * Check if Python formatter is ready.
 */
export function isPythonFormatterReady(): boolean {
    return pythonFormatterReady;
}

// ============================================================================
// Cell Formatting API
// ============================================================================

/**
 * Format a single cell's content based on its type.
 * 
 * This is the low-level API for formatting raw code content.
 * Use this when you already know the cell type (e.g., from a Chrome extension
 * that reads the cell metadata directly).
 * 
 * @param content Raw cell content (no comment wrappers like `# MAGIC`)
 * @param cellType The cell type from metadata (e.g., 'sparksql', 'python', 'pyspark')
 * @returns Formatted content and status
 * 
 * @example
 * ```typescript
 * // Format Spark SQL
 * const result = formatCell('select * from table', 'sparksql');
 * console.log(result.formatted); // 'SELECT * FROM table'
 * 
 * // Format Python (must initialize first)
 * await initializePythonFormatter();
 * const result = formatCell('x=1', 'python');
 * console.log(result.formatted); // 'x = 1'
 * ```
 */
export function formatCell(content: string, cellType: CellType): FormatCellResult {
    const type = cellType.toLowerCase() as CellType;
    
    switch (type) {
        case 'sparksql':
            try {
                const formatted = formatSqlDirect(content);
                return {
                    formatted,
                    changed: formatted !== content,
                };
            } catch (error) {
                return {
                    formatted: content,
                    changed: false,
                    error: `Spark SQL format error: ${error}`,
                };
            }
        
        case 'python':
        case 'pyspark':
            const registry = getFormatterRegistry();
            const pythonFormatter = registry.get('python');
            
            if (!pythonFormatter?.isReady()) {
                return {
                    formatted: content,
                    changed: false,
                    error: 'Python formatter not initialized. Call initializePythonFormatter() first.',
                };
            }
            
            const result = pythonFormatter.format(content, {
                stripTrailingNewline: true,
            } as any);
            
            return {
                formatted: result.formatted,
                changed: result.changed,
                error: result.error,
            };
        
        default:
            // Unsupported cell type - return unchanged
            return {
                formatted: content,
                changed: false,
            };
    }
}

/**
 * Synchronous version of formatCell for Spark SQL only.
 * Use this when you only need SQL formatting and don't want async.
 */
export function formatCellSync(content: string, cellType: 'sparksql'): FormatCellResult {
    return formatCell(content, cellType);
}
