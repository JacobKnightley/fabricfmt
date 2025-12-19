use sparkfmt_core::format_sql;

#[test]
fn test_keywords_uppercase() {
    let input = "select a from t where x=1";
    let result = format_sql(input).unwrap();
    
    assert!(result.contains("SELECT"));
    assert!(result.contains("FROM"));
    assert!(result.contains("WHERE"));
    assert!(!result.contains("select"));
    assert!(!result.contains("from"));
    assert!(!result.contains("where"));
}

#[test]
fn test_builtin_function_count_uppercase() {
    let input = "select count(*) from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("COUNT(*)"));
    assert!(!result.contains("count(*)"));
}

#[test]
fn test_builtin_function_upper_uppercase() {
    let input = "select upper(x) from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("UPPER(x)"));
    assert!(!result.contains("upper(x)"));
}

#[test]
fn test_builtin_function_sum_uppercase() {
    let input = "select sum(col) from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("SUM(col)"));
    assert!(!result.contains("sum(col)"));
}

#[test]
fn test_multiple_builtin_functions() {
    let input = "select count(*), sum(x), avg(y), min(z), max(w) from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("COUNT(*)"));
    assert!(result.contains("SUM(x)"));
    assert!(result.contains("AVG(y)"));
    assert!(result.contains("MIN(z)"));
    assert!(result.contains("MAX(w)"));
}

#[test]
fn test_user_defined_function_preserved() {
    let input = "select MyCustomFunc(x) from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // User-defined functions should preserve casing
    assert!(result.contains("MyCustomFunc(x)"));
    assert!(!result.contains("MYCUSTOMFUNC(x)"));
    assert!(!result.contains("mycustomfunc(x)"));
}

#[test]
fn test_user_defined_function_lowercase_preserved() {
    let input = "select my_udf(a,b) from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // User-defined functions should preserve casing
    assert!(result.contains("my_udf(a,b)"));
    assert!(!result.contains("MY_UDF(a,b)"));
}

#[test]
fn test_mixed_builtin_and_udf() {
    let input = "select count(*), MyCustomFunc(x), sum(y), my_udf(z) from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    // Built-in functions uppercase
    assert!(result.contains("COUNT(*)"));
    assert!(result.contains("SUM(y)"));
    
    // User-defined functions preserved
    assert!(result.contains("MyCustomFunc(x)"));
    assert!(result.contains("my_udf(z)"));
}

#[test]
fn test_nested_builtin_functions() {
    let input = "select upper(lower(trim(x))) from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("UPPER(LOWER(TRIM(x)))"));
}

#[test]
fn test_case_insensitive_builtin_recognition() {
    // Test that functions are recognized regardless of input casing
    let input1 = "select COUNT(*) from t";
    let input2 = "select count(*) from t";
    let input3 = "select CoUnT(*) from t";
    
    let result1 = format_sql(input1).unwrap();
    let result2 = format_sql(input2).unwrap();
    let result3 = format_sql(input3).unwrap();
    
    // All should produce uppercase
    assert!(result1.contains("COUNT(*)"));
    assert!(result2.contains("COUNT(*)"));
    assert!(result3.contains("COUNT(*)"));
}

#[test]
fn test_string_functions_uppercase() {
    let input = "select concat(a,b), substring(c,1,5), trim(d) from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("CONCAT(a,b)"));
    assert!(result.contains("SUBSTRING(c,1,5)"));
    assert!(result.contains("TRIM(d)"));
}

#[test]
fn test_coalesce_function() {
    let input = "select coalesce(a,b,'default') from t";
    let result = format_sql(input).unwrap();
    
    println!("Result:\n{}", result);
    
    assert!(result.contains("COALESCE(a,b,'default')"));
}

