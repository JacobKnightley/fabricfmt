/// Comprehensive list of Spark SQL built-in functions
/// Sourced from FunctionRegistry.scala
///
/// This module provides case-insensitive function checking for Spark SQL built-in functions.

use std::collections::HashSet;
use lazy_static::lazy_static;

lazy_static! {
    static ref BUILTIN_FUNCTIONS: HashSet<&'static str> = {
        let mut set = HashSet::new();
        
        // Aggregate functions
        set.insert("COUNT");
        set.insert("SUM");
        set.insert("AVG");
        set.insert("MEAN");
        set.insert("MIN");
        set.insert("MAX");
        set.insert("FIRST");
        set.insert("LAST");
        set.insert("COLLECT_LIST");
        set.insert("COLLECT_SET");
        set.insert("STDDEV");
        set.insert("STDDEV_POP");
        set.insert("STDDEV_SAMP");
        set.insert("VAR_POP");
        set.insert("VAR_SAMP");
        set.insert("VARIANCE");
        set.insert("COVAR_POP");
        set.insert("COVAR_SAMP");
        set.insert("CORR");
        set.insert("PERCENTILE");
        set.insert("PERCENTILE_APPROX");
        set.insert("APPROX_PERCENTILE");
        set.insert("APPROX_COUNT_DISTINCT");
        set.insert("KURTOSIS");
        set.insert("SKEWNESS");
        set.insert("GROUPING");
        set.insert("GROUPING_ID");
        
        // String functions
        set.insert("CONCAT");
        set.insert("CONCAT_WS");
        set.insert("LENGTH");
        set.insert("CHAR_LENGTH");
        set.insert("CHARACTER_LENGTH");
        set.insert("LOWER");
        set.insert("UPPER");
        set.insert("TRIM");
        set.insert("LTRIM");
        set.insert("RTRIM");
        set.insert("LPAD");
        set.insert("RPAD");
        set.insert("SUBSTRING");
        set.insert("SUBSTR");
        set.insert("SPLIT");
        set.insert("REGEXP_EXTRACT");
        set.insert("REGEXP_EXTRACT_ALL");
        set.insert("REGEXP_REPLACE");
        set.insert("REPLACE");
        set.insert("TRANSLATE");
        set.insert("INSTR");
        set.insert("LOCATE");
        set.insert("POSITION");
        set.insert("ASCII");
        set.insert("CHR");
        set.insert("BASE64");
        set.insert("UNBASE64");
        set.insert("DECODE");
        set.insert("ENCODE");
        set.insert("FORMAT_STRING");
        set.insert("FORMAT_NUMBER");
        set.insert("INITCAP");
        set.insert("LEVENSHTEIN");
        set.insert("SOUNDEX");
        set.insert("REPEAT");
        set.insert("REVERSE");
        set.insert("SPACE");
        set.insert("SENTENCES");
        set.insert("OVERLAY");
        
        // Mathematical functions
        set.insert("ABS");
        set.insert("ACOS");
        set.insert("ASIN");
        set.insert("ATAN");
        set.insert("ATAN2");
        set.insert("CEIL");
        set.insert("CEILING");
        set.insert("COS");
        set.insert("COSH");
        set.insert("COT");
        set.insert("DEGREES");
        set.insert("EXP");
        set.insert("FLOOR");
        set.insert("LOG");
        set.insert("LOG10");
        set.insert("LOG2");
        set.insert("LN");
        set.insert("MOD");
        set.insert("PI");
        set.insert("POW");
        set.insert("POWER");
        set.insert("RADIANS");
        set.insert("RAND");
        set.insert("RANDN");
        set.insert("RANDOM");
        set.insert("ROUND");
        set.insert("BROUND");
        set.insert("SIGN");
        set.insert("SIGNUM");
        set.insert("SIN");
        set.insert("SINH");
        set.insert("SQRT");
        set.insert("TAN");
        set.insert("TANH");
        set.insert("TRUNCATE");
        set.insert("TRUNC");
        set.insert("BIN");
        set.insert("HEX");
        set.insert("UNHEX");
        set.insert("CONV");
        set.insert("FACTORIAL");
        set.insert("GREATEST");
        set.insert("LEAST");
        set.insert("POSITIVE");
        set.insert("NEGATIVE");
        set.insert("WIDTH_BUCKET");
        
        // Date and time functions
        set.insert("CURRENT_DATE");
        set.insert("CURRENT_TIMESTAMP");
        set.insert("CURRENT_TIMEZONE");
        set.insert("NOW");
        set.insert("DATE");
        set.insert("DATE_ADD");
        set.insert("DATE_SUB");
        set.insert("DATE_DIFF");
        set.insert("DATEDIFF");
        set.insert("DATE_FORMAT");
        set.insert("DATE_TRUNC");
        set.insert("DAY");
        set.insert("DAYOFWEEK");
        set.insert("DAYOFMONTH");
        set.insert("DAYOFYEAR");
        set.insert("EXTRACT");
        set.insert("FROM_UNIXTIME");
        set.insert("FROM_UTC_TIMESTAMP");
        set.insert("HOUR");
        set.insert("LAST_DAY");
        set.insert("MAKE_DATE");
        set.insert("MAKE_TIMESTAMP");
        set.insert("MAKE_INTERVAL");
        set.insert("MINUTE");
        set.insert("MONTH");
        set.insert("MONTHS_BETWEEN");
        set.insert("NEXT_DAY");
        set.insert("QUARTER");
        set.insert("SECOND");
        set.insert("TIMESTAMP");
        set.insert("TO_DATE");
        set.insert("TO_TIMESTAMP");
        set.insert("TO_UTC_TIMESTAMP");
        set.insert("TRUNC");
        set.insert("UNIX_TIMESTAMP");
        set.insert("WEEKDAY");
        set.insert("WEEKOFYEAR");
        set.insert("YEAR");
        set.insert("ADD_MONTHS");
        
        // Type conversion functions
        set.insert("CAST");
        set.insert("TYPEOF");
        
        // Conditional functions
        set.insert("COALESCE");
        set.insert("IF");
        set.insert("IFNULL");
        set.insert("NULLIF");
        set.insert("NVL");
        set.insert("NVL2");
        set.insert("NANVL");
        
        // Array functions
        set.insert("ARRAY");
        set.insert("ARRAY_CONTAINS");
        set.insert("ARRAY_DISTINCT");
        set.insert("ARRAY_EXCEPT");
        set.insert("ARRAY_INTERSECT");
        set.insert("ARRAY_JOIN");
        set.insert("ARRAY_MAX");
        set.insert("ARRAY_MIN");
        set.insert("ARRAY_POSITION");
        set.insert("ARRAY_REMOVE");
        set.insert("ARRAY_REPEAT");
        set.insert("ARRAY_SORT");
        set.insert("ARRAY_UNION");
        set.insert("ARRAYS_OVERLAP");
        set.insert("ARRAYS_ZIP");
        set.insert("FLATTEN");
        set.insert("SEQUENCE");
        set.insert("SHUFFLE");
        set.insert("SIZE");
        set.insert("SLICE");
        set.insert("SORT_ARRAY");
        set.insert("REVERSE");
        set.insert("ELEMENT_AT");
        
        // Map functions
        set.insert("MAP");
        set.insert("MAP_CONCAT");
        set.insert("MAP_ENTRIES");
        set.insert("MAP_FROM_ARRAYS");
        set.insert("MAP_FROM_ENTRIES");
        set.insert("MAP_KEYS");
        set.insert("MAP_VALUES");
        set.insert("MAP_FILTER");
        set.insert("MAP_ZIP_WITH");
        set.insert("STR_TO_MAP");
        
        // Struct functions
        set.insert("STRUCT");
        set.insert("NAMED_STRUCT");
        
        // JSON functions
        set.insert("FROM_JSON");
        set.insert("TO_JSON");
        set.insert("JSON_TUPLE");
        set.insert("GET_JSON_OBJECT");
        set.insert("SCHEMA_OF_JSON");
        
        // CSV functions
        set.insert("FROM_CSV");
        set.insert("TO_CSV");
        set.insert("SCHEMA_OF_CSV");
        
        // XML functions
        set.insert("FROM_XML");
        set.insert("TO_XML");
        set.insert("SCHEMA_OF_XML");
        set.insert("XPATH");
        set.insert("XPATH_BOOLEAN");
        set.insert("XPATH_DOUBLE");
        set.insert("XPATH_FLOAT");
        set.insert("XPATH_INT");
        set.insert("XPATH_LONG");
        set.insert("XPATH_NUMBER");
        set.insert("XPATH_SHORT");
        set.insert("XPATH_STRING");
        
        // Window functions
        set.insert("ROW_NUMBER");
        set.insert("RANK");
        set.insert("DENSE_RANK");
        set.insert("PERCENT_RANK");
        set.insert("NTILE");
        set.insert("CUME_DIST");
        set.insert("LAG");
        set.insert("LEAD");
        set.insert("FIRST_VALUE");
        set.insert("LAST_VALUE");
        set.insert("NTH_VALUE");
        
        // Bitwise functions
        set.insert("BIT_AND");
        set.insert("BIT_OR");
        set.insert("BIT_XOR");
        set.insert("BIT_COUNT");
        set.insert("BIT_GET");
        set.insert("GETBIT");
        set.insert("SHIFTLEFT");
        set.insert("SHIFTRIGHT");
        set.insert("SHIFTRIGHTUNSIGNED");
        
        // Hash functions
        set.insert("MD5");
        set.insert("SHA");
        set.insert("SHA1");
        set.insert("SHA2");
        set.insert("CRC32");
        set.insert("HASH");
        set.insert("XXHASH64");
        
        // Misc functions
        set.insert("ASSERT_TRUE");
        set.insert("RAISE_ERROR");
        set.insert("INPUT_FILE_BLOCK_LENGTH");
        set.insert("INPUT_FILE_BLOCK_START");
        set.insert("INPUT_FILE_NAME");
        set.insert("MONOTONICALLY_INCREASING_ID");
        set.insert("SPARK_PARTITION_ID");
        set.insert("VERSION");
        set.insert("CURRENT_CATALOG");
        set.insert("CURRENT_DATABASE");
        set.insert("CURRENT_SCHEMA");
        set.insert("CURRENT_USER");
        set.insert("USER");
        set.insert("SESSION_USER");
        set.insert("UUID");
        
        // Boolean test functions
        set.insert("ISNAN");
        set.insert("ISNOTNULL");
        set.insert("ISNULL");
        
        // Collection functions
        set.insert("EXPLODE");
        set.insert("EXPLODE_OUTER");
        set.insert("POSEXPLODE");
        set.insert("POSEXPLODE_OUTER");
        set.insert("INLINE");
        set.insert("INLINE_OUTER");
        set.insert("STACK");
        
        // URL functions
        set.insert("PARSE_URL");
        
        // Higher-order functions
        set.insert("TRANSFORM");
        set.insert("FILTER");
        set.insert("EXISTS");
        set.insert("FORALL");
        set.insert("AGGREGATE");
        set.insert("REDUCE");
        set.insert("ZIP_WITH");
        set.insert("TRANSFORM_KEYS");
        set.insert("TRANSFORM_VALUES");
        
        // Lambda helpers (not functions but related)
        // These are typically not called directly but are part of syntax
        
        set
    };
}

