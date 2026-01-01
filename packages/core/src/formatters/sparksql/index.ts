/**
 * Spark SQL Formatter - Module Exports
 * 
 * This is the 100% grammar-driven SQL formatter for Apache Spark SQL.
 * All modules in this directory work together to format SQL.
 */

// ============================================================================
// PUBLIC API
// ============================================================================

export { formatSql, needsFormatting } from './formatter.js';

// ============================================================================
// FORMATTER CLASS (LanguageFormatter interface)
// ============================================================================

export { SqlFormatter, getSqlFormatter, isSqlCode } from './sql-formatter.js';

// ============================================================================
// FORMAT DIRECTIVES
// ============================================================================

export { 
    hasFormatOff, 
    detectCollapseDirectives, 
    hasCollapseDirective,
    isFmtInlineComment,
    type FormatDirectiveInfo,
    type ForceInlineRange,
} from './fmt-detector.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export { MAX_LINE_WIDTH } from './constants.js';

// ============================================================================
// TYPES (for library consumers)
// ============================================================================

export type { 
    AnalyzerResult,
    FormattingState,
    MultiArgFunctionInfo,
    WindowDefInfo,
    TokenContext,
    PendingComment,
    ExpandedFunction,
    ExpandedWindow,
    ExpandedPivot,
    PivotInfo,
    InListInfo,
    SimpleQueryInfo,
    NestedFunctionInfo,
} from './types.js';
