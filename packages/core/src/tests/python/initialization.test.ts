/**
 * Python Formatter Initialization Tests
 * 
 * Tests that the Python formatter initializes correctly in different environments.
 * These are async tests that run separately from the sync test framework.
 */
import { TestSuite, TestResult } from '../framework.js';
import { 
    initializePythonFormatter, 
    isPythonFormatterReady,
    formatCell,
} from '../../cell-formatter.js';
import { resetPythonFormatter, getPythonFormatter } from '../../formatters/python/index.js';

export const initializationTests: TestSuite = {
    name: 'Python Formatter Initialization',
    tests: [], // Populated by runInitializationTests
};

interface InitTestCase {
    name: string;
    test: () => Promise<{ passed: boolean; message?: string }>;
}

const initTests: InitTestCase[] = [
    {
        name: 'Formatter initializes successfully in Node.js',
        test: async () => {
            // Reset to test fresh initialization
            resetPythonFormatter();
            
            try {
                await initializePythonFormatter();
                const ready = isPythonFormatterReady();
                return { 
                    passed: ready, 
                    message: ready ? undefined : 'Formatter not ready after initialization',
                };
            } catch (error) {
                return { 
                    passed: false, 
                    message: `Initialization failed: ${error}`,
                };
            }
        },
    },
    {
        name: 'Formatter works after initialization',
        test: async () => {
            // Ensure initialized (idempotent)
            await initializePythonFormatter();
            
            const result = formatCell('x=1', 'python');
            if (result.error) {
                return { passed: false, message: `Format error: ${result.error}` };
            }
            if (result.formatted !== 'x = 1') {
                return { 
                    passed: false, 
                    message: `Unexpected output: "${result.formatted}" (expected "x = 1")`,
                };
            }
            return { passed: true };
        },
    },
    {
        name: 'Multiple initializations are idempotent',
        test: async () => {
            // Call initialize multiple times
            await initializePythonFormatter();
            await initializePythonFormatter();
            await initializePythonFormatter();
            
            const result = formatCell('y=2', 'python');
            if (result.error) {
                return { passed: false, message: `Format error after multiple inits: ${result.error}` };
            }
            return { passed: result.formatted === 'y = 2' };
        },
    },
    {
        name: 'Formatter instance isReady state is correct',
        test: async () => {
            // Reset formatter to get fresh instance
            resetPythonFormatter();
            
            // Get new formatter instance (not yet initialized)
            const formatter = getPythonFormatter();
            
            // Before initialization, instance should not be ready
            const notReadyBefore = !formatter.isReady();
            
            // Initialize the instance directly
            await formatter.initialize();
            
            // After initialization, instance should be ready
            const readyAfter = formatter.isReady();
            
            // Re-initialize global state for subsequent tests
            await initializePythonFormatter();
            
            return { 
                passed: notReadyBefore && readyAfter,
                message: !notReadyBefore ? 'Formatter was ready before init' : 
                         !readyAfter ? 'Formatter not ready after init' : undefined,
            };
        },
    },
    {
        name: 'pyspark cell type works same as python',
        test: async () => {
            await initializePythonFormatter();
            
            const result = formatCell('x=1', 'pyspark');
            if (result.error) {
                return { passed: false, message: `Format error: ${result.error}` };
            }
            return { 
                passed: result.formatted === 'x = 1',
                message: result.formatted !== 'x = 1' ? `Got: ${result.formatted}` : undefined,
            };
        },
    },
    {
        name: 'Unknown cell type returns unchanged',
        test: async () => {
            await initializePythonFormatter();
            
            const input = 'some random content';
            const result = formatCell(input, 'unknown' as any);
            
            return { 
                passed: result.formatted === input && !result.changed,
                message: result.formatted !== input ? `Content was modified: ${result.formatted}` : undefined,
            };
        },
    },
];

/**
 * Run initialization tests (async)
 */
export async function runInitializationTests(): Promise<{
    suiteName: string;
    passed: number;
    failed: number;
    results: TestResult[];
}> {
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const tc of initTests) {
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
        suiteName: initializationTests.name,
        passed,
        failed,
        results,
    };
}
