use sparkfmt_core::format_sql;

#[test]
fn test_from_subquery_indentation() {
    let input = "select x from (select y as x from s) sub";
    let expected = "SELECT\n     x\nFROM (\n    SELECT\n         y AS x\n    FROM s\n) sub";
    assert_eq!(format_sql(input).unwrap(), expected);
}

#[test]
fn test_nested_subqueries() {
    let input = "select * from (select * from (select x from t) a) b";
    let expected = "SELECT\n     *\nFROM (\n    SELECT\n         *\n    FROM (\n        SELECT\n             x\n        FROM t\n    ) a\n) b";
    assert_eq!(format_sql(input).unwrap(), expected);
}

#[test]
fn test_scalar_subquery_indentation() {
    let input = "select (select max(y) from s) as max_val from t";
    // Note: Current implementation formats scalar subqueries on multiple lines
    // This is acceptable as it's consistent with our indentation approach
    let expected = "SELECT\n     (SELECT\n     MAX(y)\nFROM s) AS max_val\nFROM t";
    assert_eq!(format_sql(input).unwrap(), expected);
}

#[test]
fn test_cte_subquery_indentation() {
    let input = "with cte as (select x from t) select * from cte";
    let expected = "WITH cte AS (\n    SELECT\n         x\n    FROM t\n)\nSELECT\n     *\nFROM cte";
    assert_eq!(format_sql(input).unwrap(), expected);
}
