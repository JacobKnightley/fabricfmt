/// Comprehensive list of Spark SQL keywords
/// Sourced from SqlBaseLexer.g4 SPARK-KEYWORD-LIST
///
/// This module provides case-insensitive keyword checking for Spark SQL.

use std::collections::HashSet;
use lazy_static::lazy_static;

lazy_static! {
    static ref KEYWORDS: HashSet<&'static str> = {
        let mut set = HashSet::new();
        
        // Core SQL keywords
        set.insert("SELECT");
        set.insert("FROM");
        set.insert("WHERE");
        set.insert("AND");
        set.insert("OR");
        set.insert("NOT");
        set.insert("AS");
        set.insert("ON");
        set.insert("IN");
        set.insert("IS");
        set.insert("NULL");
        set.insert("TRUE");
        set.insert("FALSE");
        set.insert("DISTINCT");
        set.insert("ALL");
        
        // JOIN keywords
        set.insert("JOIN");
        set.insert("INNER");
        set.insert("LEFT");
        set.insert("RIGHT");
        set.insert("FULL");
        set.insert("OUTER");
        set.insert("CROSS");
        set.insert("NATURAL");
        set.insert("SEMI");
        set.insert("ANTI");
        
        // Aggregate and grouping
        set.insert("GROUP");
        set.insert("BY");
        set.insert("HAVING");
        set.insert("ORDER");
        set.insert("SORT");
        set.insert("CLUSTER");
        set.insert("DISTRIBUTE");
        set.insert("LIMIT");
        set.insert("OFFSET");
        
        // Set operations
        set.insert("UNION");
        set.insert("INTERSECT");
        set.insert("EXCEPT");
        set.insert("MINUS");
        
        // CTE and subqueries
        set.insert("WITH");
        set.insert("RECURSIVE");
        
        // DDL keywords
        set.insert("CREATE");
        set.insert("DROP");
        set.insert("ALTER");
        set.insert("RENAME");
        set.insert("TRUNCATE");
        set.insert("REPLACE");
        set.insert("ADD");
        set.insert("DELETE");
        set.insert("UPDATE");
        set.insert("INSERT");
        set.insert("OVERWRITE");
        set.insert("INTO");
        set.insert("VALUES");
        set.insert("SET");
        
        // Table and database objects
        set.insert("TABLE");
        set.insert("VIEW");
        set.insert("DATABASE");
        set.insert("SCHEMA");
        set.insert("CATALOG");
        set.insert("NAMESPACE");
        set.insert("INDEX");
        set.insert("PARTITION");
        set.insert("PARTITIONED");
        set.insert("COLUMN");
        set.insert("COLUMNS");
        set.insert("COMMENT");
        
        // Table modifiers
        set.insert("TEMPORARY");
        set.insert("TEMP");
        set.insert("EXTERNAL");
        set.insert("GLOBAL");
        set.insert("LOCAL");
        set.insert("LATERAL");
        
        // Data types
        set.insert("ARRAY");
        set.insert("MAP");
        set.insert("STRUCT");
        set.insert("INT");
        set.insert("INTEGER");
        set.insert("BIGINT");
        set.insert("SMALLINT");
        set.insert("TINYINT");
        set.insert("DOUBLE");
        set.insert("FLOAT");
        set.insert("DECIMAL");
        set.insert("NUMERIC");
        set.insert("STRING");
        set.insert("VARCHAR");
        set.insert("CHAR");
        set.insert("BOOLEAN");
        set.insert("BINARY");
        set.insert("DATE");
        set.insert("TIMESTAMP");
        set.insert("INTERVAL");
        
        // Constraints
        set.insert("PRIMARY");
        set.insert("KEY");
        set.insert("UNIQUE");
        set.insert("FOREIGN");
        set.insert("REFERENCES");
        set.insert("CONSTRAINT");
        
        // Clauses
        set.insert("CASE");
        set.insert("WHEN");
        set.insert("THEN");
        set.insert("ELSE");
        set.insert("END");
        set.insert("IF");
        set.insert("EXISTS");
        set.insert("BETWEEN");
        set.insert("LIKE");
        set.insert("ILIKE");
        set.insert("RLIKE");
        set.insert("REGEXP");
        
        // Window functions
        set.insert("OVER");
        set.insert("PARTITION");
        set.insert("ROWS");
        set.insert("RANGE");
        set.insert("UNBOUNDED");
        set.insert("PRECEDING");
        set.insert("FOLLOWING");
        set.insert("CURRENT");
        set.insert("ROW");
        
        // Sort ordering
        set.insert("ASC");
        set.insert("ASCENDING");
        set.insert("DESC");
        set.insert("DESCENDING");
        set.insert("NULLS");
        set.insert("FIRST");
        set.insert("LAST");
        
        // Data manipulation
        set.insert("MERGE");
        set.insert("MATCHED");
        set.insert("USING");
        
        // File formats and storage
        set.insert("STORED");
        set.insert("LOCATION");
        set.insert("FORMAT");
        set.insert("DELIMITED");
        set.insert("FIELDS");
        set.insert("TERMINATED");
        set.insert("ESCAPED");
        set.insert("COLLECTION");
        set.insert("ITEMS");
        set.insert("KEYS");
        set.insert("LINES");
        set.insert("DEFINED");
        set.insert("SERDE");
        set.insert("SERDEPROPERTIES");
        set.insert("RECORDREADER");
        set.insert("RECORDWRITER");
        set.insert("TBLPROPERTIES");
        
        // File format types
        set.insert("PARQUET");
        set.insert("ORC");
        set.insert("AVRO");
        set.insert("JSON");
        set.insert("CSV");
        set.insert("TEXT");
        set.insert("TEXTFILE");
        set.insert("SEQUENCEFILE");
        set.insert("RCFILE");
        
        // Functions and transforms
        set.insert("TRANSFORM");
        set.insert("REDUCE");
        set.insert("TABLESAMPLE");
        set.insert("STRATIFY");
        
        // Pivot and unpivot
        set.insert("PIVOT");
        set.insert("UNPIVOT");
        set.insert("FOR");
        
        // Show and describe
        set.insert("SHOW");
        set.insert("DESCRIBE");
        set.insert("DESC");
        set.insert("EXPLAIN");
        set.insert("EXTENDED");
        set.insert("FORMATTED");
        set.insert("ANALYZE");
        set.insert("COMPUTE");
        set.insert("STATISTICS");
        set.insert("NOSCAN");
        
        // Cache and uncache
        set.insert("CACHE");
        set.insert("UNCACHE");
        set.insert("LAZY");
        set.insert("REFRESH");
        set.insert("CLEAR");
        
        // Metadata operations
        set.insert("MSCK");
        set.insert("REPAIR");
        set.insert("RECOVER");
        set.insert("EXPORT");
        set.insert("IMPORT");
        set.insert("LOAD");
        set.insert("DATA");
        set.insert("INPATH");
        
        // Functions and procedures
        set.insert("FUNCTION");
        set.insert("FUNCTIONS");
        set.insert("AGGREGATE");
        
        // Options
        set.insert("OPTIONS");
        set.insert("UNSET");
        
        // Transactions (Spark 3.x)
        set.insert("START");
        set.insert("COMMIT");
        set.insert("ROLLBACK");
        set.insert("TRANSACTION");
        
        // Logical operators
        set.insert("BOTH");
        set.insert("LEADING");
        set.insert("TRAILING");
        
        // Cast and convert
        set.insert("CAST");
        set.insert("CONVERT");
        
        // Window specification
        set.insert("WINDOW");
        
        // Additional keywords
        set.insert("OF");
        set.insert("TO");
        set.insert("AT");
        set.insert("ZONE");
        set.insert("TIMESTAMP_LTZ");
        set.insert("TIMESTAMP_NTZ");
        set.insert("DEC");
        set.insert("CURRENT_DATE");
        set.insert("CURRENT_TIMESTAMP");
        set.insert("DIV");
        set.insert("EVERY");
        set.insert("EXTRACT");
        set.insert("FLOOR");
        set.insert("GROUPING");
        set.insert("HOUR");
        set.insert("MINUTE");
        set.insert("MONTH");
        set.insert("SECOND");
        set.insert("YEAR");
        set.insert("DAY");
        set.insert("SYNC");
        set.insert("TABLESAMPLE");
        set.insert("USE");
        set.insert("PURGE");
        set.insert("RESTRICT");
        set.insert("CASCADE");
        set.insert("BUCKETS");
        set.insert("CLUSTERED");
        set.insert("SORTED");
        set.insert("SKEWED");
        set.insert("DIRECTORY");
        set.insert("TOUCH");
        set.insert("ARCHIVE");
        set.insert("UNARCHIVE");
        set.insert("FILEFORMAT");
        set.insert("COMPACT");
        set.insert("CONCATENATE");
        set.insert("CHANGE");
        set.insert("FIRST");
        set.insert("AFTER");
        set.insert("EXCHANGE");
        set.insert("SORT");
        set.insert("INPUTFORMAT");
        set.insert("OUTPUTFORMAT");
        set.insert("OWNER");
        set.insert("PRINCIPALS");
        set.insert("ROLE");
        set.insert("ROLES");
        set.insert("GRANT");
        set.insert("REVOKE");
        set.insert("PRIVILEGES");
        set.insert("OPTION");
        set.insert("DBPROPERTIES");
        set.insert("BUCKETS");
        set.insert("OUT");
        set.insert("LOCKS");
        set.insert("COMPACTIONS");
        set.insert("TRANSACTIONS");
        set.insert("CONF");
        set.insert("MATERIALIZED");
        
        set
    };
}

