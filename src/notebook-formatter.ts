/**
 * Notebook Formatter
 * 
 * Handles Microsoft Fabric notebook files, formatting both SQL and Python cells.
 * 
 * File formats:
 * - .py files (Python/PySpark) with `# MAGIC` prefix for SQL cells
 * - .scala files (Scala/Spark) with `// MAGIC` prefix for SQL cells
 * - .r files (R/SparkR) with `# MAGIC` prefix for SQL cells
 * - .sql files (SparkSQL) with `-- MAGIC` prefix OR raw SQL
 *
 * Cell structure (Python example):
 * ```
 * # CELL ********************
 *
 * # MAGIC %%sql
 * # MAGIC SELECT *
 * # MAGIC FROM table
 *
 * # METADATA ********************
 * ```
 *
 * Python cells (no MAGIC prefix):
 * ```
 * # CELL ********************
 *
 * df = spark.sql("SELECT * FROM table")
 * display(df)
 *
 * # METADATA ********************
 * ```
 */

import { getFormatterRegistry, detectLanguage } from './formatters/index.js';
import { formatSql as formatSqlDirect } from './formatter.js';
import type { FormatResult } from './formatters/types.js';

/** Language-specific comment prefixes */
interface LanguageConfig {
    fabricHeader: string;
    cellMarker: string;
    metadataMarker: string;
    magicPrefix: string;
    magicSqlCommand: string;
    emptyMagic: string;
    /** If true, cells can contain raw SQL without MAGIC prefix */
    supportsRawSql: boolean;
    /** Default cell language when no magic command present */
    defaultLanguage: string;
}

const PYTHON_CONFIG: LanguageConfig = {
    fabricHeader: '# Fabric notebook source',
    cellMarker: '# CELL ********************',
    metadataMarker: '# METADATA ********************',
    magicPrefix: '# MAGIC ',
    magicSqlCommand: '# MAGIC %%sql',
    emptyMagic: '# MAGIC',
    supportsRawSql: false,
    defaultLanguage: 'python',
};

const SCALA_CONFIG: LanguageConfig = {
    fabricHeader: '// Fabric notebook source',
    cellMarker: '// CELL ********************',
    metadataMarker: '// METADATA ********************',
    magicPrefix: '// MAGIC ',
    magicSqlCommand: '// MAGIC %%sql',
    emptyMagic: '// MAGIC',
    supportsRawSql: false,
    defaultLanguage: 'scala',
};

const SQL_CONFIG: LanguageConfig = {
    fabricHeader: '-- Fabric notebook source',
    cellMarker: '-- CELL ********************',
    metadataMarker: '-- METADATA ********************',
    magicPrefix: '-- MAGIC ',
    magicSqlCommand: '-- MAGIC %%sql',
    emptyMagic: '-- MAGIC',
    supportsRawSql: true,
    defaultLanguage: 'sql',
};

const R_CONFIG: LanguageConfig = {
    ...PYTHON_CONFIG,  // R uses same comment syntax as Python
    fabricHeader: '# Fabric notebook source',  // Check if R has different header
    defaultLanguage: 'r',
};

/** Represents a cell in a Fabric notebook */
export interface NotebookCell {
    /** Line index (0-based) where the cell content starts (after CELL marker) */
    contentStartLine: number;
    /** Line index (0-based) where the cell content ends (before METADATA) */
    contentEndLine: number;
    /** The extracted content (without MAGIC prefixes) */
    content: string;
    /** Original lines including MAGIC prefixes */
    originalLines: string[];
    /** Detected language of this cell (from METADATA) */
    language: string;
    /** Whether this is a MAGIC-prefixed cell */
    isMagicCell: boolean;
    /** Whether this is a raw cell (no MAGIC prefix) */
    isRawCell: boolean;
    /** The magic command used in the cell (e.g., 'sql', 'pyspark', 'configure'), or null if no magic */
    magicCommand: string | null;
}

/** Represents a parsed Fabric notebook */
export interface FabricNotebook {
    /** Whether this file is a Fabric notebook */
    isFabricNotebook: boolean;
    /** All detected cells */
    cells: NotebookCell[];
    /** Original file content split into lines */
    lines: string[];
    /** The detected language config */
    config: LanguageConfig | null;
}

/** Statistics from formatting operation */
export interface FormatStats {
    sqlCellsFormatted: number;
    pythonCellsFormatted: number;
    cellsSkipped: number;
    errors: string[];
}

/**
 * Detect line ending style.
 */
function detectLineEnding(content: string): string {
    if (content.includes('\r\n')) return '\r\n';
    return '\n';
}

