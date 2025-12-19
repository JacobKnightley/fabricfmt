use sparkfmt_core::format_sql;

#[test]
fn test_acceptance_example() {
    let input = "select a,b,count(*) c from t where x=1 and y=2 group by a,b having count(*)>1 order by a limit 10";
    
    let expected = r#"SELECT
     a
    ,b
    ,count(*) AS c
FROM t
WHERE
    x=1
    AND y=2
GROUP BY
     a
    ,b
HAVING count(*)>1
ORDER BY
     a
LIMIT 10"#;
    
    let result = format_sql(input).unwrap();
    
    println!("Input:\n{}\n", input);
    println!("Expected:\n{}\n", expected);
    println!("Got:\n{}\n", result);
    
    assert_eq!(result, expected);
}

#[test]
fn test_basic_select() {
    let input = "select a,b from t";
    let result = format_sql(input).unwrap();
    
    assert!(result.contains("SELECT"));
    assert!(result.contains("FROM"));
    assert!(result.contains("a"));
    assert!(result.contains("b"));
}

#[test]
fn test_select_with_join() {
    let input = "select a.id, b.name from orders a inner join customers b on a.cust_id=b.id";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("SELECT"));
    assert!(result.contains("INNER JOIN"));
    assert!(result.contains("ON"));
}

#[test]
fn test_select_distinct() {
    let input = "select distinct col1, col2 from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("SELECT DISTINCT"));
}

#[test]
fn test_with_cte() {
    let input = "with cte1 as (select id from users), cte2 as (select id from orders) select * from cte1";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("WITH"));
    assert!(result.contains("AS ("));
}

#[test]
fn test_union() {
    let input = "select a from t1 union all select a from t2";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("UNION ALL"));
}

#[test]
fn test_idempotence() {
    let input = "select a,b,count(*) c from t where x=1 and y=2 group by a,b having count(*)>1 order by a limit 10";
    
    let formatted1 = format_sql(input).unwrap();
    let formatted2 = format_sql(&formatted1).unwrap();
    
    assert_eq!(formatted1, formatted2, "Formatting should be idempotent");
}
