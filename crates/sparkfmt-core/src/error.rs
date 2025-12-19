use std::fmt;

#[derive(Debug, Clone)]
pub struct FormatError {
    pub message: String,
}

impl FormatError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl fmt::Display for FormatError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Format error: {}", self.message)
    }
}

impl std::error::Error for FormatError {}