/**
 * Detect language config from file header.
 */
function detectLanguageConfig(firstLine: string): LanguageConfig | null {
    const trimmed = firstLine.trim();
    if (trimmed.startsWith(PYTHON_CONFIG.fabricHeader)) return PYTHON_CONFIG;
    if (trimmed.startsWith(SCALA_CONFIG.fabricHeader)) return SCALA_CONFIG;
    if (trimmed.startsWith(SQL_CONFIG.fabricHeader)) return SQL_CONFIG;
    // R would need its own detection if it has a different header
    return null;
}

/**
 * Extract the magic command from cell lines (e.g., 'sql', 'pyspark', 'configure').
 * Returns null if no magic command is present.
 */
function extractMagicCommand(lines: string[], config: LanguageConfig): string | null {
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Look for magic command pattern: # MAGIC %%<command>
        const magicPrefix = config.magicPrefix + '%%';
        if (trimmed.startsWith(magicPrefix)) {
            // Extract command name (everything after %% until space or end)
            const afterPrefix = trimmed.slice(magicPrefix.length);
            const match = afterPrefix.match(/^(\w+)/);
            if (match) {
                return match[1].toLowerCase();
            }
        }
    }
    return null;
}

/**
 * Parse the METADATA block to extract the language.
 * Returns the language string or null if not found.
 */
function parseMetadataLanguage(lines: string[], startLine: number, config: LanguageConfig): string | null {
    // Find the METADATA marker
    let i = startLine;
    while (i < lines.length && lines[i].trim() !== config.metadataMarker) {
        i++;
    }
    
    if (i >= lines.length) return null;
    
    // Parse the META JSON block
    // Format: # META { ... "language": "sparksql" ... }
    const metaPrefix = config.magicPrefix.replace('MAGIC', 'META').trim();
    let jsonContent = '';
    
    i++; // Skip the METADATA marker
    while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (trimmed === config.cellMarker || trimmed === config.metadataMarker) {
            break;
        }
        
        // Extract content after # META prefix
        if (trimmed.startsWith(metaPrefix)) {
            jsonContent += trimmed.slice(metaPrefix.length).trim();
        }
        i++;
    }
    
    // Try to parse and extract language
    try {
        const meta = JSON.parse(jsonContent);
        if (meta && typeof meta.language === 'string') {
            return meta.language;
        }
    } catch {
        // JSON parsing failed, ignore
    }
    
    return null;
}

/**
 * Detect the language of a cell based on magic commands.
 * @deprecated Use parseMetadataLanguage instead - kept for backward compatibility
 */
function detectCellLanguage(lines: string[], config: LanguageConfig): string {
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Check for magic commands
        if (trimmed === config.magicSqlCommand || trimmed.startsWith(config.magicPrefix + '%%sql')) {
            return 'sql';
        }
        if (trimmed === config.magicPrefix + '%%python' || trimmed.startsWith(config.magicPrefix + '%%python ')) {
            return 'python';
        }
        if (trimmed === config.magicPrefix + '%%pyspark' || trimmed.startsWith(config.magicPrefix + '%%pyspark ')) {
            return 'python';  // PySpark is Python
        }
        if (trimmed === config.magicPrefix + '%%scala' || trimmed.startsWith(config.magicPrefix + '%%scala ')) {
            return 'scala';
        }
        if (trimmed === config.magicPrefix + '%%r' || trimmed === config.magicPrefix + '%%R') {
            return 'r';
        }
        
        // First non-empty, non-magic line determines if it's a raw cell
        if (trimmed !== '' && !trimmed.startsWith(config.magicPrefix.trim())) {
            return config.defaultLanguage;
        }
    }
    
    return config.defaultLanguage;
}

/**
 * Strip MAGIC prefix from a line.
 */
function stripMagicPrefix(line: string, config: LanguageConfig): string {
    if (line.startsWith(config.magicPrefix)) {
        return line.slice(config.magicPrefix.length);
    }
    if (line.trim() === config.emptyMagic) {
        return '';
    }
    return line;
}

/**
 * Add MAGIC prefix to lines.
 */
function addMagicPrefix(content: string, config: LanguageConfig): string[] {
    return content.split(/\r?\n/).map(line => {
        if (line === '') return config.emptyMagic;
        return config.magicPrefix + line;
    });
}

/**
 * Parse a Fabric notebook file into cells.
 */
