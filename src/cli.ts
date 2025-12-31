#!/usr/bin/env node
/**
 * CLI for Spark SQL & Python Formatter
 */
import { formatSql } from './formatter.js';
import { formatNotebook, formatFabricNotebook } from './notebook-formatter.js';
import { getPythonFormatter } from './formatters/index.js';
import { loadRuffConfig } from './config.js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const args = process.argv.slice(2);

/** Supported file extensions for formatting */
const SUPPORTED_EXTENSIONS = ['.sql', '.py', '.scala', '.r'];

/** CLI options */
interface CliOptions {
    check: boolean;
    stdout: boolean;
    inline: boolean;
    help: boolean;
    noPython: boolean;
    noSql: boolean;
    verbose: boolean;
}

/** Parse CLI arguments */
function parseArgs(args: string[]): { options: CliOptions; paths: string[] } {
    const options: CliOptions = {
        check: false,
        stdout: false,
        inline: false,
        help: false,
        noPython: false,
        noSql: false,
        verbose: false,
    };
    const paths: string[] = [];
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-c' || arg === '--check') {
            options.check = true;
        } else if (arg === '--stdout') {
            options.stdout = true;
        } else if (arg === '-i' || arg === '--inline') {
            options.inline = true;
        } else if (arg === '-h' || arg === '--help') {
            options.help = true;
        } else if (arg === '--no-python') {
            options.noPython = true;
        } else if (arg === '--no-sql') {
            options.noSql = true;
        } else if (arg === '-v' || arg === '--verbose') {
            options.verbose = true;
        } else if (!arg.startsWith('-')) {
            paths.push(arg);
        }
    }
    
    return { options, paths };
}

/**
 * Recursively find all files with supported extensions in a directory.
 */
function findSupportedFiles(dir: string): string[] {
    const files: string[] = [];
    
    function walk(currentDir: string) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                // Skip common non-source directories
                if (!['node_modules', '.git', '__pycache__', '.venv', 'venv', 'dist', 'build'].includes(entry.name)) {
                    walk(fullPath);
                }
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (SUPPORTED_EXTENSIONS.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    walk(dir);
    return files;
}

/**
 * Expand a list of paths to include files from directories.
 */
function expandPaths(paths: string[]): string[] {
    const files: string[] = [];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
                files.push(...findSupportedFiles(p));
            } else {
                files.push(p);
            }
        } else {
            files.push(p);
        }
    }
    return files;
}

/**
 * Format content based on file extension.
 * .py, .scala, .r, and .sql files are treated as potential Fabric notebooks.
 * If a .sql file is not a Fabric notebook, it's formatted as standard SQL.
 */
async function formatContent(
    content: string, 
    filePath: string | undefined, 
    options: CliOptions,
    ruffConfig?: object
): Promise<string> {
    const notebookExtensions = ['.py', '.scala', '.r', '.sql'];
    
    // Determine which formatters to use based on CLI options
    const formatPython = !options.noPython;
    const formatSqlCells = !options.noSql;
    
    if (filePath && notebookExtensions.some(ext => filePath.endsWith(ext))) {
        // Use async formatNotebook with Python support
        const { content: formatted, stats } = await formatNotebook(content, {
            formatPython,
            formatSql: formatSqlCells,
        });
        
        if (options.verbose && (stats.sqlCellsFormatted > 0 || stats.pythonCellsFormatted > 0)) {
            console.error(`  SQL: ${stats.sqlCellsFormatted}, Python: ${stats.pythonCellsFormatted}`);
        }
        
        // If unchanged and it's a .sql file, format as standard SQL
        if (formatted === content && filePath.endsWith('.sql') && formatSqlCells) {
            return formatSql(content);
        }
        return formatted;
    }
    
    // Plain SQL file or stdin
    if (formatSqlCells) {
        return formatSql(content);
    }
    return content;
}

// Helper to output formatted SQL
function output(formatted: string) {
    console.log(formatted);
}

/**
 * Detect the line ending style used in content.
 * Returns '\r\n' for Windows or '\n' for Unix.
 */
function detectLineEnding(content: string): '\r\n' | '\n' {
    // Check for CRLF first (Windows)
    if (content.includes('\r\n')) {
        return '\r\n';
    }
    return '\n';
}

/**
 * Normalize line endings in content to Unix style (\n).
 */
function normalizeLineEndings(content: string): string {
    return content.replace(/\r\n/g, '\n');
}

/**
 * Convert line endings in content to the specified style.
 */
