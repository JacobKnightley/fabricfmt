//! Simple CLI for sparkfmt-v2

use std::io::{self, Read};

fn main() {
    // Read from stdin or use command line arg
    let input = if let Some(sql) = std::env::args().nth(1) {
        sql
    } else {
        let mut buffer = String::new();
        io::stdin().read_to_string(&mut buffer).expect("Failed to read stdin");
        buffer
    };

    match sparkfmt_v2::format_sql(&input) {
        Ok(formatted) => print!("{}", formatted),
        Err(e) => {
            eprintln!("Error: {}", e);
            std::process::exit(1);
        }
    }
}
