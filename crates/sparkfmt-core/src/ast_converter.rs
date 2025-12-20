//! AST Converter (Stub Implementation)
//!
//! Converts ANTLR parse tree (Concrete Syntax Tree) to our formatting IR.
//!
//! This is a minimal stub that compiles and returns errors for all cases.
//! The actual implementation is being incrementally built.

use std::rc::Rc;
use antlr4rust::tree::ParseTree;

use crate::error::FormatError;
use crate::ir::*;
use crate::generated::sqlbaseparser::*;

/// Convert ANTLR parse tree to IR Statement.
///
/// Currently returns an error - full implementation is WIP.
pub fn convert(tree: &SingleStatementContextAll) -> Result<Statement, FormatError> {
    // Get the full text to include in error message for debugging
    let sql_text = tree.get_text();
    
    Err(FormatError::new(format!(
        "AST conversion not yet fully implemented for: {}",
        if sql_text.len() > 100 { &sql_text[..100] } else { &sql_text }
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::antlr_parser;

    #[test]
    fn test_convert_returns_error() {
        let result = antlr_parser::parse("SELECT 1");
        assert!(result.is_ok());
        
        let parse_result = result.unwrap();
        let convert_result = convert(&parse_result.tree);
        
        // Currently returns error - this will change as we implement
        assert!(convert_result.is_err());
    }
}
