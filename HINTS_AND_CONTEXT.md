# Query Hints and Context-Sensitive Identifiers - Implementation Status

## Overview

This document describes the implementation status of two advanced features for sparkfmt:
1. **Query Hints** - Spark SQL optimizer hints like `/*+ BROADCAST(table) */`
2. **Context-Sensitive Identifiers** - Only uppercase keywords in keyword positions

## Current Status

### ✅ Implemented: Context-Sensitive Identifier Handling

**Architecture:**

The formatter now uses a unified token approach where:
- **Lexer**: Uses `Token::Word(String)` instead of separate `Token::Keyword` and `Token::Identifier`
- **Parser**: Determines if a word is a keyword based on syntactic context
- **Formatter**: Emits keywords as UPPERCASE, preserves identifier casing

**File:** `src/parser.rs` (lines 26-30)

```rust
enum Token {
    Word(String), // Unified token preserving original casing
    Symbol(String),
    Number(String),
    StringLiteral(String),
    HintComment(String), // Query hint: /*+ ... */
    Eof,
}
```

**What Works:**

```sql
-- Input
SELECT order, key, value FROM items WHERE x = 1 AND y = 2

-- Output (identifiers preserve casing even if they match keyword names)
SELECT
     order
    ,key
    ,value
FROM items
WHERE
    x=1
    AND y=2
```

**Test Coverage:**

File: `tests/context_sensitive_tests.rs` - 10 tests covering:
- Column names preserving casing
- Columns named with keyword names (order, key, value)
- Qualified identifiers (a.order, b.select, c.from)
- ORDER BY with column named 'key'
- WHERE with AND operator vs column names
- Built-in functions vs UDFs
- Complex queries with mixed casing
- Table and column aliases

All 10 tests passing ✅


### ✅ Implemented: Hints Module

**File:** `src/hints.rs`

A complete hints module has been created with:
- Recognition of all standard Spark SQL hints
- Join hints: BROADCAST, BROADCASTJOIN, MAPJOIN, MERGE, SHUFFLE_MERGE, MERGEJOIN, SHUFFLE_HASH, SHUFFLE_REPLICATE_NL
- Partition hints: COALESCE, REPARTITION, REPARTITION_BY_RANGE, REBALANCE
- Case-insensitive `is_hint()` helper function
- Comprehensive test coverage (4 unit tests passing)

**What's Missing:**
- Parser integration to detect and parse hint comments `/*+ ... */`
- IR structures to store hint information
- Formatter integration to output formatted hints

**Next Steps:**
1. Extend lexer to distinguish hint comments from regular block comments (foundation exists)
2. Add hint parsing logic to extract hint names and arguments
3. Add hint nodes to the IR
4. Implement hint formatting in the printer

## Testing

### Context-Sensitive Identifier Tests

File: `tests/context_sensitive_tests.rs` - 10 tests, all passing

Tests cover:
1. Column names preserve casing
2. Columns named with keyword names (order, key, value) preserve casing
3. Qualified identifiers (a.order, b.select, c.from) preserve casing
4. ORDER BY keyword vs 'key' column name
5. WHERE with AND operator (keyword) vs column names
6. Built-in functions uppercase (COUNT, SUM, AVG)
7. User-defined functions preserve casing
8. Mixed built-in and UDF
9. Table and column aliases preserve casing
10. Complex query with mixed casing

### Hint Tests

File: `tests/hints_and_context_tests.rs`

- 4 hint formatting tests (currently ignored, awaiting parser integration)
- 4 unit tests in `src/hints.rs` (all passing)

### Running Tests

```bash
# Run context-sensitive tests
cargo test --test context_sensitive_tests

# Run all tests
cargo test

# Run hint module tests
cargo test --lib hints
```

## Summary

- ✅ **Context-sensitive identifier handling** - Fully implemented and tested
- ✅ **Hints module** - Ready and tested, awaiting parser integration
- 🚧 **Hint parsing** - Foundation in place, awaits parser/formatter integration

The architecture is now correct with unified Token::Word approach. The formatter properly handles identifiers that match keyword names, preserving their casing based on syntactic context.
