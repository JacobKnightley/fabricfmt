/**
 * Spark-Specific Feature Tests
 */
import { TestSuite } from './framework.js';

export const sparkFeaturesTests: TestSuite = {
    name: 'Spark-Specific Features',
    tests: [
        {
            name: 'LATERAL VIEW EXPLODE',
            input: 'select a, b from t lateral view explode(arr) AS item',
            expected: 'SELECT\n     a\n    ,b\nFROM t LATERAL VIEW EXPLODE(arr) AS item',
        },
        {
            name: 'WINDOW clause (named window)',
            input: 'select a, sum(b) over w from t window w as (partition by c order by d)',
            expected: 'SELECT\n     a\n    ,SUM(b) OVER w\nFROM t WINDOW w AS (PARTITION BY c ORDER BY d)',
        },
        {
            name: 'PIVOT',
            input: 'select * from t pivot (sum(val) for col in (1, 2, 3))',
            expected: 'SELECT *\nFROM t PIVOT (SUM(val) FOR col IN (1, 2, 3))',
        },
        {
            name: 'CLUSTER BY',
            input: 'select a, b from t cluster by a',
            expected: 'SELECT\n     a\n    ,b\nFROM t CLUSTER BY a',
        },
        {
            name: 'DISTRIBUTE BY SORT BY',
            input: 'select a, b from t distribute by a sort by b',
            expected: 'SELECT\n     a\n    ,b\nFROM t DISTRIBUTE BY a SORT BY b',
        },
        {
            name: 'TABLESAMPLE',
            input: 'select * from t tablesample (10 percent)',
            expected: 'SELECT *\nFROM t TABLESAMPLE (10 PERCENT)',
        },
    ],
};

export const windowFunctionTests: TestSuite = {
    name: 'Window Function Formatting',
    tests: [
        {
            name: 'Short window spec stays inline',
            input: 'select row_number() over (partition by a order by b) from t',
            expected: 'SELECT ROW_NUMBER() OVER (PARTITION BY a ORDER BY b)\nFROM t',
        },
        {
            name: 'Window stays inline when line under 140 chars',
            input: 'select row_number() over (partition by very_long_column_name_one, very_long_column_name_two order by another_long_name) from t',
            expected: 'SELECT ROW_NUMBER() OVER (PARTITION BY very_long_column_name_one, very_long_column_name_two ORDER BY another_long_name)\nFROM t',
        },
        {
            name: 'Window expands when full line exceeds 140 chars',
            input: 'select row_number() over (partition by extremely_long_column_name_one, extremely_long_column_name_two, extremely_long_column_name_three order by yet_another_extremely_long_sort_column_name) from t',
            expected: 'SELECT ROW_NUMBER() OVER (\n        PARTITION BY extremely_long_column_name_one, extremely_long_column_name_two, extremely_long_column_name_three\n        ORDER BY yet_another_extremely_long_sort_column_name\n    )\nFROM t',
        },
        {
            name: 'Window with frame clause stays inline under 140',
            input: 'select sum(amount) over (partition by customer_id order by transaction_date rows between unbounded preceding and current row) from t',
            expected: 'SELECT SUM(amount) OVER (PARTITION BY customer_id ORDER BY transaction_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)\nFROM t',
        },
        {
            name: 'Window in CTE stays inline when under 140',
            input: 'with cte as (select lead(x) over (partition by very_long_name_a, very_long_name_b, very_long_name_c order by sort_col) from t) select * from cte',
            expected: 'WITH cte AS (\n    SELECT LEAD(x) OVER (PARTITION BY very_long_name_a, very_long_name_b, very_long_name_c ORDER BY sort_col)\n    FROM t\n)\nSELECT *\nFROM cte',
        },
    ],
};

export const lambdaTests: TestSuite = {
    name: 'Lambda Expressions',
    tests: [
        {
            name: 'Lambda expression (TRANSFORM)',
            input: 'select transform(arr, x -> x + 1) from t',
            expected: 'SELECT TRANSFORM(arr, x -> x + 1)\nFROM t',
        },
        {
            name: 'Lambda expression (FILTER)',
            input: 'select filter(arr, x -> x > 0) from t',
            expected: 'SELECT FILTER(arr, x -> x > 0)\nFROM t',
        },
        {
            name: 'Lambda expression (AGGREGATE)',
            input: 'select aggregate(arr, 0, (acc, x) -> acc + x) from t',
            expected: 'SELECT AGGREGATE(arr, 0, (acc, x) -> acc + x)\nFROM t',
        },
        
        // === BUG: AGGREGATE FUNCTION WITH 4 ARGS ===
        // 4-argument AGGREGATE with finish lambda should not split
        {
            name: 'AGGREGATE with 4 args (with finish)',
            input: 'select aggregate(arr, 0, (acc, x) -> acc + x, acc -> acc * 10) from t',
            expected: 'SELECT AGGREGATE(arr, 0, (acc, x) -> acc + x, acc -> acc * 10)\nFROM t',
        },
    ],
};

// === BUG: PIVOT FORMATTING ===
export const pivotFormattingTests: TestSuite = {
    name: 'PIVOT Formatting',
    tests: [
        {
            name: 'PIVOT with single aggregate',
            input: 'select * from t pivot (sum(x) for col in (\'a\', \'b\'))',
            expected: 'SELECT *\nFROM t PIVOT (SUM(x) FOR col IN (\'a\', \'b\'))',
        },
        {
            name: 'PIVOT with multiple aggregates should not split',
            input: 'select * from t pivot (sum(x) as s, avg(y) as a for col in (\'a\', \'b\'))',
            expected: 'SELECT *\nFROM t PIVOT (SUM(x) AS s, AVG(y) AS a FOR col IN (\'a\', \'b\'))',
        },
    ],
};

// === BUG: UNPIVOT AS CASING ===
export const unpivotFormattingTests: TestSuite = {
    name: 'UNPIVOT Formatting',
    tests: [
        {
            name: 'UNPIVOT AS should be uppercase',
            input: 'select * from t unpivot (val for col in (a as col_a, b as col_b))',
            expected: 'SELECT *\nFROM t UNPIVOT (val FOR col IN (a AS col_a, b AS col_b))',
        },
    ],
};

// === BUG: LATERAL VIEW COMMA SPACING ===
export const lateralViewFormattingTests: TestSuite = {
    name: 'LATERAL VIEW Formatting',
    tests: [
        {
            name: 'POSEXPLODE AS with two columns - no space before comma',
            input: 'select idx, item from t lateral view posexplode(arr) exp as idx, item',
            expected: 'SELECT\n     idx\n    ,item\nFROM t LATERAL VIEW POSEXPLODE(arr) exp AS idx, item',
        },
        {
            name: 'Multiple LATERAL VIEWs',
            input: 'select a, b from t lateral view explode(arr1) e1 as a lateral view explode(arr2) e2 as b',
            expected: 'SELECT\n     a\n    ,b\nFROM t LATERAL VIEW EXPLODE(arr1) e1 AS a LATERAL VIEW EXPLODE(arr2) e2 AS b',
        },
    ],
};
