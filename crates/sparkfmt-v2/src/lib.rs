//! Spark SQL Formatter v2
//!
//! A clean, ANTLR-based SQL formatter. This implementation:
//! 1. Uses ANTLR to parse SQL (guaranteed correct parsing)
//! 2. Walks the parse tree and emits formatted SQL directly
//! 3. Focuses on formatting output, not complex IR transformations
//!
//! # Design Philosophy
//!
//! Instead of: Parse -> Complex IR -> Format
//! We do: Parse -> Walk tree -> Emit formatted tokens
//!
//! The ANTLR tree IS our IR. We just need to walk it intelligently.

pub mod formatter;
pub mod printer;

pub use formatter::format_sql;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_select() {
        let result = format_sql("SELECT a, b FROM t").unwrap();
        println!("Result:\n{}", result);
        assert!(result.contains("SELECT"));
        assert!(result.contains("FROM"));
    }

    #[test]
    fn test_basic_formatting() {
        let input = "select a,b from t where x=1";
        let result = format_sql(input).unwrap();
        println!("Result:\n{}", result);
        
        // Keywords should be uppercase
        assert!(result.contains("SELECT"));
        assert!(result.contains("FROM"));
        assert!(result.contains("WHERE"));
    }
}