/// Check if a given string is a Spark SQL keyword (case-insensitive)
pub fn is_keyword(name: &str) -> bool {
    KEYWORDS.contains(name.to_uppercase().as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_keywords() {
        assert!(is_keyword("SELECT"));
        assert!(is_keyword("select"));
        assert!(is_keyword("Select"));
        assert!(is_keyword("FROM"));
        assert!(is_keyword("WHERE"));
        assert!(is_keyword("GROUP"));
        assert!(is_keyword("ORDER"));
        assert!(is_keyword("LIMIT"));
    }

    #[test]
    fn test_join_keywords() {
        assert!(is_keyword("JOIN"));
        assert!(is_keyword("INNER"));
        assert!(is_keyword("LEFT"));
        assert!(is_keyword("RIGHT"));
        assert!(is_keyword("FULL"));
        assert!(is_keyword("CROSS"));
    }

    #[test]
    fn test_ddl_keywords() {
        assert!(is_keyword("CREATE"));
        assert!(is_keyword("DROP"));
        assert!(is_keyword("ALTER"));
        assert!(is_keyword("TABLE"));
        assert!(is_keyword("VIEW"));
        assert!(is_keyword("DATABASE"));
    }

    #[test]
    fn test_not_keywords() {
        assert!(!is_keyword("my_table"));
        assert!(!is_keyword("column1"));
        assert!(!is_keyword("custom_func"));
    }
}
