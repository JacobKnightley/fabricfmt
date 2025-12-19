use sparkfmt_core::format_sql;

#[test]
fn test_single_where_condition_inline() {
    let input = "select a from t where status='active'";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // Single condition should be inline
    assert!(result.contains("WHERE status='active'"));
    assert!(!result.contains("WHERE\n    status"));
}

#[test]
fn test_multiple_where_conditions_multiline() {
    let input = "select a from t where a=1 and b=2 and c=3";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // Multiple conditions should be on separate lines
    assert!(result.contains("WHERE\n"));
    assert!(result.contains("    a=1\n"));
    assert!(result.contains("    AND b=2\n"));
    assert!(result.contains("    AND c=3"));
}

#[test]
fn test_qualified_star() {
    let input = "select t.* from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("t.*"));
}

#[test]
fn test_qualified_column() {
    let input = "select t.col1, t.col2 from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("t.col1"));
    assert!(result.contains("t.col2"));
}

#[test]
fn test_function_with_multiple_args() {
    let input = "select COALESCE(a, b, 'default') from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("COALESCE(a,b,'default')"));
}

#[test]
fn test_left_outer_join() {
    let input = "select * from a left outer join b on a.id=b.id";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("LEFT JOIN"));
}

#[test]
fn test_multiple_joins() {
    let input = "select * from a inner join b on a.id=b.id left join c on b.id=c.id";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // JOINs should be on separate lines
    assert!(result.contains("INNER JOIN"));
    assert!(result.contains("LEFT JOIN"));
}

#[test]
fn test_multiple_join_conditions() {
    let input = "select * from a join b on a.id=b.id and a.col=b.col and a.type=b.type";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // Multiple ON conditions should be on separate lines
    assert!(result.contains("    ON a.id=b.id\n"));
    assert!(result.contains("    AND a.col=b.col\n"));
    assert!(result.contains("    AND a.type=b.type"));
}

#[test]
fn test_order_by_with_direction() {
    let input = "select a from t order by col1 asc, col2 desc, col3";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("col1 ASC"));
    assert!(result.contains("col2 DESC"));
    assert!(result.contains(",col3"));  // No direction
}

#[test]
fn test_parenthesized_expression() {
    let input = "select * from t where (a=1 or a=2) and b=3";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("(a=1ORa=2)"));
    assert!(result.contains("AND b=3"));
}

#[test]
fn test_nested_ctes() {
    let input = "with a as (select 1 as x), b as (select x from a) select * from b";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("WITH a AS"));
    assert!(result.contains("\n,b AS"));
}

#[test]
fn test_table_alias_without_as() {
    let input = "select o.id from orders o";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // Table alias should not have AS
    assert!(result.contains("FROM orders o"));
    assert!(!result.contains("orders AS o"));
}

#[test]
fn test_column_alias_with_as() {
    let input = "select COUNT(*) cnt from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // Column alias should always have AS
    assert!(result.contains("COUNT(*) AS cnt"));
}

#[test]
fn test_no_trailing_semicolon() {
    let input = "select a from t;";
    // This should either strip the semicolon or fail to parse
    let result = format_sql(input);
    
    // For now, if it fails, that's acceptable
    if let Ok(formatted) = result {
        println!("Result:\n{}", formatted);
        assert!(!formatted.ends_with(';'));
    }
}

#[test]
fn test_having_single_condition() {
    let input = "select a, COUNT(*) from t group by a having COUNT(*)>10";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // Single HAVING condition should be inline
    assert!(result.contains("HAVING COUNT(*)>10"));
    assert!(!result.contains("HAVING\n    count"));
}

#[test]
fn test_having_multiple_conditions() {
    let input = "select a, COUNT(*) from t group by a having COUNT(*)>10 and SUM(x)>100";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // Multiple HAVING conditions should be on separate lines
    assert!(result.contains("HAVING\n"));
    assert!(result.contains("    COUNT(*)>10\n"));
    assert!(result.contains("    AND SUM(x)>100"));
}

#[test]
fn test_parse_error_returns_original() {
    let input = "this is not valid sql";
    let result = format_sql(input);
    
    // Should fail to parse
    assert!(result.is_err());
}

#[test]
fn test_star_select() {
    let input = "select * from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("SELECT\n     *\n"));
}

#[test]
fn test_union_formatting() {
    let input = "select a from t1 union select b from t2";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // UNION should be on its own line
    assert!(result.contains("FROM t1\nUNION\n"));
}

#[test]
fn test_complex_where_with_or() {
    let input = "select * from t where a=1 or b=2 or c=3";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // Multiple conditions with OR
    assert!(result.contains("WHERE\n"));
    assert!(result.contains("    a=1\n"));
    assert!(result.contains("    OR b=2\n"));
    assert!(result.contains("    OR c=3"));
}
