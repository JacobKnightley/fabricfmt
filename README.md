# fabricfmt

A fast, opinionated formatter for **Microsoft Fabric notebooks** with **Spark SQL** and **Python** support.

## Why?

Fabric notebooks deserve proper formatting. This tool speaks Spark SQL natively — supporting `LATERAL VIEW`, `DISTRIBUTE BY`, Delta Lake's `MERGE`, and all Spark-specific syntax. Python cells are formatted with Ruff.

Formatting is personal. This tool reflects our team's preferences — comma-first SQL, uppercase keywords, specific indentation rules. It won't be for everyone, and that's fine. The goal isn't to please everyone; it's to format Fabric notebooks consistently, with zero decisions required.

Built on [Apache Spark's official ANTLR grammar](https://github.com/apache/spark/tree/master/sql/api/src/main/antlr4/org/apache/spark/sql/catalyst/parser) for SQL and [Ruff](https://docs.astral.sh/ruff/) for Python — if Spark supports it, the formatter supports it.

## Features

### SQL Formatting
- **Uppercase keywords**: `SELECT`, `FROM`, `WHERE`, `JOIN`, etc.
- **Uppercase built-in functions**: `COUNT()`, `SUM()`, `COALESCE()`, `ROW_NUMBER()`, etc.
- **Preserve identifier casing**: Table names, column names, UDFs stay as written
- **Comma-first style**: Leading commas for easy column management
- **Smart line breaks**: Expands multi-item clauses, keeps simple queries compact
- **Context-aware**: Distinguishes `a.order` (column) from `ORDER BY` (keyword)

### Python Formatting (via Ruff WASM)
- **PEP 8 compliant**: Consistent spacing, indentation, and line breaks
- **Magic command support**: Handles `%%sql`, `%run`, and other notebook magics
- **Configurable**: Uses `ruff.toml` or `pyproject.toml` for customization

### Notebook Support
- **Fabric notebooks**: Format SQL and Python cells in `.py`, `.scala`, `.r`, and `.sql` files
- **Mixed language**: Format SQL cells within Python notebooks and vice versa

## Installation

```bash
npm install -g @jacobknightley/fabricfmt
```

## Usage

```bash
# Format a file in-place
fabricfmt query.sql                 # Generic SQL file
fabricfmt notebook-content.py       # Python notebook
fabricfmt notebook-content.scala    # Scala notebook
fabricfmt notebook-content.r        # R notebook
fabricfmt notebook-content.sql      # SQL notebook

# Format an entire directory (recursively finds .sql, .py, .scala, .r files)
fabricfmt ./src
fabricfmt C:\dev\my-project

# Check if formatting needed (exit code 1 if changes needed)
fabricfmt -c query.sql
fabricfmt -c ./src
```

```bash
# Format inline SQL
fabricfmt -i "select * from t"

# Format from stdin
echo "select * from t" | fabricfmt

# Print to stdout instead of in-place
fabricfmt --stdout query.sql
```

### Language Selection

```bash
# Format SQL only (skip Python cells)
fabricfmt --no-python ./src

# Format Python only (skip SQL cells)  
fabricfmt --no-sql ./src

# Verbose output (shows what was formatted)
fabricfmt -v ./src
```

## Python Configuration

Python formatting uses Ruff under the hood. Configure it via `ruff.toml` or `pyproject.toml`:

```toml
# ruff.toml
line-length = 140
indent-width = 4

[format]
quote-style = "double"
indent-style = "space"
```

Or in `pyproject.toml`:

```toml
[tool.ruff]
line-length = 140
indent-width = 4

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
```

## Formatting Control

### Skip Formatting with `fmt: off`

```sql
-- fmt: off
select   x,y,z   from   t   -- Preserved exactly as-is
```

### Suppress Line Expansion with `fmt: inline`

```sql
SELECT COALESCE(a, b, c, d, e, f, g, h, i, j) -- fmt: inline
FROM t
```

## Style Guide

See [STYLE_GUIDE.md](STYLE_GUIDE.md) for complete formatting rules and examples.

Key conventions:
- 4-space indentation
- 140-character line width threshold
- Leading commas (comma-first)
- `AS` for column aliases, no `AS` for table aliases
- Keywords and built-in functions uppercase
- User-defined functions preserve original casing

---

# Contributing

## Development Setup

### Prerequisites

- Node.js 18+
- Python 3.8+ (for ANTLR build script)
- Java 11+ (for ANTLR code generation)

### Build

```bash
# Install dependencies
npm install

# Build everything (downloads grammar, generates parser, compiles TypeScript)
npm run build

# Or build steps individually:
npm run build:antlr   # Download grammar & generate JS parser
npm run build:ts      # Compile TypeScript
```

### Test

```bash
# Run all tests
npm test

# Run with failure details
npm run test:verbose
```

## Architecture

The formatter is **100% grammar-driven** — the Apache Spark ANTLR grammar files are the single source of truth. No hardcoded keyword or function lists.

```
Input SQL
    ↓
Dual Lexing (uppercase for token types, original for text)
    ↓
ANTLR Parser (SqlBaseParser)
    ↓
Parse Tree
    ↓
ParseTreeAnalyzer
    - Marks identifier positions
    - Marks function call positions
    - Marks clause boundary positions
    - Detects simple vs complex queries
    ↓
Token Formatter
    - Grammar-driven keyword detection
    - Context-aware casing
    - Smart expansion decisions
    ↓
Formatted SQL
```

### Key Design Decisions

1. **Grammar-Driven Keywords**: A token is a keyword if `symbolicNames[tokenType] === text.toUpperCase()`
2. **Parse Tree Context**: Visitor pattern identifies where tokens appear (identifier vs keyword position)
3. **Dual Lexing**: Parse uppercase SQL for correct token types, but preserve original text
4. **Modular Design**: ~200-400 line modules for maintainability

### Module Overview

| Module | Purpose |
|--------|---------|
| `formatter.ts` | Main SQL formatting orchestration & public API |
| `parse-tree-analyzer.ts` | AST visitor collecting formatting context |
| `token-utils.ts` | Grammar-derived token detection |
| `formatting-context.ts` | State management during formatting |
| `output-builder.ts` | Output construction with column tracking |
| `types.ts` | TypeScript interfaces |
| `noqa-detector.ts` | Formatting suppression directives |
| `notebook-formatter.ts` | Fabric notebook cell handling (SQL + Python) |
| `config.ts` | Ruff configuration loading |
| `formatters/` | Extensible formatter system |
| `formatters/python-formatter.ts` | Python formatting via Ruff WASM |
| `formatters/sql-formatter.ts` | SQL formatter wrapper |

### Project Structure

```
src/
├── formatter.ts           # Main SQL formatting logic
├── parse-tree-analyzer.ts # Parse tree visitor
├── types.ts               # TypeScript interfaces
├── cli.ts                 # Command-line interface
├── index.ts               # Public exports
├── config.ts              # Ruff config loading
├── notebook-formatter.ts  # Notebook cell formatting
├── formatters/            # Extensible formatter system
│   ├── types.ts           # Formatter interfaces
│   ├── index.ts           # Formatter registry
│   ├── python-formatter.ts # Ruff WASM wrapper
│   └── sql-formatter.ts   # SQL formatter wrapper
├── tests/                 # Test suites (332+ tests)
│   ├── framework.ts       # Test runner
│   ├── index.ts           # Test entry point
│   └── *.test.ts          # Test files by feature
└── generated/             # ANTLR-generated parser

grammar/                   # Apache Spark grammar (downloaded)
├── SqlBaseLexer.g4
└── SqlBaseParser.g4

.build/
└── build_antlr_js.py      # Grammar download & parser generation
```

## Adding Tests

Tests are organized by feature in `src/tests/`:

```typescript
// src/tests/my-feature.test.ts
import { TestSuite } from './framework.js';

export const myFeatureTests: TestSuite = {
    name: 'My Feature',
    tests: [
        {
            name: 'Description of test case',
            input: 'select ...',
            expected: 'SELECT ...',
        },
    ],
};
```

Then import and add to `src/tests/index.ts`.