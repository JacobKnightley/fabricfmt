/**
 * Expression Tests (CASE, operators, literals)
 */
import { TestSuite } from './framework.js';

export const caseExpressionTests: TestSuite = {
    name: 'CASE Expressions',
    tests: [
        {
            name: 'CASE WHEN (single branch inline)',
            input: 'select case when a = 1 then \'yes\' else \'no\' end from t',
            expected: 'SELECT CASE WHEN a = 1 THEN \'yes\' ELSE \'no\' END\nFROM t',
        },
        {
            name: 'CASE with single WHEN (inline)',
            input: 'select case when x = 1 then "a" else "b" end from t',
            expected: 'SELECT CASE WHEN x = 1 THEN "A" ELSE "B" END\nFROM t',
        },
        {
            name: 'CASE with multiple WHEN (multiline)',
            input: 'select case when status = 1 then "active" when status = 2 then "pending" when status = 3 then "closed" else "unknown" end from t',
            expected: 'SELECT\n     CASE\n        WHEN status = 1 THEN "ACTIVE"\n        WHEN status = 2 THEN "PENDING"\n        WHEN status = 3 THEN "CLOSED"\n        ELSE "UNKNOWN"\n     END\nFROM t',
        },
        {
            name: 'CASE without ELSE',
            input: 'select case when x = 1 then "a" when x = 2 then "b" end from t',
            expected: 'SELECT\n     CASE\n        WHEN x = 1 THEN "A"\n        WHEN x = 2 THEN "B"\n     END\nFROM t',
        },
        
        // Nested CASE: inner CASE inside THEN stays inline when it's single-WHEN
        // The outer CASE follows normal multiline rules (>1 WHEN triggers multiline)
        {
            name: 'CASE inside CASE THEN should indent inner CASE',
            input: 'select case when a = 1 then case when b = 2 then \'x\' else \'y\' end else \'z\' end from t',
            expected: 'SELECT CASE WHEN a = 1 THEN CASE WHEN b = 2 THEN \'x\' ELSE \'y\' END ELSE \'z\' END\nFROM t',
        },
    ],
};

export const castTests: TestSuite = {
    name: 'CAST and Type Conversion',
    tests: [
        {
            name: 'Double-colon cast (no spaces)',
            input: 'select x::string from t',
            expected: 'SELECT x::STRING\nFROM t',
        },
        {
            name: 'CAST (no space after name)',
            input: 'select cast(x as string) from t',
            expected: 'SELECT CAST(x AS STRING)\nFROM t',
        },
    ],
};

export const literalTests: TestSuite = {
    name: 'Literals',
    tests: [
        {
            name: 'String literals preserved exactly',
            input: 'select * from t where name = \'John Doe\'',
            expected: 'SELECT *\nFROM t\nWHERE name = \'John Doe\'',
        },
        {
            name: 'DATE literal',
            input: "select date '2024-01-01' from t",
            expected: "SELECT DATE '2024-01-01'\nFROM t",
        },
        {
            name: 'TIMESTAMP literal',
            input: "select timestamp '2024-01-01 12:00:00' from t",
            expected: "SELECT TIMESTAMP '2024-01-01 12:00:00'\nFROM t",
        },
    ],
};

export const unaryOperatorTests: TestSuite = {
    name: 'Unary Operators',
    tests: [
        {
            name: 'Unary minus (no space)',
            input: 'select -x from t',
            expected: 'SELECT -x\nFROM t',
        },
        {
            name: 'Unary plus (no space)',
            input: 'select +y from t',
            expected: 'SELECT +y\nFROM t',
        },
        {
            name: 'Multiple unary operators',
            input: 'select -x, +y from t',
            expected: 'SELECT\n     -x\n    ,+y\nFROM t',
        },
        {
            name: 'Unary minus in expression',
            input: 'select a + -b from t',
            expected: 'SELECT a + -b\nFROM t',
        },
    ],
};

export const nestedFunctionTests: TestSuite = {
    name: 'Nested Function Formatting',
    tests: [
        {
            name: 'Single-arg nested functions stay inline',
            input: 'select upper(lower(trim(name))) from t',
            expected: 'SELECT UPPER(LOWER(TRIM(name)))\nFROM t',
        },
        {
            name: 'Multi-arg function without nested calls stays inline',
            input: 'select coalesce(a, b, c) from t',
            expected: 'SELECT COALESCE(a, b, c)\nFROM t',
        },
        {
            name: 'Short multi-arg with nested calls stays inline (under 140 chars)',
            input: 'select coalesce(upper(a), lower(b)) from t',
            expected: 'SELECT COALESCE(UPPER(a), LOWER(b))\nFROM t',
        },
        {
            name: 'Long multi-arg function expands when line exceeds 140 chars',
            input: 'select coalesce(upper(very_long_column_name_one), lower(very_long_column_name_two), trim(another_very_long_column_name_three), concat(col_four, col_five)) from t',
            expected: 'SELECT COALESCE(\n         UPPER(very_long_column_name_one)\n        ,LOWER(very_long_column_name_two)\n        ,TRIM(another_very_long_column_name_three)\n        ,CONCAT(col_four, col_five)\n    )\nFROM t',
        },
        {
            name: 'Deeply nested functions expand based on line position',
            input: 'select conv(right(md5(upper(concat(coalesce(VeryLongTable.VeryLongColumnName, AnotherLongAlias.AnotherLongColumn), SomeOtherReallyLongColumnName))), 16), 16, -10) from t',
            expected: 'SELECT CONV(\n         RIGHT(\n             MD5(UPPER(CONCAT(\n                 COALESCE(VeryLongTable.VeryLongColumnName, AnotherLongAlias.AnotherLongColumn)\n                ,SomeOtherReallyLongColumnName\n            )))\n            ,16\n        )\n        ,16\n        ,-10\n    )\nFROM t',
        },
        {
            name: 'Short NVL2 stays inline (under 140 chars)',
            input: 'select nvl2(flag, upper(yes_val), lower(no_val)) from t',
            expected: 'SELECT NVL2(flag, UPPER(yes_val), LOWER(no_val))\nFROM t',
        },
    ],
};

export const arrayAccessTests: TestSuite = {
    name: 'Array/Map Access',
    tests: [
        {
            name: 'Array access with single element',
            input: 'select arr[0] from t',
            expected: 'SELECT arr[0]\nFROM t',
        },
        {
            name: 'Array access with multiple elements',
            input: 'select arr[0], arr[1], arr[2] from t',
            expected: 'SELECT\n     arr[0]\n    ,arr[1]\n    ,arr[2]\nFROM t',
        },
        {
            name: 'Map access with string key',
            input: 'select map["key"] from t',
            expected: 'SELECT map["KEY"]\nFROM t',
        },
        {
            name: 'Array access with expression',
            input: 'select arr[i + 1] from t',
            expected: 'SELECT arr[i + 1]\nFROM t',
        },
    ],
};
