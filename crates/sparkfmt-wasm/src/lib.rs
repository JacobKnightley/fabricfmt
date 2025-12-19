use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn format_sql(input: &str) -> String {
    // Set up panic hook for better error messages
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
    
    // Format the SQL, returning original input on error
    match sparkfmt_core::format_sql(input) {
        Ok(formatted) => formatted,
        Err(_) => input.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_sql() {
        let input = "select a from t";
        let result = format_sql(input);
        assert!(result.contains("SELECT"));
    }
}
