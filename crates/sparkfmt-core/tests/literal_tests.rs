use sparkfmt_core::format_sql;

#[test]
fn test_date_literal() {
    let input = "select date '2024-01-01' from t";
    let expected = "SELECT\n     DATE '2024-01-01'\nFROM t";
    assert_eq!(format_sql(input).unwrap(), expected);
}

#[test]
fn test_timestamp_literal() {
    let input = "select timestamp '2024-01-01 12:00:00' from t";
    let expected = "SELECT\n     TIMESTAMP '2024-01-01 12:00:00'\nFROM t";
    assert_eq!(format_sql(input).unwrap(), expected);
}

#[test]
fn test_interval_literal() {
    let input = "select interval 1 day from t";
    let expected = "SELECT\n     INTERVAL 1 DAY\nFROM t";
    assert_eq!(format_sql(input).unwrap(), expected);
}

#[test]
fn test_interval_literal_months() {
    let input = "select interval 3 months from t";
    let expected = "SELECT\n     INTERVAL 3 MONTHS\nFROM t";
    assert_eq!(format_sql(input).unwrap(), expected);
}

#[test]
fn test_double_colon_cast() {
    let input = "select x::string from t";
    let expected = "SELECT\n     x::STRING\nFROM t";
    assert_eq!(format_sql(input).unwrap(), expected);
}

#[test]
fn test_double_colon_cast_complex() {
    let input = "select (x + y)::int from t";
    let expected = "SELECT\n     (x+y)::INT\nFROM t";
    assert_eq!(format_sql(input).unwrap(), expected);
}

#[test]
fn test_cast_vs_double_colon() {
    // CAST() syntax should remain CAST() but uppercase the type
    let input = "select cast(x as string) from t";
    let expected = "SELECT\n     CAST(x AS STRING)\nFROM t";
    assert_eq!(format_sql(input).unwrap(), expected);
}