function convertLineEndings(content: string, lineEnding: '\r\n' | '\n'): string {
    // First normalize to \n, then convert to target
    const normalized = normalizeLineEndings(content);
    if (lineEnding === '\r\n') {
        return normalized.replace(/\n/g, '\r\n');
    }
    return normalized;
}

/** Print help message */
function printHelp() {
    console.log(`Fabric Notebook Formatter (Spark SQL & Python)

Usage:
  fabricfmt [options] [file|directory...]
  echo "select * from t" | fabricfmt

Arguments:
  file                A SQL, Python, Scala, or R file to format
  directory           A directory to recursively format (finds .sql, .py, .scala, .r)

Options:
  -h, --help          Show this help message
  -c, --check         Check if files need formatting (exit 1 if so)
  -i, --inline        Format SQL provided as argument
  --stdout            Print to stdout instead of formatting in-place
  --no-python         Skip Python formatting (SQL only)
  --no-sql            Skip SQL formatting (Python only)
  -v, --verbose       Verbose output

Examples:
  fabricfmt query.sql                    Format file in-place
  fabricfmt ./src                        Format all supported files in directory
  fabricfmt *.sql                        Format multiple files in-place
  fabricfmt -i "select * from t"         Format inline SQL
  fabricfmt -c ./src                     Check if any files need formatting
  fabricfmt --stdout query.sql           Print formatted SQL to stdout
  fabricfmt --no-python ./src            Format SQL cells only (skip Python)
`);
}

/** Main async entry point */
async function main() {
    const { options, paths } = parseArgs(args);
    
    // Load ruff config from current directory
    let ruffConfig: object | undefined;
    try {
        ruffConfig = loadRuffConfig('.');
        if (options.verbose && ruffConfig) {
            console.log('Loaded ruff configuration');
        }
    } catch (e) {
        // No config found, use defaults
    }
    
    if (options.help) {
        printHelp();
        return;
    }
    
    if (paths.length === 0) {
        // Interactive mode - read from stdin
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        
        let sql = '';
        
        rl.on('line', (line) => {
            sql += line + '\n';
        });
        
        rl.on('close', async () => {
            const formatted = await formatContent(sql.trim(), undefined, options, ruffConfig);
            console.log(formatted);
        });
        return;
    }
    
    if (options.inline) {
        // Format inline SQL
        const sql = paths.join(' ');
        console.log(formatSql(sql));
        return;
    }
    
    if (options.stdout) {
        // Print to stdout instead of in-place
        const file = paths[0];
        if (!file) {
            console.error('Error: No file specified for --stdout');
            process.exit(2);
        }
        const content = fs.readFileSync(file, 'utf-8');
        const formatted = await formatContent(content, file, options, ruffConfig);
        console.log(formatted);
        return;
    }
    
    // Expand directories to files
    const files = expandPaths(paths);
    if (files.length === 0) {
        console.log('No supported files found');
        process.exit(0);
    }
    
    if (options.check) {
        // Check mode - don't modify files
        let needsFormatting = false;
        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const formatted = await formatContent(content, file, options, ruffConfig);
                if (formatted !== content) {
                    console.log(`File ${file} needs formatting`);
                    needsFormatting = true;
                }
            } catch (e: any) {
                console.error(`Error checking ${file}: ${e.message}`);
            }
        }
        if (needsFormatting) {
            process.exit(1);
        }
        console.log(`All ${files.length} file(s) are properly formatted`);
        return;
    }
    
    // Default: format files in-place
    let formattedCount = 0;
    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const originalLineEnding = detectLineEnding(content);
            const normalizedContent = normalizeLineEndings(content);
            const formatted = await formatContent(normalizedContent, file, options, ruffConfig);
            const formattedWithOriginalEndings = convertLineEndings(formatted, originalLineEnding);
            
            if (formattedWithOriginalEndings !== content) {
                fs.writeFileSync(file, formattedWithOriginalEndings, 'utf-8');
                console.log(`Formatted ${file}`);
                formattedCount++;
            }
        } catch (e: any) {
            console.error(`Error formatting ${file}: ${e.message}`);
            process.exit(1);
        }
    }
    if (formattedCount === 0) {
        console.log(`All ${files.length} file(s) already formatted`);
    } else {
        console.log(`Formatted ${formattedCount} of ${files.length} file(s)`);
    }
}

// Run main
main().catch((e) => {
    console.error(`Error: ${e.message}`);
    process.exit(1);
});
