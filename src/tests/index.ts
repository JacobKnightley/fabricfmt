/**
 * Main Test Runner for Spark SQL Formatter
 * 
 * Runs all test suites and reports results.
 */
import { formatSql } from '../formatter.js';
import { runSuite, printSuiteResult, printSummary, SuiteResult } from './framework.js';

// Import all SQL test suites
import { basicSelectTests, tablesampleTests } from './sql/basic-select.test.js';
import { casingTests, aliasTests, builtinFunctionCasingTests } from './sql/casing.test.js';
import { joinTests } from './sql/joins.test.js';
import { groupByTests, distributionTests } from './sql/grouping.test.js';
import { whereTests, selectExceptTests } from './sql/where.test.js';
import { subqueryTests, cteTests, setOperationTests, subqueryIndentationTests } from './sql/subqueries.test.js';
import { caseExpressionTests, literalTests, unaryOperatorTests, arrayAccessTests, nestedFunctionTests, lambdaTests } from './sql/expressions.test.js';
import { commentTests, hintTests } from './sql/comments.test.js';
import { ddlTests } from './sql/ddl.test.js';
import { dmlTests } from './sql/dml.test.js';
import { windowFunctionTests, namedWindowTests, nullHandlingTests } from './sql/window-functions.test.js';
import { pivotTests, unpivotTests, lateralViewTests, stackTests } from './sql/table-operators.test.js';
import { castTests, doubleColonCastTests } from './sql/type-casts.test.js';
import { utilityTests } from './sql/utility.test.js';
import { magicCommandsTests } from './sql/magic-commands.test.js';
import { semicolonTests } from './sql/semicolon.test.js';
import { fmtOffTests, fmtInlineTests } from './sql/format-directives.test.js';
import { compactQueryTests } from './sql/compact-query.test.js';
import { magicSqlSuite, runMagicSqlSuite } from './sql/magic-sql.test.js';
import { deltaLakeTests } from './sql/delta-lake.test.js';

// All test suites in order
const allSuites = [
    // Core SELECT
    basicSelectTests,
    tablesampleTests,
    
    // Casing
    casingTests,
    aliasTests,
    builtinFunctionCasingTests,
    
    // Clauses
    joinTests,
    groupByTests,
    distributionTests,
    whereTests,
    selectExceptTests,
    
    // Subqueries
    subqueryTests,
    cteTests,
    setOperationTests,
    subqueryIndentationTests,
    
    // Expressions
    caseExpressionTests,
    literalTests,
    unaryOperatorTests,
    arrayAccessTests,
    lambdaTests,
    nestedFunctionTests,
    
    // Type casts
    castTests,
    doubleColonCastTests,
    
    // Window functions
    windowFunctionTests,
    namedWindowTests,
    nullHandlingTests,
    
    // Table operators
    pivotTests,
    unpivotTests,
    lateralViewTests,
    stackTests,
    
    // Comments
    commentTests,
    hintTests,
    
    // DDL/DML
    ddlTests,
    dmlTests,
    
    // Utility
    utilityTests,
    magicCommandsTests,
    semicolonTests,
    
    // Formatting control
    fmtOffTests,
    fmtInlineTests,
    compactQueryTests,
    
    // Extensions (not in grammar)
    deltaLakeTests,
];

function main(): void {
    console.log('='.repeat(50));
    console.log('Spark SQL Formatter Test Suite');
    console.log('='.repeat(50));

    const results: SuiteResult[] = [];
    const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');

    for (const suite of allSuites) {
        const result = runSuite(suite, formatSql);
        results.push(result);
        printSuiteResult(result, verbose);
    }

    // Run magic SQL suite with its custom runner
    const magicResult = runMagicSqlSuite();
    const magicSuiteResult: SuiteResult = {
        suiteName: magicSqlSuite.name,
        passed: magicResult.passed,
        failed: magicResult.failed,
        results: magicResult.results,
    };
    results.push(magicSuiteResult);
    printSuiteResult(magicSuiteResult, verbose);

    const { totalPassed, totalFailed } = printSummary(results);

    // Exit with appropriate code
    if (totalFailed > 0) {
        process.exit(1);
    }
}

main();