/// Check if a given string is a Spark SQL built-in function (case-insensitive)
pub fn is_builtin_function(name: &str) -> bool {
    BUILTIN_FUNCTIONS.contains(name.to_uppercase().as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aggregate_functions() {
        assert!(is_builtin_function("COUNT"));
        assert!(is_builtin_function("count"));
        assert!(is_builtin_function("SUM"));
        assert!(is_builtin_function("AVG"));
        assert!(is_builtin_function("MIN"));
        assert!(is_builtin_function("MAX"));
    }

    #[test]
    fn test_string_functions() {
        assert!(is_builtin_function("CONCAT"));
        assert!(is_builtin_function("UPPER"));
        assert!(is_builtin_function("LOWER"));
        assert!(is_builtin_function("TRIM"));
        assert!(is_builtin_function("SUBSTRING"));
    }

    #[test]
    fn test_math_functions() {
        assert!(is_builtin_function("ABS"));
        assert!(is_builtin_function("ROUND"));
        assert!(is_builtin_function("FLOOR"));
        assert!(is_builtin_function("CEIL"));
        assert!(is_builtin_function("SQRT"));
    }

    #[test]
    fn test_date_functions() {
        assert!(is_builtin_function("CURRENT_DATE"));
        assert!(is_builtin_function("DATE_ADD"));
        assert!(is_builtin_function("YEAR"));
        assert!(is_builtin_function("MONTH"));
        assert!(is_builtin_function("DAY"));
    }

    #[test]
    fn test_not_builtin_functions() {
        assert!(!is_builtin_function("my_custom_func"));
        assert!(!is_builtin_function("user_defined_function"));
        assert!(!is_builtin_function("custom_udf"));
    }

    #[test]
    fn test_case_insensitive() {
        assert!(is_builtin_function("count"));
        assert!(is_builtin_function("COUNT"));
        assert!(is_builtin_function("Count"));
        assert!(is_builtin_function("CoUnT"));
    }
}
