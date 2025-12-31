# fabricfmt

A zero-config formatter for **Microsoft Fabric notebooks**.

## Packages

| Package                                      | Description                                |
| -------------------------------------------- | ------------------------------------------ |
| [@jacobknightley/fabricfmt](./packages/core) | Core formatting library (npm package)      |
| [fabricfmt-chromium](./packages/chromium)    | Chrome/Edge extension for Fabric notebooks |

## Philosophy

**Opinionated by design.** This formatter has one style, enforced everywhere, with no configuration options—and no plans to add any.

Built this for teams who want consistent notebook formatting without endless debates over style guides. The decisions are made. Your code looks the same every time.

The focus is on clean, consistent output—not tailored experiences or nuanced edge cases.

## CLI

### Installation

```bash
npm install -g @jacobknightley/fabricfmt
```

### Usage

```bash
# format
fabfmt format notebook.py                                # Format a single file
fabfmt format ./src                                      # Format all files in directory
fabfmt format query.sql --print                          # Print formatted output
fabfmt format --type sparksql -i "select * from t"       # Format inline string
echo "select * from t" | fabfmt format --type sparksql   # Format from stdin

# check (exit 1 if changes needed)
fabfmt check notebook.py                                # Check a single file
fabfmt check ./src                                      # Check all files in directory
fabfmt check --type sparksql -i "select * from t"       # Check inline string
echo "select * from t" | fabfmt check --type sparksql   # Check from stdin
```

## Browser Extension

Install the extension from the Chrome Web Store (coming soon) or load unpacked from `packages/chromium/dist`.

## Supported File Types

- `.py` — Python notebooks
- `.scala` — Scala notebooks
- `.r` — R notebooks
- `.sql` — SQL notebooks

## Supported Languages

- Spark SQL
- Python

> **Note:** All other language cells are preserved as-is.

### Spark SQL

---

Custom formatter built on [Apache Spark's official ANTLR grammar](https://github.com/apache/spark/tree/master/sql/api/src/main/antlr4/org/apache/spark/sql/catalyst/parser). If Spark supports the syntax, fabricfmt formats it correctly.

#### Style Overview

| Element                | Formatting                 |
| ---------------------- | -------------------------- |
| Keywords               | `UPPERCASE`                |
| Built-in functions     | `UPPERCASE()`              |
| User-defined functions | `preserveCase()`           |
| Identifiers            | `preserveCase`             |
| Indentation            | 4 spaces                   |
| Expression line width  | 140 characters (then wrap) |
| Commas                 | Leading (comma-first)      |

See [SQL_STYLE_GUIDE.md](./SQL_STYLE_GUIDE.md) for complete rules and examples.

#### Format Directives

##### `fmt: off`

Skip formatting entirely—preserves original whitespace and casing. Applicable only to the statement directly after it.

```sql
-- fmt: off
select  Col_A,Col_B B,Col_C   from   t;
select  Col_A,Col_B B,Col_C   from   t;
```

⬇️ Output

```sql
-- fmt: off
select  Col_A,Col_B B,Col_C   from   t;

SELECT
     Col_A
    ,Col_B AS B
    ,Col_C
FROM t;
```

##### `fmt: inline`

Suppress line wrapping for long expressions that are wrapped by default at 140 characters.

```sql
SELECT
     conv(right(md5(upper(concat(coalesce(VeryLongTable.VeryLongColumnName, AnotherLongAlias.AnotherLongColumn), SomeOtherReallyLongColumnName))), 16), 16, -10) AS A-- fmt: inline
    ,conv(right(md5(upper(concat(coalesce(VeryLongTable.VeryLongColumnName, AnotherLongAlias.AnotherLongColumn), SomeOtherReallyLongColumnName))), 16), 16, -10) AS B
FROM t
```

⬇️ Output

```sql
SELECT
     CONV(RIGHT(MD5(UPPER(CONCAT(COALESCE(VeryLongTable.VeryLongColumnName, AnotherLongAlias.AnotherLongColumn), SomeOtherReallyLongColumnName))), 16), 16, -10) AS A -- fmt: inline
    ,CONV(
         RIGHT(
             MD5(UPPER(CONCAT(
                 COALESCE(VeryLongTable.VeryLongColumnName, AnotherLongAlias.AnotherLongColumn)
                ,SomeOtherReallyLongColumnName
            )))
            ,16
        )
        ,16
        ,-10
    ) AS B
FROM t
```

### Python

---

Formatted via [Ruff](https://docs.astral.sh/ruff/) with sensible defaults:

- 140 character line width
- 4-space indentation
- Double quotes
- PEP 8 compliant

Magic commands (`%%sql`, `%run`, etc.) are preserved.

#### Format Directives

##### `fmt: off` / `fmt: on`

Disable formatting for a block of code:

```python
# fmt: off
matrix = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
]
# fmt: on
```

##### `fmt: skip`

Skip formatting for a single statement:

```python
result = some_function(a, b,    c,d,  e)  # fmt: skip
```

See [Ruff's documentation](https://docs.astral.sh/ruff/formatter/#format-suppression) for more details.
