//! Simple ANTLR-based SQL Formatter
//!
//! Basic rules:
//! - Keywords: UPPERCASE
//! - Identifiers: preserve casing
//! - Major keywords start new lines (SELECT, FROM, WHERE, etc.)

use antlr4rust::tree::ParseTree;

use sparkfmt_core::antlr_parser;
use sparkfmt_core::error::FormatError;
use sparkfmt_core::keywords::is_keyword;

/// Keywords that should start on a new line
const NEWLINE_KEYWORDS: &[&str] = &[
    "SELECT", "FROM", "WHERE", "GROUP", "HAVING", "ORDER", "LIMIT",
    "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "CROSS", "UNION",
    "INTERSECT", "EXCEPT", "WITH", "INSERT", "UPDATE", "DELETE",
    "CREATE", "DROP", "ALTER", "SET", "ON", "AND", "OR",
];

fn should_newline(word: &str) -> bool {
    let upper = word.to_uppercase();
    NEWLINE_KEYWORDS.contains(&upper.as_str())
}

/// Format SQL string
pub fn format_sql(input: &str) -> Result<String, FormatError> {
    // TODO: ANTLR validation disabled due to stack overflow in antlr4rust
    // Once fixed, uncomment:
    // let uppercased = input.to_uppercase();
    // let _parse_result = antlr_parser::parse(&uppercased)?;
    
    // Format the input: keywords uppercased, identifiers preserved
    format_text(input)
}