export function parseNotebook(content: string): FabricNotebook {
    const lines = content.split(/\r?\n/);
    const result: FabricNotebook = {
        isFabricNotebook: false,
        cells: [],
        lines,
        config: null,
    };
    
    if (lines.length === 0) return result;
    
    const config = detectLanguageConfig(lines[0]);
    if (!config) return result;
    
    result.isFabricNotebook = true;
    result.config = config;
    
    let i = 0;
    while (i < lines.length) {
        if (lines[i].trim() === config.cellMarker) {
            const cellStartLine = i + 1;
            
            // Skip empty lines after CELL marker
            let j = cellStartLine;
            while (j < lines.length && lines[j].trim() === '') {
                j++;
            }
            
            // Find end of cell
            let cellEndLine = j;
            while (cellEndLine < lines.length) {
                const trimmed = lines[cellEndLine].trim();
                if (trimmed === config.metadataMarker || trimmed === config.cellMarker) {
                    break;
                }
                cellEndLine++;
            }
            
            // Back up past trailing empty lines
            let actualEndLine = cellEndLine - 1;
            while (actualEndLine >= j && lines[actualEndLine].trim() === '') {
                actualEndLine--;
            }
            
            if (actualEndLine >= j) {
                const originalLines = lines.slice(j, actualEndLine + 1);
                
                // Get language from METADATA block (authoritative source)
                const metadataLanguage = parseMetadataLanguage(lines, cellEndLine, config);
                
                // Map metadata language to our internal language names
                let language: string;
                if (metadataLanguage === 'sparksql') {
                    language = 'sql';
                } else if (metadataLanguage === 'python' || metadataLanguage === 'pyspark') {
                    language = 'python';
                } else if (metadataLanguage === 'scala') {
                    language = 'scala';
                } else if (metadataLanguage === 'r' || metadataLanguage === 'R') {
                    language = 'r';
                } else if (metadataLanguage) {
                    language = metadataLanguage;
                } else {
                    // Fallback to magic-based detection if no metadata
                    language = detectCellLanguage(originalLines, config);
                }
                
                // Extract magic command (e.g., 'sql', 'pyspark', 'configure')
                const magicCommand = extractMagicCommand(originalLines, config);
                
                // Check if it's a MAGIC cell
                const isMagicCell = originalLines.some(l => 
                    l.trim().startsWith(config.magicPrefix.trim())
                );
                
                // Extract content
                let content: string;
                let contentStartLine = j;
                
                if (isMagicCell) {
                    // Skip the magic command line (%%sql, %%python, etc.)
                    const magicCommandIndex = originalLines.findIndex(l => 
                        l.trim().startsWith(config.magicPrefix + '%%')
                    );
                    
                    if (magicCommandIndex >= 0) {
                        const contentLines = originalLines.slice(magicCommandIndex + 1);
                        content = contentLines.map(l => stripMagicPrefix(l, config)).join('\n');
                        contentStartLine = j + magicCommandIndex + 1;
                    } else {
                        content = originalLines.map(l => stripMagicPrefix(l, config)).join('\n');
                    }
                } else {
                    content = originalLines.join('\n');
                }
                
                result.cells.push({
                    contentStartLine: contentStartLine,
                    contentEndLine: actualEndLine,
                    content,
                    originalLines,
                    language,
                    isMagicCell,
                    isRawCell: !isMagicCell,
                    magicCommand,
                });
            }
            
            i = cellEndLine;
            continue;
        }
        i++;
    }
    
    return result;
}

/**
 * Replace a cell's content in the file.
 */
function replaceCell(
    fileContent: string,
    cell: NotebookCell,
    formattedContent: string,
    config: LanguageConfig,
    lineEnding: string
): string {
    const lines = fileContent.split(/\r?\n/);
    
    let newLines: string[];
    if (cell.isMagicCell) {
        newLines = addMagicPrefix(formattedContent, config);
    } else {
        newLines = formattedContent.split(/\r?\n/);
    }
    
    const before = lines.slice(0, cell.contentStartLine);
    const after = lines.slice(cell.contentEndLine + 1);
    
    return [...before, ...newLines, ...after].join(lineEnding);
}

/**
 * Format all cells in a Fabric notebook.
 * 
 * @param content The file content
 * @param options Formatting options
 * @returns Object with formatted content and statistics
 */
