//! SQL Printer
//!
//! Handles the low-level output of formatted SQL.
//! Manages indentation, newlines, and token spacing.

use std::fmt::Write;

/// Printer state for building formatted output
pub struct Printer {
    output: String,
    indent_level: usize,
    at_line_start: bool,
    indent_string: String,
}

impl Printer {
    pub fn new() -> Self {
        Self {
            output: String::new(),
            indent_level: 0,
            at_line_start: true,
            indent_string: "    ".to_string(), // 4 spaces
        }
    }

    /// Get the final output
    pub fn finish(self) -> String {
        self.output.trim_end().to_string()
    }

    /// Write a token/word (handles indentation if at line start)
    pub fn write(&mut self, text: &str) {
        if self.at_line_start && !text.is_empty() {
            self.write_indent();
            self.at_line_start = false;
        }
        self.output.push_str(text);
    }

    /// Write text without any processing
    pub fn write_raw(&mut self, text: &str) {
        self.output.push_str(text);
        self.at_line_start = false;
    }

    /// Write a newline
    pub fn newline(&mut self) {
        self.output.push('\n');
        self.at_line_start = true;
    }

    /// Write a space (only if not at line start)
    pub fn space(&mut self) {
        if !self.at_line_start && !self.output.ends_with(' ') && !self.output.ends_with('\n') {
            self.output.push(' ');
        }
    }

    /// Increase indent level
    pub fn indent(&mut self) {
        self.indent_level += 1;
    }

    /// Decrease indent level
    pub fn dedent(&mut self) {
        if self.indent_level > 0 {
            self.indent_level -= 1;
        }
    }

    /// Write current indentation
    fn write_indent(&mut self) {
        for _ in 0..self.indent_level {
            self.output.push_str(&self.indent_string);
        }
    }

    /// Write n spaces (for specific indentation like comma-first)
    pub fn write_spaces(&mut self, n: usize) {
        for _ in 0..n {
            self.output.push(' ');
        }
        self.at_line_start = false;
    }

    /// Check if we're at line start
    pub fn is_at_line_start(&self) -> bool {
        self.at_line_start
    }
}

impl Default for Printer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_output() {
        let mut p = Printer::new();
        p.write("SELECT");
        p.newline();
        p.indent();
        p.write("a");
        let result = p.finish();
        assert_eq!(result, "SELECT\n    a");
    }

    #[test]
    fn test_comma_first() {
        let mut p = Printer::new();
        p.write("SELECT");
        p.newline();
        p.write_spaces(5);
        p.write("a");
        p.newline();
        p.write_spaces(4);
        p.write(",b");
        let result = p.finish();
        assert_eq!(result, "SELECT\n     a\n    ,b");
    }
}
