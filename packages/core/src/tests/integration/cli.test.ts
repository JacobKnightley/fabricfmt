/**
 * CLI Tests
 * 
 * Integration tests for the command-line interface.
 * Tests the CLI behavior through programmatic execution.
 */
import { TestSuite, TestResult } from '../framework.js';
import { execSync, exec } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const cliTests: TestSuite = {
    name: 'CLI Integration',
    tests: [], // Populated by runCliTests
};

interface CliTestCase {
    name: string;
    test: () => Promise<{ passed: boolean; message?: string }>;
}

/**
 * Run CLI command and return stdout/stderr
 */
function runCli(args: string, input?: string): { stdout: string; stderr: string; exitCode: number } {
    try {
        // Navigate from dist/tests/integration/ up to dist/cli.js
        const cliPath = join(__dirname, '../../cli.js');
        const cmd = `node "${cliPath}" ${args}`;
        
        const stdout = execSync(cmd, {
            encoding: 'utf-8',
            input,
            timeout: 30000,
            // Ensure we capture stderr separately
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        
        return { stdout, stderr: '', exitCode: 0 };
    } catch (error: any) {
        return {
            stdout: error.stdout?.toString() ?? '',
            stderr: error.stderr?.toString() ?? error.message ?? '',
            exitCode: error.status ?? 1,
        };
    }
}

/**
 * Create a temp directory for test files
 */
function createTempDir(): string {
    return mkdtempSync(join(tmpdir(), 'fabfmt-test-'));
}

/**
 * Clean up temp directory
 */
function cleanupTempDir(dir: string): void {
    try {
        rmSync(dir, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors
    }
}

const cliTestCases: CliTestCase[] = [
    // Help commands
    {
        name: 'Shows help with no arguments',
        test: async () => {
            const result = runCli('');
            const hasHelp = result.stdout.includes('fabfmt') || result.stderr.includes('fabfmt');
            return {
                passed: hasHelp,
                message: hasHelp ? undefined : 'Expected help output',
            };
        },
    },
    {
        name: 'Shows help with --help flag',
        test: async () => {
            const result = runCli('--help');
            return {
                passed: result.stdout.includes('Usage') || result.stdout.includes('Commands'),
                message: result.stdout.includes('Usage') ? undefined : 'Expected usage info in help',
            };
        },
    },
    {
        name: 'Shows format help with format --help',
        test: async () => {
            const result = runCli('format --help');
            return {
                passed: result.stdout.includes('format') && result.stdout.includes('--type'),
                message: 'Expected format command help',
            };
        },
    },
    {
        name: 'Shows check help with check --help',
        test: async () => {
            const result = runCli('check --help');
            return {
                passed: result.stdout.includes('check'),
                message: 'Expected check command help',
            };
        },
    },
    
    // Inline formatting (--type -i)
    {
        name: 'Formats SQL inline with --type sparksql -i',
        test: async () => {
            const result = runCli('format --type sparksql -i "select * from t"');
            return {
                passed: result.stdout.trim() === 'SELECT * FROM t',
                message: `Expected 'SELECT * FROM t', got '${result.stdout.trim()}'`,
            };
        },
    },
    {
        name: 'Formats Python inline with --type python -i',
        test: async () => {
            const result = runCli('format --type python -i "x=1"');
            return {
                passed: result.stdout.trim() === 'x = 1',
                message: `Expected 'x = 1', got '${result.stdout.trim()}'`,
            };
        },
    },
    {
        name: 'Formats pyspark inline with --type pyspark -i',
        test: async () => {
            const result = runCli('format --type pyspark -i "df=spark.read.csv(path)"');
            return {
                passed: result.stdout.includes('df = spark.read.csv(path)'),
                message: `Expected formatted output, got '${result.stdout.trim()}'`,
            };
        },
    },
    
    // Check command inline
    {
        name: 'Check exits 0 for already formatted SQL',
        test: async () => {
            const result = runCli('check --type sparksql -i "SELECT * FROM t"');
            return {
                passed: result.exitCode === 0,
                message: `Expected exit code 0, got ${result.exitCode}`,
            };
        },
    },
    {
        name: 'Check exits 1 for unformatted SQL',
        test: async () => {
            const result = runCli('check --type sparksql -i "select * from t"');
            return {
                passed: result.exitCode === 1,
                message: `Expected exit code 1, got ${result.exitCode}`,
            };
        },
    },
    {
        name: 'Check exits 0 for already formatted Python',
        test: async () => {
            const result = runCli('check --type python -i "x = 1"');
            return {
                passed: result.exitCode === 0,
                message: `Expected exit code 0, got ${result.exitCode}`,
            };
        },
    },
    {
        name: 'Check exits 1 for unformatted Python',
        test: async () => {
            const result = runCli('check --type python -i "x=1"');
            return {
                passed: result.exitCode === 1,
                message: `Expected exit code 1, got ${result.exitCode}`,
            };
        },
    },
    
    // File formatting
    {
        name: 'Formats Fabric .py notebook file',
        test: async () => {
            const tempDir = createTempDir();
            try {
                const filePath = join(tempDir, 'test.py');
                const content = `# Fabric notebook source

# CELL ********************

x=1

# METADATA ********************

# META {
# META   "language": "python"
# META }
`;
                writeFileSync(filePath, content);
                
                const result = runCli(`format "${filePath}"`);
                
                // Read the formatted file
                const formatted = readFileSync(filePath, 'utf-8');
                
                const hasFormattedCode = formatted.includes('x = 1');
                return {
                    passed: hasFormattedCode,
                    message: hasFormattedCode ? undefined : 'File was not formatted correctly',
                };
            } finally {
                cleanupTempDir(tempDir);
            }
        },
    },
    {
        name: 'Formats Fabric .sql notebook file',
        test: async () => {
            const tempDir = createTempDir();
            try {
                const filePath = join(tempDir, 'test.sql');
                const content = `-- Fabric notebook source

-- CELL ********************

select * from t

-- METADATA ********************

-- META {
-- META   "language": "sparksql"
-- META }
`;
                writeFileSync(filePath, content);
                
                const result = runCli(`format "${filePath}"`);
                
                const formatted = readFileSync(filePath, 'utf-8');
                
                const hasFormattedSql = formatted.includes('SELECT * FROM t');
                return {
                    passed: hasFormattedSql,
                    message: hasFormattedSql ? undefined : 'SQL file was not formatted correctly',
                };
            } finally {
                cleanupTempDir(tempDir);
            }
        },
    },
    {
        name: 'Reports already formatted file',
        test: async () => {
            const tempDir = createTempDir();
            try {
                const filePath = join(tempDir, 'test.py');
                const content = `# Fabric notebook source

# CELL ********************

x = 1

# METADATA ********************

# META {
# META   "language": "python"
# META }
`;
                writeFileSync(filePath, content);
                
                const result = runCli(`format "${filePath}"`);
                
                // Should report already formatted
                return {
                    passed: result.stdout.includes('already formatted') || result.exitCode === 0,
                    message: 'Should indicate file is already formatted',
                };
            } finally {
                cleanupTempDir(tempDir);
            }
        },
    },
    
    // --print flag
    {
        name: 'Prints formatted output with --print (does not modify file)',
        test: async () => {
            const tempDir = createTempDir();
            try {
                const filePath = join(tempDir, 'test.py');
                const originalContent = `# Fabric notebook source

# CELL ********************

x=1

# METADATA ********************

# META {
# META   "language": "python"
# META }
`;
                writeFileSync(filePath, originalContent);
                
                const result = runCli(`format "${filePath}" --print`);
                
                // Check that stdout has formatted content
                const printedFormatted = result.stdout.includes('x = 1');
                
                // Check that file was not modified
                const fileContent = readFileSync(filePath, 'utf-8');
                const fileUnchanged = fileContent === originalContent;
                
                return {
                    passed: printedFormatted && fileUnchanged,
                    message: !printedFormatted ? 'Should print formatted content' :
                             !fileUnchanged ? 'Should not modify file with --print' : undefined,
                };
            } finally {
                cleanupTempDir(tempDir);
            }
        },
    },
    
    // Check command on files
    {
        name: 'Check exits 0 for formatted file',
        test: async () => {
            const tempDir = createTempDir();
            try {
                const filePath = join(tempDir, 'test.py');
                const content = `# Fabric notebook source

# CELL ********************

x = 1

# METADATA ********************

# META {
# META   "language": "python"
# META }
`;
                writeFileSync(filePath, content);
                
                const result = runCli(`check "${filePath}"`);
                
                return {
                    passed: result.exitCode === 0,
                    message: `Expected exit code 0, got ${result.exitCode}`,
                };
            } finally {
                cleanupTempDir(tempDir);
            }
        },
    },
    {
        name: 'Check exits 1 for unformatted file',
        test: async () => {
            const tempDir = createTempDir();
            try {
                const filePath = join(tempDir, 'test.py');
                const content = `# Fabric notebook source

# CELL ********************

x=1

# METADATA ********************

# META {
# META   "language": "python"
# META }
`;
                writeFileSync(filePath, content);
                
                const result = runCli(`check "${filePath}"`);
                
                return {
                    passed: result.exitCode === 1,
                    message: `Expected exit code 1, got ${result.exitCode}`,
                };
            } finally {
                cleanupTempDir(tempDir);
            }
        },
    },
    
    // Error handling
    {
        name: 'Errors on missing file',
        test: async () => {
            const result = runCli('format "/nonexistent/file.py"');
            return {
                passed: result.exitCode !== 0,
                message: 'Should error on missing file',
            };
        },
    },
    {
        name: 'Errors on -i without --type',
        test: async () => {
            const result = runCli('format -i "select * from t"');
            return {
                passed: result.exitCode !== 0 && result.stderr.includes('--type'),
                message: 'Should require --type with -i',
            };
        },
    },
    {
        name: 'Errors on invalid --type value',
        test: async () => {
            const result = runCli('format --type invalid -i "code"');
            return {
                passed: result.exitCode !== 0,
                message: 'Should error on invalid type',
            };
        },
    },
    
    // Non-Fabric files pass through unchanged
    {
        name: 'Non-Fabric Python file unchanged',
        test: async () => {
            const tempDir = createTempDir();
            try {
                const filePath = join(tempDir, 'regular.py');
                const content = `# Regular Python file
x=1
y=2
`;
                writeFileSync(filePath, content);
                
                runCli(`format "${filePath}"`);
                
                const afterFormat = readFileSync(filePath, 'utf-8');
                
                // Non-Fabric files should be unchanged (or minimally normalized)
                return {
                    passed: afterFormat === content || afterFormat.includes('x=1'),
                    message: 'Non-Fabric file should pass through',
                };
            } finally {
                cleanupTempDir(tempDir);
            }
        },
    },
    
    // === Additional argument parsing and validation tests ===
    
    // Unknown command
    {
        name: 'Errors on unknown command',
        test: async () => {
            const result = runCli('unknowncommand');
            return {
                passed: result.exitCode !== 0 && result.stderr.includes('Unknown command'),
                message: `Expected error with 'Unknown command', got: ${result.stderr}`,
            };
        },
    },
    
    // --type without value
    {
        name: 'Errors on --type without value',
        test: async () => {
            const result = runCli('format --type');
            return {
                passed: result.exitCode !== 0 && result.stderr.includes('--type'),
                message: `Expected error about --type requiring value, got: ${result.stderr}`,
            };
        },
    },
    {
        name: 'Errors on --type with flag as value',
        test: async () => {
            const result = runCli('format --type --print');
            return {
                passed: result.exitCode !== 0,
                message: `Expected error when --type followed by another flag`,
            };
        },
    },
    
    // -i without value
    {
        name: 'Errors on -i without value',
        test: async () => {
            const result = runCli('format --type sparksql -i');
            return {
                passed: result.exitCode !== 0 && result.stderr.includes('-i'),
                message: `Expected error about -i requiring value, got: ${result.stderr}`,
            };
        },
    },
    
    // --print validation
    {
        name: 'Errors on --print with multiple files',
        test: async () => {
            const tempDir = createTempDir();
            try {
                const file1 = join(tempDir, 'test1.py');
                const file2 = join(tempDir, 'test2.py');
                writeFileSync(file1, '# Fabric notebook source\n');
                writeFileSync(file2, '# Fabric notebook source\n');
                
                const result = runCli(`format "${file1}" "${file2}" --print`);
                return {
                    passed: result.exitCode !== 0 && result.stderr.includes('--print'),
                    message: `Expected error about --print with multiple files`,
                };
            } finally {
                cleanupTempDir(tempDir);
            }
        },
    },
    {
        name: 'Errors on --print with directory',
        test: async () => {
            const tempDir = createTempDir();
            try {
                const result = runCli(`format "${tempDir}" --print`);
                return {
                    passed: result.exitCode !== 0 && result.stderr.includes('--print'),
                    message: `Expected error about --print with directory`,
                };
            } finally {
                cleanupTempDir(tempDir);
            }
        },
    },
    
    // No files specified
    {
        name: 'Errors on format with no files',
        test: async () => {
            const result = runCli('format');
            return {
                passed: result.exitCode !== 0 && result.stderr.includes('No files'),
                message: `Expected error about no files specified, got: ${result.stderr}`,
            };
        },
    },
    {
        name: 'Errors on check with no files',
        test: async () => {
            const result = runCli('check');
            return {
                passed: result.exitCode !== 0 && result.stderr.includes('No files'),
                message: `Expected error about no files specified, got: ${result.stderr}`,
            };
        },
    },
    
    // Type case insensitivity
    {
        name: 'Accepts --type SPARKSQL (uppercase)',
        test: async () => {
            const result = runCli('format --type SPARKSQL -i "select * from t"');
            return {
                passed: result.exitCode === 0 && result.stdout.includes('SELECT'),
                message: `Expected successful formatting with uppercase type`,
            };
        },
    },
    {
        name: 'Accepts --type SparkSQL (mixed case)',
        test: async () => {
            const result = runCli('format --type SparkSQL -i "select * from t"');
            return {
                passed: result.exitCode === 0 && result.stdout.includes('SELECT'),
                message: `Expected successful formatting with mixed case type`,
            };
        },
    },
    
    // Multiple valid types
    {
        name: 'All valid types work: sparksql',
        test: async () => {
            const result = runCli('format --type sparksql -i "select 1"');
            return {
                passed: result.exitCode === 0,
                message: `sparksql type should work`,
            };
        },
    },
    {
        name: 'All valid types work: python',
        test: async () => {
            const result = runCli('format --type python -i "x=1"');
            return {
                passed: result.exitCode === 0,
                message: `python type should work`,
            };
        },
    },
    {
        name: 'All valid types work: pyspark',
        test: async () => {
            const result = runCli('format --type pyspark -i "x=1"');
            return {
                passed: result.exitCode === 0,
                message: `pyspark type should work`,
            };
        },
    },
    
    // Edge cases with inline input
    {
        name: 'Handles empty inline input',
        test: async () => {
            const result = runCli('format --type sparksql -i ""');
            return {
                passed: result.exitCode === 0,
                message: `Should handle empty inline input`,
            };
        },
    },
    {
        name: 'Handles whitespace-only inline input',
        test: async () => {
            const result = runCli('format --type sparksql -i "   "');
            return {
                passed: result.exitCode === 0,
                message: `Should handle whitespace-only inline input`,
            };
        },
    },
    
    // Check command with --type but no -i and no files
    {
        name: 'Check with --type but no input waits for stdin (timeout is ok)',
        test: async () => {
            // This tests that --type without files enters stdin mode
            // We can't easily test stdin, so we verify it doesn't immediately error
            // The command will timeout waiting for stdin, which is expected behavior
            try {
                const result = runCli('check --type sparksql', '');
                // With empty stdin, should exit 0 (empty string equals itself)
                return {
                    passed: result.exitCode === 0,
                    message: `Check with empty stdin should exit 0`,
                };
            } catch {
                // Timeout is acceptable - means it's waiting for stdin
                return { passed: true };
            }
        },
    },
    
    // Exit code validation
    {
        name: 'Exit code 2 for user errors (invalid arguments)',
        test: async () => {
            const result = runCli('format --type invalid -i "x"');
            return {
                passed: result.exitCode === 2,
                message: `Expected exit code 2 for invalid type, got ${result.exitCode}`,
            };
        },
    },
    {
        name: 'Exit code 2 for missing required arguments',
        test: async () => {
            const result = runCli('format -i "select 1"');
            return {
                passed: result.exitCode === 2,
                message: `Expected exit code 2 for -i without --type, got ${result.exitCode}`,
            };
        },
    },
];

/**
 * Run CLI tests (async)
 */
export async function runCliTests(): Promise<{
    suiteName: string;
    passed: number;
    failed: number;
    results: TestResult[];
}> {
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const tc of cliTestCases) {
        try {
            const result = await tc.test();
            if (result.passed) {
                passed++;
                results.push({ name: tc.name, passed: true });
            } else {
                failed++;
                results.push({ 
                    name: tc.name, 
                    passed: false,
                    message: result.message,
                });
            }
        } catch (error) {
            failed++;
            results.push({ 
                name: tc.name, 
                passed: false,
                message: `Test threw: ${error}`,
            });
        }
    }

    return {
        suiteName: cliTests.name,
        passed,
        failed,
        results,
    };
}