export async function formatNotebook(
    content: string,
    options?: {
        formatSql?: boolean;
        formatPython?: boolean;
        configPath?: string;
    }
): Promise<{ content: string; stats: FormatStats }> {
    const formatSqlCells = options?.formatSql ?? true;
    const formatPythonCells = options?.formatPython ?? true;
    
    const stats: FormatStats = {
        sqlCellsFormatted: 0,
        pythonCellsFormatted: 0,
        cellsSkipped: 0,
        errors: [],
    };
    
    const notebook = parseNotebook(content);
    
    if (!notebook.isFabricNotebook || notebook.cells.length === 0 || !notebook.config) {
        return { content, stats };
    }
    
    const lineEnding = detectLineEnding(content);
    const registry = getFormatterRegistry();
    
    // Initialize Python formatter if needed
    if (formatPythonCells) {
        const pythonFormatter = registry.get('python');
        if (pythonFormatter && !pythonFormatter.isReady()) {
            try {
                await pythonFormatter.initialize();
            } catch (error) {
                stats.errors.push(`Python formatter init failed: ${error}`);
            }
        }
    }
    
    // Process cells in reverse order
    let result = content;
    const cellsReversed = [...notebook.cells].reverse();
    
    for (const cell of cellsReversed) {
        // Determine if this cell should be formatted based on language and magic command
        // SQL cells: format only if %%sql magic or no magic command
        // Python cells: format only if %%pyspark magic or no magic command
        const magicCmd = cell.magicCommand;
        
        const shouldFormatSql = cell.language === 'sql' && formatSqlCells &&
            (magicCmd === null || magicCmd === 'sql');
        
        const shouldFormatPython = cell.language === 'python' && formatPythonCells &&
            (magicCmd === null || magicCmd === 'pyspark');
        
        if (shouldFormatSql) {
            // Calculate line width offset for MAGIC prefix
            const lineWidthOffset = cell.isMagicCell ? notebook.config.magicPrefix.length : 0;
            
            try {
                // Note: formatSql currently doesn't support lineWidthOffset
                // TODO: Add options support to formatSql in the future
                const formatted = formatSqlDirect(cell.content);
                if (formatted !== cell.content) {
                    result = replaceCell(result, cell, formatted, notebook.config, lineEnding);
                    stats.sqlCellsFormatted++;
                }
            } catch (error) {
                stats.errors.push(`SQL format error: ${error}`);
            }
        } else if (shouldFormatPython) {
            const formatter = registry.get('python');
            if (formatter?.isReady()) {
                const formatResult = formatter.format(cell.content, {
                    stripTrailingNewline: true,
                } as any);
                
                if (formatResult.changed) {
                    result = replaceCell(result, cell, formatResult.formatted, notebook.config, lineEnding);
                    stats.pythonCellsFormatted++;
                }
                
                if (formatResult.error) {
                    stats.errors.push(`Python format error: ${formatResult.error}`);
                }
            } else {
                stats.cellsSkipped++;
            }
        } else {
            stats.cellsSkipped++;
        }
    }
    
    return { content: result, stats };
}

// ============================================================================
// LEGACY API (for backward compatibility with magic-sql-extractor)
// ============================================================================

/** @deprecated Use NotebookCell instead */
export interface MagicSqlCell {
    contentStartLine: number;
    contentEndLine: number;
    sql: string;
    originalLines: string[];
    isRawSql: boolean;
}

/** @deprecated Use FabricNotebook instead */
export interface MagicSqlFile {
    isFabricNotebook: boolean;
    sqlCells: MagicSqlCell[];
    lines: string[];
    config: LanguageConfig | null;
}

/**
 * @deprecated Use parseNotebook instead
 * Extracts SQL cells from a Fabric notebook (legacy API).
 */
export function extractMagicSqlCells(content: string): MagicSqlFile {
    const notebook = parseNotebook(content);
    
    return {
        isFabricNotebook: notebook.isFabricNotebook,
        sqlCells: notebook.cells
            .filter(c => c.language === 'sql')
            .map(c => ({
                contentStartLine: c.contentStartLine,
                contentEndLine: c.contentEndLine,
                sql: c.content,
                originalLines: c.originalLines,
                isRawSql: c.isRawCell,
            })),
        lines: notebook.lines,
        config: notebook.config,
    };
}

/**
 * @deprecated Use formatNotebook instead
 * Formats SQL cells in a Fabric notebook (legacy API).
 */
export function formatFabricNotebook(
    content: string,
    formatFn: (sql: string) => string
): string {
    const notebook = parseNotebook(content);
    
    if (!notebook.isFabricNotebook || notebook.cells.length === 0 || !notebook.config) {
        return content;
    }
    
    const lineEnding = detectLineEnding(content);
    let result = content;
    
    // Process SQL cells in reverse order
    const sqlCells = notebook.cells.filter(c => c.language === 'sql').reverse();
    
    for (const cell of sqlCells) {
        const formatted = formatFn(cell.content);
        result = replaceCell(result, cell, formatted, notebook.config, lineEnding);
    }
    
    return result;
}
