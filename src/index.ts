/**
 * sparkfmt - Spark SQL & Python Formatter
 * 
 * A unified formatter for Spark SQL and Python code, designed for
 * Microsoft Fabric notebooks and CI/CD pipelines.
 * 
 * Architecture:
 * - formatters/: Language-specific formatters (SQL, Python, extensible to others)
 * - formatter.ts: Core SQL formatting (ANTLR grammar-driven)
 * - notebook-formatter.ts: Fabric notebook handling
 * - config.ts: Configuration loading (ruff.toml, pyproject.toml)
 */

// ============================================================================
// SQL Formatter (Core API)
// ============================================================================

export { formatSql, needsFormatting } from './formatter.js';

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
// Notebook Formatter
// ============================================================================

export {
    // New API
    parseNotebook,
    formatNotebook,
    type NotebookCell,
    type FabricNotebook,
    type FormatStats,
    
    // Legacy API (deprecated but maintained for compatibility)
    extractMagicSqlCells,
    formatFabricNotebook,
    type MagicSqlCell,
    type MagicSqlFile,
} from './notebook-formatter.js';

// ============================================================================
// Configuration
// ============================================================================

export {
    loadRuffConfig,
    toRuffWasmConfig,
    DEFAULT_RUFF_CONFIG,
    type RuffConfig,
    type RuffFormatConfig,
} from './config.js';

// ============================================================================
// Format Directives
// ============================================================================

export { 
    hasFormatOff, 
    detectCollapseDirectives, 
    hasCollapseDirective, 
    type FormatDirectiveInfo 
} from './noqa-detector.js';

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
} from './types.js';
