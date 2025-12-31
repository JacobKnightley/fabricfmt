/**
 * Configuration Loader
 * 
 * Loads formatter configuration from ruff.toml or pyproject.toml.
 * Supports both standalone ruff.toml and [tool.ruff] section in pyproject.toml.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Ruff format-specific configuration */
export interface RuffFormatConfig {
    'quote-style'?: 'single' | 'double' | 'preserve';
    'indent-style'?: 'space' | 'tab';
    'skip-magic-trailing-comma'?: boolean;
    'line-ending'?: 'auto' | 'lf' | 'cr-lf' | 'native';
    'docstring-code-format'?: boolean;
    'docstring-code-line-length'?: number | 'dynamic';
}

/** Full ruff configuration (subset relevant to formatting) */
export interface RuffConfig {
    'line-length'?: number;
    'indent-width'?: number;
    format?: RuffFormatConfig;
}

/** Default ruff configuration matching common Python standards */
export const DEFAULT_RUFF_CONFIG: RuffConfig = {
    'line-length': 140,
    'indent-width': 4,
    format: {
        'quote-style': 'double',
        'indent-style': 'space',
        'skip-magic-trailing-comma': false,
        'line-ending': 'auto',
        'docstring-code-format': true,
        'docstring-code-line-length': 'dynamic',
    }
};

/**
 * Simple TOML parser for ruff config files.
 * Handles the subset of TOML we need (no arrays of tables, etc.)
 */
function parseSimpleToml(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let currentSection: Record<string, unknown> = result;
    let currentSectionPath: string[] = [];
    
    const lines = content.split(/\r?\n/);
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (trimmed === '' || trimmed.startsWith('#')) {
            continue;
        }
        
        // Section header [section.name]
        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            const sectionPath = sectionMatch[1].split('.');
            currentSectionPath = sectionPath;
            
            // Navigate/create nested structure
            currentSection = result;
            for (const key of sectionPath) {
                if (!(key in currentSection)) {
                    currentSection[key] = {};
                }
                currentSection = currentSection[key] as Record<string, unknown>;
            }
            continue;
        }
        
        // Key = value
        const kvMatch = trimmed.match(/^([a-zA-Z_-][a-zA-Z0-9_-]*)\s*=\s*(.+)$/);
        if (kvMatch) {
            const key = kvMatch[1];
            let value: unknown = kvMatch[2].trim();
            
            // Parse value type
            if (value === 'true') {
                value = true;
            } else if (value === 'false') {
                value = false;
            } else if (/^-?\d+$/.test(value as string)) {
                value = parseInt(value as string, 10);
            } else if (/^-?\d+\.\d+$/.test(value as string)) {
                value = parseFloat(value as string);
            } else if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
                value = (value as string).slice(1, -1);
            } else if ((value as string).startsWith("'") && (value as string).endsWith("'")) {
                value = (value as string).slice(1, -1);
            }
            
            currentSection[key] = value;
        }
    }
    
    return result;
}

/**
 * Load ruff configuration from a file or directory.
 * Searches for:
 * 1. ruff.toml in the given directory
 * 2. .ruff.toml in the given directory  
 * 3. pyproject.toml [tool.ruff] section
 * 
 * @param searchPath Directory to search for config files, or path to a specific config file
 * @returns Ruff configuration merged with defaults
 */
export function loadRuffConfig(searchPath?: string): RuffConfig {
    if (!searchPath) {
        searchPath = process.cwd();
    }
    
    // If searchPath is a file, use its directory
    let searchDir = searchPath;
    if (fs.existsSync(searchPath) && fs.statSync(searchPath).isFile()) {
        searchDir = path.dirname(searchPath);
    }
    
    // Search for config files
    const candidates = [
        path.join(searchDir, 'ruff.toml'),
        path.join(searchDir, '.ruff.toml'),
        path.join(searchDir, 'pyproject.toml'),
    ];
    
    for (const configPath of candidates) {
        if (fs.existsSync(configPath)) {
            try {
                const content = fs.readFileSync(configPath, 'utf-8');
                const parsed = parseSimpleToml(content);
                
                // Handle pyproject.toml [tool.ruff] section
                if (configPath.endsWith('pyproject.toml')) {
                    const toolRuff = (parsed.tool as Record<string, unknown>)?.ruff as RuffConfig;
                    if (toolRuff) {
                        return mergeConfig(DEFAULT_RUFF_CONFIG, toolRuff);
                    }
                    // No [tool.ruff] section, continue searching
                    continue;
                }
                
                return mergeConfig(DEFAULT_RUFF_CONFIG, parsed as RuffConfig);
            } catch (error) {
                // Config file exists but couldn't be parsed, continue searching
                console.warn(`Warning: Could not parse ${configPath}: ${error}`);
            }
        }
    }
    
    // No config found, use defaults
    return { ...DEFAULT_RUFF_CONFIG };
}

/**
 * Convert RuffConfig to the format expected by ruff WASM Workspace.
 */
export function toRuffWasmConfig(config: RuffConfig): Record<string, unknown> {
    return {
        'line-length': config['line-length'] ?? DEFAULT_RUFF_CONFIG['line-length'],
        'indent-width': config['indent-width'] ?? DEFAULT_RUFF_CONFIG['indent-width'],
        format: {
            'quote-style': config.format?.['quote-style'] ?? DEFAULT_RUFF_CONFIG.format!['quote-style'],
            'indent-style': config.format?.['indent-style'] ?? DEFAULT_RUFF_CONFIG.format!['indent-style'],
            'skip-magic-trailing-comma': config.format?.['skip-magic-trailing-comma'] ?? DEFAULT_RUFF_CONFIG.format!['skip-magic-trailing-comma'],
            'line-ending': config.format?.['line-ending'] ?? DEFAULT_RUFF_CONFIG.format!['line-ending'],
            'docstring-code-format': config.format?.['docstring-code-format'] ?? DEFAULT_RUFF_CONFIG.format!['docstring-code-format'],
            'docstring-code-line-length': config.format?.['docstring-code-line-length'] ?? DEFAULT_RUFF_CONFIG.format!['docstring-code-line-length'],
        }
    };
}

/**
 * Deep merge two config objects, with source taking precedence.
 */
function mergeConfig(defaults: RuffConfig, source: RuffConfig): RuffConfig {
    return {
        'line-length': source['line-length'] ?? defaults['line-length'],
        'indent-width': source['indent-width'] ?? defaults['indent-width'],
        format: {
            ...defaults.format,
            ...source.format,
        }
    };
}