/// Simple tokenizer and formatter
fn format_text(input: &str) -> Result<String, FormatError> {
    let mut result = String::new();
    let mut chars = input.chars().peekable();
    let mut at_line_start = true;
    
    while let Some(&c) = chars.peek() {
        if c.is_whitespace() {
            // Skip whitespace - we'll add our own
            chars.next();
            continue;
        }
        
        if c == '\'' || c == '"' {
            // String literal - preserve exactly
            let quote = chars.next().unwrap();
            let mut literal = String::new();
            literal.push(quote);
            
            while let Some(&ch) = chars.peek() {
                literal.push(chars.next().unwrap());
                if ch == quote {
                    // Check for escaped quote
                    if chars.peek() == Some(&quote) {
                        literal.push(chars.next().unwrap());
                    } else {
                        break;
                    }
                }
            }
            
            if !at_line_start && !result.ends_with(' ') && !result.ends_with('\n') {
                result.push(' ');
            }
            result.push_str(&literal);
            at_line_start = false;
            continue;
        }
        
        if c == '-' && chars.clone().nth(1) == Some('-') {
            // Line comment - preserve
            let mut comment = String::new();
            while let Some(&ch) = chars.peek() {
                if ch == '\n' {
                    break;
                }
                comment.push(chars.next().unwrap());
            }
            if !result.ends_with(' ') && !result.ends_with('\n') {
                result.push(' ');
            }
            result.push_str(&comment);
            result.push('\n');
            at_line_start = true;
            continue;
        }
        
        if c == '/' && chars.clone().nth(1) == Some('*') {
            // Block comment - preserve
            let mut comment = String::new();
            comment.push(chars.next().unwrap()); // /
            comment.push(chars.next().unwrap()); // *
            
            while let Some(ch) = chars.next() {
                comment.push(ch);
                if ch == '*' && chars.peek() == Some(&'/') {
                    comment.push(chars.next().unwrap());
                    break;
                }
            }
            if !result.ends_with(' ') && !result.ends_with('\n') {
                result.push(' ');
            }
            result.push_str(&comment);
            at_line_start = false;
            continue;
        }
        
        if c.is_alphabetic() || c == '_' || c == '`' {
            // Word or quoted identifier
            let mut word = String::new();
            
            if c == '`' {
                // Backtick quoted identifier
                word.push(chars.next().unwrap());
                while let Some(&ch) = chars.peek() {
                    word.push(chars.next().unwrap());
                    if ch == '`' {
                        break;
                    }
                }
            } else {
                // Regular word
                while let Some(&ch) = chars.peek() {
                    if ch.is_alphanumeric() || ch == '_' {
                        word.push(chars.next().unwrap());
                    } else {
                        break;
                    }
                }
            }
            
            // Determine casing
            let formatted_word = if is_keyword(&word) {
                word.to_uppercase()
            } else {
                word // preserve identifier casing
            };
            
            // Should this start a new line?
            if should_newline(&formatted_word) && !at_line_start {
                result.push('\n');
                at_line_start = true;
            }
            
            // Add space if needed
            if !at_line_start && !result.ends_with(' ') && !result.ends_with('\n') 
                && !result.ends_with('(') && !result.ends_with('.') {
                result.push(' ');
            }
            
            result.push_str(&formatted_word);
            at_line_start = false;
            continue;
        }
        
        if c.is_numeric() {
            // Number
            let mut num = String::new();
            while let Some(&ch) = chars.peek() {
                if ch.is_alphanumeric() || ch == '.' || ch == 'e' || ch == 'E' 
                    || ch == '+' || ch == '-' {
                    num.push(chars.next().unwrap());
                } else {
                    break;
                }
            }
            
            if !at_line_start && !result.ends_with(' ') && !result.ends_with('\n')
                && !result.ends_with('(') {
                result.push(' ');
            }
            result.push_str(&num);
            at_line_start = false;
            continue;
        }
        
        // Operators and punctuation
        let ch = chars.next().unwrap();
        
        match ch {
            '(' | ')' | ',' | ';' => {
                result.push(ch);
                at_line_start = false;
            }
            '.' => {
                // No space around dots (for table.column)
                result.push(ch);
                at_line_start = false;
            }
            '=' | '<' | '>' | '!' | '+' | '-' | '*' | '/' | '%' | '&' | '|' | '^' => {
                // Operators - add space before if needed
                if !result.ends_with(' ') && !result.ends_with('\n') && !result.ends_with('(') {
                    result.push(' ');
                }
                result.push(ch);
                // Check for compound operators
                if let Some(&next) = chars.peek() {
                    if (ch == '<' && (next == '=' || next == '>' || next == '<'))
                        || (ch == '>' && (next == '=' || next == '>'))
                        || (ch == '!' && next == '=')
                        || (ch == '|' && next == '|')
                        || (ch == '&' && next == '&')
                        || (ch == ':' && next == ':')
                    {
                        result.push(chars.next().unwrap());
                    }
                }
                result.push(' ');
                at_line_start = false;
            }
            ':' => {
                // Could be :: cast or : parameter
                if chars.peek() == Some(&':') {
                    result.push(ch);
                    result.push(chars.next().unwrap());
                } else {
                    result.push(ch);
                }
                at_line_start = false;
            }
            _ => {
                result.push(ch);
                at_line_start = false;
            }
        }
    }
    
    Ok(result.trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_select() {
        let input = "select a from t";
        let result = format_sql(input).unwrap();
        assert!(result.contains("SELECT"));
        assert!(result.contains("FROM"));
        assert!(result.contains("\n")); // Should have newlines
    }

    #[test]
    fn test_preserves_identifiers() {
        let input = "select MyColumn from MyTable";
        let result = format_sql(input).unwrap();
        assert!(result.contains("MyColumn"));
        assert!(result.contains("MyTable"));
    }

    #[test]
    fn test_where_clause() {
        let input = "select a from t where x = 1";
        let result = format_sql(input).unwrap();
        assert!(result.contains("SELECT"));
        assert!(result.contains("FROM"));
        assert!(result.contains("WHERE"));
    }

    #[test]
    fn test_string_literal_preserved() {
        let input = "select 'hello world' from t";
        let result = format_sql(input).unwrap();
        assert!(result.contains("'hello world'"));
    }
}
