/**
 * sparkfmt - Spark SQL & Python Formatter
 * 
 * A unified formatter for Spark SQL and Python code, designed for
 * Microsoft Fabric notebooks and CI/CD pipelines.
 * 
 * Architecture:
 * - formatters/sql/: Core SQL formatting (ANTLR grammar-driven)
 * - formatters/python/: Python formatting via Ruff WASM
 * - notebook-formatter.ts: Fabric notebook handling
 */

// ============================================================================
// SQL Formatter (Core API)
// ============================================================================

export { formatSql, needsFormatting } from './formatters/sparksql/index.js';

// ============================================================================
// Language Formatters (Extensible)
// ============================================================================

export { 
    // Registry
    getFormatterRegistry,
    detectLanguage,
    
    // SQL
    SqlFormatter,
    getSqlFormatter,
    isSqlCode,
    
    // Python
    PythonFormatter,
    getPythonFormatter,
    isPythonCode,
    
    // Types
    type LanguageFormatter,
    type FormatterOptions,
    type FormatResult,
    type FormatterConfig,
    type FormatterRegistry,
} from './formatters/index.js';

// ============================================================================
// Cell Formatter (Low-level API)
// ============================================================================

export {
    formatCell,
    formatCellSync,
    initializePythonFormatter,
    isPythonFormatterReady,
    type FormatCellResult,
    type CellType,
} from './cell-formatter.js';

// ============================================================================
// Notebook Formatter (High-level API)
// ============================================================================

export {
    parseNotebook,
    formatNotebook,
    type NotebookCell,
    type FabricNotebook,
    type FormatStats,
} from './notebook-formatter.js';

// ============================================================================
// Configuration (Python/Ruff)
// ============================================================================

export {
    DEFAULT_RUFF_CONFIG,
    RUFF_WASM_CONFIG,
    type RuffConfig,
    type RuffFormatConfig,
    type WasmInitOptions,
} from './formatters/python/index.js';

// ============================================================================
// Format Directives (Spark SQL)
// ============================================================================

export { 
    hasFormatOff, 
    detectCollapseDirectives, 
    hasCollapseDirective, 
    type FormatDirectiveInfo 
} from './formatters/sparksql/index.js';

// ============================================================================
// Types (for library consumers)
// ============================================================================

export type { 
    AnalyzerResult,
    FormattingState,
    MultiArgFunctionInfo,
    WindowDefInfo,
    TokenContext,
    PendingComment,
    ExpandedFunction,
    ExpandedWindow
} from './formatters/sparksql/types.js';
