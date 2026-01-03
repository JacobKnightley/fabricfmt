/**
 * Spark SQL Formatter - Main Entry Point
 *
 * This is the 100% grammar-driven SQL formatter for Apache Spark SQL.
 * NO HARDCODED KEYWORD, FUNCTION, OR CLAUSE LISTS.
 * Everything derived from ANTLR lexer symbolicNames and parse tree context.
 *
 * Architecture:
 * - types.ts: TypeScript interfaces
 * - token-utils.ts: Grammar-derived token detection
 * - parse-tree-analyzer.ts: AST visitor that collects formatting context
 * - formatting-context.ts: State management during formatting
 * - output-builder.ts: Output construction with column tracking
 * - formatter.ts (this file): Main orchestration
 */

import antlr4 from 'antlr4';
import { MAX_LINE_WIDTH } from './constants.js';
import {
  detectCollapseDirectives,
  type ForceInlineRange,
  type FormatDirectiveInfo,
  hasFormatOff,
  isFmtInlineComment,
} from './fmt-detector.js';
import {
  CommentManager,
  createInitialState,
  ExpandedFunctionStack,
  indentCalc,
  isUnaryOperator,
  shouldExpandFunction,
  shouldExpandPivot,
  shouldExpandWindow,
} from './formatting-context.js';
import { handleFunctionExpansion } from './function-expansion.js';
import { SPARK_BUILTIN_FUNCTIONS } from './generated/builtinFunctions.js';
import SqlBaseParser from './generated/SqlBaseParser.js';
import { calculateNewlineAndIndent } from './newline-calculator.js';
import {
  formatHintContent,
  OutputBuilder,
  outputComments,
} from './output-builder.js';
import {
  outputWithNewline,
  outputWithoutNewline,
  updateClauseFlags,
} from './output-helpers.js';
import { ParseTreeAnalyzer } from './parse-tree-analyzer.js';
// Internal modules
import {
  getSymbolicName,
  isFunctionLikeKeyword,
  isKeywordToken,
  SqlBaseLexer,
} from './token-utils.js';
import type { AnalyzerResult, ExpandedPivot, ExpandedWindow } from './types.js';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Format SQL - Main entry point.
 * Handles magic commands, semicolon-separated statements, and formatting.
 */
export function formatSql(sql: string): string {
  try {
    // Handle magic commands (%%sql only - %sql is not valid in Fabric)
    // Find magic command anywhere in input - only format SQL after it
    // This allows content before the magic (e.g., Python code) to remain untouched
    let prefix = '';
    let magicCommand = '';
    let sqlToFormat = sql;

    const magicMatch = sql.match(/(%%sql)[ \t]*\n?/);
    if (magicMatch && magicMatch.index !== undefined) {
      prefix = sql.substring(0, magicMatch.index);
      magicCommand = magicMatch[1];
      sqlToFormat = sql.substring(magicMatch.index + magicMatch[0].length);
    }

    // Split on semicolons and format each statement
    const statements = splitOnSemicolons(sqlToFormat);
    const formattedStatements: string[] = [];

    for (const stmt of statements) {
      if (stmt.trim().length === 0) continue;

      // Check for statement-level fmt:off (bypass formatting entirely)
      if (hasFormatOff(stmt.trim())) {
        formattedStatements.push(stmt.trim());
        continue;
      }

      const formatted = formatSingleStatement(stmt.trim());
      formattedStatements.push(formatted);
    }

    let result = formattedStatements.join(';\n\n');

    // Preserve trailing semicolon if original had one
    if (sqlToFormat.trimEnd().endsWith(';')) {
      result += ';';
    }

    // Restore magic command and prefix
    if (magicCommand) {
      result = `${prefix + magicCommand}\n${result}`;
    }

    return result;
  } catch {
    return sql;
  }
}

/**
 * Check if SQL needs formatting.
 */
export function needsFormatting(sql: string): boolean {
  return formatSql(sql) !== sql;
}

// ============================================================================
// STATEMENT SPLITTING
// ============================================================================

/**
 * Split SQL on semicolons, but not semicolons inside string literals.
 */
function splitOnSemicolons(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
    } else if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
    } else if (ch === ';' && !inSingleQuote && !inDoubleQuote) {
      if (current.trim().length > 0) {
        statements.push(current);
      }
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim().length > 0) {
    statements.push(current);
  }

  return statements;
}

// ============================================================================
// VARIABLE SUBSTITUTION HANDLING
// ============================================================================

/**
 * Spark SQL variable substitution pattern: ${variable_name}
 * These must be preserved exactly during formatting.
 */
const VARIABLE_PATTERN = /\$\{([^}]+)\}/g;

interface VariableSubstitution {
  placeholder: string;
  original: string;
}

/**
 * Replace ${variable} patterns with safe placeholders before formatting.
 * Returns the modified SQL and a map to restore later.
 */
function extractVariables(sql: string): {
  sql: string;
  substitutions: VariableSubstitution[];
} {
  const substitutions: VariableSubstitution[] = [];
  let index = 0;

  const modifiedSql = sql.replace(VARIABLE_PATTERN, (match) => {
    // Use a placeholder that won't be modified by formatting
    // _SPARKVAR_N_ looks like an identifier and won't get spaces added
    const placeholder = `_SPARKVAR_${index}_`;
    substitutions.push({ placeholder, original: match });
    index++;
    return placeholder;
  });

  return { sql: modifiedSql, substitutions };
}

/**
 * Restore original ${variable} patterns after formatting.
 */
function restoreVariables(
  sql: string,
  substitutions: VariableSubstitution[],
): string {
  let result = sql;
  for (const sub of substitutions) {
    result = result.replace(sub.placeholder, sub.original);
  }
  return result;
}

// ============================================================================
// SINGLE STATEMENT FORMATTING
// ============================================================================

/**
 * Pre-normalize SQL to fix tokenization mismatches.
 * Some SQL constructs tokenize differently based on case:
 * - Scientific notation: 1.23e10 (lowercase 'e') vs 1.23E10 (uppercase 'E')
 *
 * We normalize these to uppercase before lexing so both streams align.
 */
function normalizeForTokenization(sql: string): string {
  // Normalize scientific notation: replace lowercase 'e' in numbers with uppercase 'E'
  // Pattern matches: integer part (optional decimal), 'e', optional +/-, exponent
  // Examples: 1e10, 1.23e10, .5e-3, 1.e+5
  return sql.replace(
    /(\d+(?:\.\d*)?|\.\d+)e([+-]?\d+)/gi,
    (_match, mantissa, exponent) => {
      return `${mantissa}E${exponent}`;
    },
  );
}

/**
 * Format a single SQL statement.
 */
function formatSingleStatement(sql: string): string {
  try {
    // Extract ${variable} substitutions before formatting
    const { sql: sqlWithPlaceholders, substitutions } = extractVariables(sql);

    // Pre-normalize SQL to fix tokenization mismatches
    const normalizedSql = normalizeForTokenization(sqlWithPlaceholders);

    // Parse with uppercased SQL (grammar matches uppercase keywords)
    const upperSql = normalizedSql.toUpperCase();
    const chars = new antlr4.InputStream(upperSql);
    const lexer = new SqlBaseLexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    tokens.fill();

    const parser = new SqlBaseParser(tokens);
    // @ts-expect-error
    parser.removeErrorListeners?.();

    let tree: any;
    try {
      tree = parser.singleStatement();
    } catch {
      return sql;
    }

    // Analyze parse tree
    const analyzer = new ParseTreeAnalyzer();
    analyzer.visit(tree);
    const analysis = analyzer.getResult();

    // Re-lex normalized SQL to get token texts (now aligned with uppercase stream)
    const origChars = new antlr4.InputStream(normalizedSql);
    const origLexer = new SqlBaseLexer(origChars);
    const origTokens = new antlr4.CommonTokenStream(origLexer);
    origTokens.fill();

    // Detect fmt:collapse directives
    const formatDirectives = detectCollapseDirectives(normalizedSql);

    // Format tokens
    const formatted = formatTokens(
      tokens.tokens,
      origTokens.tokens,
      analysis,
      formatDirectives,
    );

    // Restore ${variable} substitutions
    return restoreVariables(formatted, substitutions);
  } catch (e: any) {
    console.error('Formatter error:', e.message, e.stack);
    return sql;
  }
}

/**
 * Format tokens using the analysis result.
 */
function formatTokens(
  tokenList: any[],
  allOrigTokens: any[],
  analysis: AnalyzerResult,
  formatDirectives: FormatDirectiveInfo,
): string {
  const builder = new OutputBuilder();
  const state = createInitialState();
  const expandedFuncs = new ExpandedFunctionStack();
  const comments = new CommentManager();

  let currentExpandedWindow: ExpandedWindow | null = null;
  let currentExpandedPivot: ExpandedPivot | null = null;
  let lastProcessedIndex = -1;

  // Populate force-inline ranges from fmt:inline comments (grammar-driven approach)
  const forceInlineRanges = findForceInlineRanges(allOrigTokens, analysis);
  formatDirectives.forceInlineRanges = forceInlineRanges;

  // IN list wrapping state
  // Maps open paren index -> { wrapIndent, closeParenIndex, commaIndices }
  interface ActiveInList {
    wrapIndent: number; // Column to wrap to (after open paren)
    closeParenIndex: number;
    commaIndices: Set<number>;
  }
  let activeInList: ActiveInList | null = null;

  // Track which simple queries are actually compact (fit within line width)
  const compactQueries = new Set<number>();
  for (const [selectToken, info] of analysis.simpleQueries) {
    // For subqueries (depth > 0), apply tighter width constraint to account for
    // surrounding context (CTE prefix, parentheses, outer query continuation).
    // Typical overhead is 20-40 chars for "WITH name AS (" + ") SELECT ..."
    const effectiveMaxWidth =
      info.depth > 0 ? MAX_LINE_WIDTH - 40 : MAX_LINE_WIDTH;
    if (info.spanLength <= effectiveMaxWidth) {
      compactQueries.add(selectToken);
    }
  }

  // Check if set operations should stay inline
  // Only inline if: 1) there are set operation parens, 2) total length is short,
  // 3) ALL queries in the set operation are simple (single-item SELECT)
  let isShortSetOperation = false;
  if (analysis.setOperandParens.size > 0) {
    let estimatedQueryLength = 0;
    for (const tok of tokenList) {
      if (tok.type !== SqlBaseLexer.WS && tok.type !== antlr4.Token.EOF) {
        estimatedQueryLength += (tok.text?.length || 0) + 1; // +1 for space
      }
    }
    // Only allow inline if short AND no multi-item clauses exist
    const hasMultiItemClause = analysis.multiItemClauses.size > 0;
    isShortSetOperation =
      estimatedQueryLength <= MAX_LINE_WIDTH && !hasMultiItemClause;
  }

  // Check if VALUES statement should stay inline (simple values list)
  // Only inline if: 1) has values commas, 2) total length is short, 3) NOT tuples (row format)
  // VALUES 1, 2, 3 -> stays inline if short
  // VALUES (1, 'a'), (2, 'b') -> always expands (has tuples)
  let isShortValues = false;
  if (analysis.valuesCommas.size > 0 && !analysis.valuesHasTuples) {
    let estimatedQueryLength = 0;
    for (const tok of tokenList) {
      if (tok.type !== SqlBaseLexer.WS && tok.type !== antlr4.Token.EOF) {
        estimatedQueryLength += (tok.text?.length || 0) + 1; // +1 for space
      }
    }
    isShortValues = estimatedQueryLength <= MAX_LINE_WIDTH;
  }

  // Helper to find next non-WS token
  const findNextNonWsTokenIndex = (startIdx: number): number => {
    for (let j = startIdx; j < tokenList.length; j++) {
      const tok = tokenList[j];
      if (
        tok.type !== SqlBaseLexer.WS &&
        tok.type !== antlr4.Token.EOF &&
        tok.type !== SqlBaseLexer.SIMPLE_COMMENT &&
        tok.type !== SqlBaseLexer.BRACKETED_COMMENT
      ) {
        return j;
      }
    }
    return -1;
  };

  // Helper to collect comments from range
  const collectComments = (startIdx: number, endIdx: number): void => {
    for (let j = startIdx; j < endIdx; j++) {
      const hiddenToken = allOrigTokens[j];
      if (hiddenToken && hiddenToken.channel === 1) {
        if (
          hiddenToken.type === SqlBaseLexer.SIMPLE_COMMENT ||
          hiddenToken.type === SqlBaseLexer.BRACKETED_COMMENT
        ) {
          const wasOnOwnLine = CommentManager.checkWasOnOwnLine(
            j,
            hiddenToken,
            allOrigTokens,
          );
          const hadBlankLineBefore = CommentManager.checkHadBlankLineBefore(
            j,
            allOrigTokens,
          );
          comments.add({
            text: hiddenToken.text,
            type: hiddenToken.type,
            wasOnOwnLine,
            hadBlankLineBefore,
          });
        }
      }
    }
  };

  for (let i = 0; i < tokenList.length && i < allOrigTokens.length; i++) {
    const token = tokenList[i];
    const origToken = allOrigTokens[i];

    if (token.type === antlr4.Token.EOF) continue;

    // Collect hidden tokens (comments)
    const wasAlreadyProcessed = lastProcessedIndex >= i;
    if (!wasAlreadyProcessed) {
      collectComments(lastProcessedIndex + 1, i);
    }
    lastProcessedIndex = Math.max(lastProcessedIndex, i);

    // Skip WS tokens
    if (token.type === SqlBaseLexer.WS) continue;

    // Handle comment tokens directly
    if (
      token.type === SqlBaseLexer.SIMPLE_COMMENT ||
      token.type === SqlBaseLexer.BRACKETED_COMMENT
    ) {
      if (!wasAlreadyProcessed) {
        const wasOnOwnLine = CommentManager.checkWasOnOwnLine(
          i,
          origToken,
          allOrigTokens,
        );
        const hadBlankLineBefore = CommentManager.checkHadBlankLineBefore(
          i,
          allOrigTokens,
        );
        comments.add({
          text: origToken.text,
          type: token.type,
          wasOnOwnLine,
          hadBlankLineBefore,
        });
      }
      continue;
    }

    const text = origToken.text;
    const tokenType = token.type;
    const tokenIndex = token.tokenIndex;
    const symbolicName = getSymbolicName(tokenType);

    // Handle hints
    if (tokenType === SqlBaseLexer.HENT_START) {
      builder.addSpaceIfNeeded();
      state.insideHint = true;
      state.hintContent = [];
      builder.push('/*+');
      continue;
    }

    if (state.insideHint) {
      if (tokenType === SqlBaseLexer.HENT_END) {
        const formatted = formatHintContent(state.hintContent.join(''));
        builder.push(` ${formatted} `);
        builder.push('*/');
        state.insideHint = false;
        state.hintContent = [];
        state.prevWasFunctionName = false;
        continue;
      } else {
        if (state.hintContent.length > 0) {
          const lastElement = state.hintContent[state.hintContent.length - 1];
          const needsSpace =
            lastElement !== '(' &&
            lastElement !== ' ' &&
            text !== ')' &&
            text !== ',';
          if (needsSpace) state.hintContent.push(' ');
        }
        state.hintContent.push(text);
        continue;
      }
    }

    // Skip AS tokens in table alias context (style: table aliases have no AS)
    if (analysis.tableAliasAsTokens.has(tokenIndex)) {
      continue;
    }

    // Get context from analysis
    const ctx = getTokenContext(tokenIndex, analysis);

    // Compact query tracking: each subquery level is evaluated independently
    // When we hit a SELECT, check if THAT query is compact and push to stack
    const _simpleQueryInfo = analysis.simpleQueries.get(tokenIndex);
    if (symbolicName === 'SELECT' && ctx.isClauseStart) {
      const isThisQueryCompact = compactQueries.has(tokenIndex);
      // Push compact state for this query level
      state.compactQueryStack.push({
        isCompact: isThisQueryCompact,
        depth: state.subqueryDepth,
      });
    }

    // Pop compact query state when we exit a subquery (depth decreases)
    while (
      state.compactQueryStack.length > 0 &&
      state.compactQueryStack[state.compactQueryStack.length - 1].depth >
        state.subqueryDepth
    ) {
      state.compactQueryStack.pop();
    }

    // Also pop on semicolon (statement end at depth 0)
    if (
      text === ';' &&
      state.subqueryDepth === 0 &&
      state.compactQueryStack.length > 0
    ) {
      state.compactQueryStack.pop();
    }

    // Current query is compact if the top of the stack says so
    const inCompactQuery =
      state.compactQueryStack.length > 0 &&
      state.compactQueryStack[state.compactQueryStack.length - 1].isCompact;

    // Get multi-arg function info
    const multiArgFuncInfo = analysis.multiArgFunctionInfo.get(tokenIndex);
    const windowDefInfo = analysis.windowDefInfo.get(tokenIndex);
    const pivotInfoLookup = analysis.pivotInfo.get(tokenIndex);

    // Check expanded function state
    const _currentFunc = expandedFuncs.current();
    const isExpandedFunctionComma = expandedFuncs.isComma(tokenIndex);
    const isExpandedFunctionCloseParen = expandedFuncs.isCloseParen(tokenIndex);

    // Check expanded window state
    const isExpandedWindowOrderBy =
      currentExpandedWindow?.orderByTokenIndex === tokenIndex;
    const isExpandedWindowFrame =
      currentExpandedWindow?.windowFrameTokenIndex === tokenIndex;
    const isExpandedWindowCloseParen =
      currentExpandedWindow?.closeParenIndex === tokenIndex;

    // Check expanded pivot state
    const isExpandedPivotAggregateComma =
      currentExpandedPivot?.aggregateCommaIndices.has(tokenIndex) ?? false;
    const isExpandedPivotForKeyword =
      currentExpandedPivot?.forKeywordIndex === tokenIndex;
    const isExpandedPivotInKeyword =
      currentExpandedPivot?.inKeywordIndex === tokenIndex;
    // Don't use comma-first expansion for PIVOT IN lists - let IN list wrapping handle it
    const isExpandedPivotInListComma = false; // Disabled - use IN list wrapping instead
    const isExpandedPivotCloseParen =
      currentExpandedPivot?.closeParenIndex === tokenIndex;

    // Detect unary operator
    const currentTokenIsUnaryOperator = isUnaryOperator(
      text,
      state.prevTokenText,
      state.prevTokenType,
    );

    // Get next token type for lookahead (skip WS tokens)
    let nextTokenType: number | null = null;
    for (let j = i + 1; j < tokenList.length; j++) {
      const nextToken = tokenList[j];
      if (
        nextToken.type !== SqlBaseLexer.WS &&
        nextToken.type !== SqlBaseLexer.SIMPLE_COMMENT &&
        nextToken.type !== SqlBaseLexer.BRACKETED_COMMENT
      ) {
        nextTokenType = nextToken.type;
        break;
      }
    }

    // Determine output text
    const outputText = determineOutputText(
      tokenIndex,
      tokenType,
      text,
      symbolicName,
      ctx,
      analysis,
      nextTokenType,
    );

    // Check for function-like keyword
    const isBuiltInFunctionKeyword = isFunctionLikeKeyword(tokenType, text);

    // Track function argument depth
    if (
      text === '(' &&
      (state.prevWasFunctionName || state.prevWasBuiltInFunctionKeyword)
    ) {
      state.insideFunctionArgs++;
    } else if (text === ')' && state.insideFunctionArgs > 0) {
      state.insideFunctionArgs--;
    }

    // Track paren depth
    if (text === '(') state.insideParens++;
    else if (text === ')' && state.insideParens > 0) state.insideParens--;

    // Track complex type depth for ARRAY<>, MAP<>, STRUCT<>
    // These use < and > instead of () for type parameters
    // Note: We increment depth BEFORE processing (for opening <) but decrement AFTER (for closing >)
    const prevSymName =
      state.prevTokenType >= 0 ? getSymbolicName(state.prevTokenType) : null;
    const prevWasComplexTypeKeyword =
      prevSymName === 'ARRAY' ||
      prevSymName === 'MAP' ||
      prevSymName === 'STRUCT';
    const _wasInsideComplexType = state.complexTypeDepth > 0;
    if (
      text === '<' &&
      (prevWasComplexTypeKeyword || state.complexTypeDepth > 0)
    ) {
      state.complexTypeDepth++;
    }
    // Store if we should decrement after output (for closing >)
    const shouldDecrementComplexTypeAfter =
      text === '>' && state.complexTypeDepth > 0;

    // Track IN list wrapping - check if we're entering an IN list
    const inListInfo = analysis.inListInfo.get(tokenIndex);

    // Check if we're exiting an IN list
    if (activeInList && tokenIndex === activeInList.closeParenIndex) {
      // Exiting the IN list
      activeInList = null;
    }

    // Handle AS keyword insertion
    if (analysis.aliasInsertPositions.has(tokenIndex)) {
      builder.addSpaceIfNeeded();
      builder.push('AS');
    }

    // Determine newlines and indent
    const { needsNewline, indent } = calculateNewlineAndIndent(
      tokenIndex,
      symbolicName,
      ctx,
      analysis,
      state,
      expandedFuncs,
      currentExpandedWindow,
      currentExpandedPivot,
      isExpandedFunctionComma,
      isExpandedFunctionCloseParen,
      isExpandedWindowOrderBy,
      isExpandedWindowFrame,
      isExpandedWindowCloseParen,
      isExpandedPivotAggregateComma,
      isExpandedPivotForKeyword,
      isExpandedPivotInKeyword,
      isExpandedPivotInListComma,
      isExpandedPivotCloseParen,
      inCompactQuery,
      isShortSetOperation,
      isShortValues,
    );

    // Handle list commas - look ahead for comments
    if (ctx.isListComma && state.insideFunctionArgs === 0) {
      const nextIdx = findNextNonWsTokenIndex(i + 1);
      if (nextIdx > 0) {
        collectComments(i + 1, nextIdx);
        lastProcessedIndex = nextIdx - 1;
      }
    }

    // Similar look-ahead for other comma types
    if (
      ctx.isCteComma ||
      ctx.isDdlComma ||
      ctx.isValuesComma ||
      ctx.isSetComma ||
      isExpandedFunctionComma
    ) {
      const nextIdx = findNextNonWsTokenIndex(i + 1);
      if (nextIdx > 0) {
        collectComments(i + 1, nextIdx);
        lastProcessedIndex = nextIdx - 1;
      }
    }

    // Apply spacing/newlines
    if (needsNewline) {
      outputWithNewline(builder, comments, indent, state);
    } else {
      outputWithoutNewline(
        builder,
        comments,
        text,
        symbolicName,
        state,
        currentTokenIsUnaryOperator,
        ctx.isLateralViewComma,
      );
    }

    builder.push(outputText);

    // Handle IN list wrapping: after outputting a comma in an IN list,
    // check if the next item would exceed line width
    if (activeInList?.commaIndices.has(tokenIndex) && text === ',') {
      // Look ahead to estimate the length of the next item
      const nextItemLength = estimateNextInListItemLength(
        tokenList,
        i,
        findNextNonWsTokenIndex,
        activeInList.closeParenIndex,
      );
      const currentCol = builder.getColumn();

      // Add 1 for the space after comma
      if (currentCol + 1 + nextItemLength > MAX_LINE_WIDTH) {
        // Wrap to new line with indent
        builder.push(`\n${' '.repeat(activeInList.wrapIndent)}`);
        state.justOutputInListWrapNewline = true;
      }
    }

    // Activate IN list tracking AFTER we push the opening paren
    if (inListInfo && text === '(') {
      let wrapIndent = builder.getColumn(); // Column right after the (

      // If wrap indent exceeds 60% of line width, fall back to current indent + 4
      const maxWrapIndent = Math.floor(MAX_LINE_WIDTH * 0.6); // 84 chars
      if (wrapIndent > maxWrapIndent) {
        // Find current line's base indent (position of first non-space on this line)
        // Since we just pushed '(', go back to find the line start indent
        const currentOutput = builder.toString();
        const lastNewline = currentOutput.lastIndexOf('\n');
        const lineStart =
          lastNewline >= 0
            ? currentOutput.slice(lastNewline + 1)
            : currentOutput;
        const baseIndentMatch = lineStart.match(/^(\s*)/);
        const baseIndent = baseIndentMatch ? baseIndentMatch[1].length : 0;
        wrapIndent = baseIndent + 4; // Fall back to base indent + 1 indent level
      }

      activeInList = {
        wrapIndent,
        closeParenIndex: inListInfo.closeParenIndex,
        commaIndices: new Set(inListInfo.commaIndices),
      };
    }

    // Handle multi-WHEN CASE newline after CASE or after value expression
    // For searchedCase (CASE WHEN ...), newline goes after CASE
    // For simpleCase (CASE x WHEN ...), newline goes after value expression
    if (analysis.multiWhenCaseTokens.has(tokenIndex)) {
      // Check if this CASE has a value expression (simpleCase)
      // If so, we'll add the newline after the value, not here
      const isSimpleCase = analysis.simpleCaseTokens?.has(tokenIndex);
      if (!isSimpleCase) {
        // searchedCase - newline right after CASE
        builder.push('\n');
      }
      state.caseDepth++;
    }

    // For simpleCase, add newline after the value expression
    if (analysis.simpleCaseValueEndTokens?.has(tokenIndex)) {
      builder.push('\n');
    }

    // Track subquery depth changes
    if (ctx.isSubqueryOpenParen) state.subqueryDepth++;
    else if (ctx.isSubqueryCloseParen && state.subqueryDepth > 0)
      state.subqueryDepth--;

    // Track DDL depth
    if (ctx.isDdlOpenParen && ctx.isDdlMultiColumn) {
      builder.push(`\n${'    '.repeat(state.subqueryDepth + 1)}`);
      state.ddlDepth++;
    } else if (ctx.isDdlCloseParen && state.ddlDepth > 0) {
      state.ddlDepth--;
    }

    // Handle multi-arg function expansion
    // Check if this token is force-inline (either line-based legacy or grammar-driven)
    const tokenLine = allOrigTokens[i]?.line || 0;
    const lineBasedForceCollapse =
      formatDirectives.collapsedLines.has(tokenLine);
    const grammarBasedForceCollapse = isForceInlineOpen(
      tokenIndex,
      forceInlineRanges,
    );
    const forceCollapse = lineBasedForceCollapse || grammarBasedForceCollapse;

    if (
      multiArgFuncInfo &&
      !forceCollapse &&
      shouldExpandFunction(builder.getColumn(), multiArgFuncInfo)
    ) {
      handleFunctionExpansion(
        builder,
        expandedFuncs,
        multiArgFuncInfo,
        tokenList,
        i,
        findNextNonWsTokenIndex,
        analysis,
        state,
      );
    }

    // Handle window expansion (pass multiArgFunctionInfo to check nested function expansion)
    if (
      windowDefInfo &&
      !forceCollapse &&
      shouldExpandWindow(
        builder.getColumn(),
        windowDefInfo,
        analysis.multiArgFunctionInfo,
      )
    ) {
      currentExpandedWindow = {
        closeParenIndex: windowDefInfo.closeParenIndex,
        orderByTokenIndex: windowDefInfo.orderByTokenIndex,
        windowFrameTokenIndex: windowDefInfo.windowFrameTokenIndex,
        baseDepth: state.subqueryDepth,
      };
      const newIndent =
        '\n' +
        ' '.repeat(indentCalc.getWindowContentIndent(state.subqueryDepth));
      builder.push(newIndent);
      state.justOutputWindowNewline = true;
    }

    // Handle PIVOT/UNPIVOT expansion
    if (
      pivotInfoLookup &&
      !forceCollapse &&
      shouldExpandPivot(builder.getColumn(), pivotInfoLookup)
    ) {
      currentExpandedPivot = {
        closeParenIndex: pivotInfoLookup.closeParenIndex,
        aggregateCommaIndices: new Set(pivotInfoLookup.aggregateCommaIndices),
        forKeywordIndex: pivotInfoLookup.forKeywordIndex,
        inKeywordIndex: pivotInfoLookup.inKeywordIndex,
        inListCommaIndices: new Set(pivotInfoLookup.inListCommaIndices),
        depth: state.subqueryDepth,
        openingColumn: builder.getColumn() - 1,
      };
      // Output newline after opening paren
      const pivotIndent =
        '\n' +
        ' '.repeat(indentCalc.getPivotContentIndent(state.subqueryDepth));
      builder.push(pivotIndent);
      state.justOutputPivotNewline = true;
    }

    // Pop expanded function on close paren
    if (isExpandedFunctionCloseParen && !expandedFuncs.isEmpty()) {
      expandedFuncs.pop();
    }

    // Clear expanded window on close paren
    if (isExpandedWindowCloseParen && currentExpandedWindow) {
      currentExpandedWindow = null;
    }

    // Clear expanded pivot on close paren
    if (isExpandedPivotCloseParen && currentExpandedPivot) {
      currentExpandedPivot = null;
    }

    // Reset flags
    if (
      state.justOutputMultiArgFunctionNewline &&
      text !== ',' &&
      text !== '('
    ) {
      state.justOutputMultiArgFunctionNewline = false;
    }
    if (state.justOutputWindowNewline && text !== '(' && text !== ',') {
      state.justOutputWindowNewline = false;
    }
    if (state.justOutputPivotNewline && text !== '(' && text !== ',') {
      state.justOutputPivotNewline = false;
    }
    if (state.justOutputInListWrapNewline && text !== ',') {
      state.justOutputInListWrapNewline = false;
    }
    if (state.justOutputCommaFirstStyle && text !== ',') {
      state.justOutputCommaFirstStyle = false;
    }

    // Decrease CASE depth after END
    if (analysis.caseEndTokens.has(tokenIndex) && state.caseDepth > 0) {
      state.caseDepth--;
    }

    // Decrement complex type depth after outputting closing >
    if (shouldDecrementComplexTypeAfter) {
      state.complexTypeDepth--;
    }

    // Reset clause flags
    updateClauseFlags(symbolicName, ctx, state);

    // Check if this token is a partition transform function (followed by paren)
    const partitionTransformFunctions = new Set([
      'BUCKET',
      'TRUNCATE',
      'YEAR',
      'YEARS',
      'MONTH',
      'MONTHS',
      'DAY',
      'DAYS',
      'HOUR',
      'HOURS',
    ]);
    const isPartitionTransformFunc =
      partitionTransformFunctions.has(text.toUpperCase()) &&
      nextTokenType !== null &&
      getSymbolicName(nextTokenType) === 'LEFT_PAREN';

    // Update previous token tracking
    state.prevWasFunctionName = ctx.isFunctionCall || isPartitionTransformFunc;
    state.prevWasBuiltInFunctionKeyword = isBuiltInFunctionKeyword;
    state.isFirstNonWsToken = false;
    state.prevTokenWasUnaryOperator = currentTokenIsUnaryOperator;
    state.prevTokenText = text;
    state.prevTokenType = tokenType;
  }

  // Output remaining comments
  if (comments.hasPending()) {
    outputComments(builder, comments.getPending());
  }

  return builder.toString();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Scan tokens for fmt:inline comments and find their enclosing expressions.
 * Returns an array of ForceInlineRange for expressions that should not be expanded.
 *
 * The approach:
 * 1. Find all comment tokens that contain fmt:inline
 * 2. For each such comment, find the immediately preceding token (or same position)
 * 3. Check if that token is within any multi-arg function, window def, or pivot
 * 4. If so, add that construct's token range to the force-inline ranges
 */
function findForceInlineRanges(
  allOrigTokens: any[],
  analysis: AnalyzerResult,
): ForceInlineRange[] {
  const ranges: ForceInlineRange[] = [];
  const addedRanges = new Set<string>(); // Avoid duplicates: "open-close"

  // Helper to add a range if not already added
  const addRange = (openIdx: number, closeIdx: number) => {
    const key = `${openIdx}-${closeIdx}`;
    if (!addedRanges.has(key)) {
      addedRanges.add(key);
      ranges.push({ openTokenIndex: openIdx, closeTokenIndex: closeIdx });
    }
  };

  // Scan all tokens for fmt:inline comments
  for (let i = 0; i < allOrigTokens.length; i++) {
    const token = allOrigTokens[i];
    if (!token) continue;

    // Check if this is a comment with fmt:inline
    if (
      token.type === SqlBaseLexer.SIMPLE_COMMENT ||
      token.type === SqlBaseLexer.BRACKETED_COMMENT
    ) {
      if (isFmtInlineComment(token.text || '')) {
        // Found a fmt:inline comment at token index i
        // Find the closest preceding non-WS, non-comment token
        let precedingTokenIdx = i - 1;
        while (precedingTokenIdx >= 0) {
          const prevToken = allOrigTokens[precedingTokenIdx];
          if (
            prevToken &&
            prevToken.type !== SqlBaseLexer.WS &&
            prevToken.type !== SqlBaseLexer.SIMPLE_COMMENT &&
            prevToken.type !== SqlBaseLexer.BRACKETED_COMMENT
          ) {
            break;
          }
          precedingTokenIdx--;
        }

        // Now find which expression (if any) contains this position
        // Check multi-arg functions
        for (const [openIdx, info] of analysis.multiArgFunctionInfo) {
          if (
            precedingTokenIdx >= openIdx &&
            precedingTokenIdx <= info.closeParenIndex
          ) {
            addRange(openIdx, info.closeParenIndex);
          }
          // Also check if comment is right after close paren (common placement)
          if (precedingTokenIdx === info.closeParenIndex) {
            addRange(openIdx, info.closeParenIndex);
          }
        }

        // Check window definitions
        for (const [openIdx, info] of analysis.windowDefInfo) {
          if (
            precedingTokenIdx >= openIdx &&
            precedingTokenIdx <= info.closeParenIndex
          ) {
            addRange(openIdx, info.closeParenIndex);
          }
          if (precedingTokenIdx === info.closeParenIndex) {
            addRange(openIdx, info.closeParenIndex);
          }
        }

        // Check PIVOT/UNPIVOT
        for (const [openIdx, info] of analysis.pivotInfo) {
          if (
            precedingTokenIdx >= openIdx &&
            precedingTokenIdx <= info.closeParenIndex
          ) {
            addRange(openIdx, info.closeParenIndex);
          }
          if (precedingTokenIdx === info.closeParenIndex) {
            addRange(openIdx, info.closeParenIndex);
          }
        }
      }
    }
  }

  return ranges;
}

/**
 * Check if a token index is the opening of a force-inline expression.
 */
function isForceInlineOpen(
  tokenIndex: number,
  ranges: ForceInlineRange[],
): boolean {
  return ranges.some((r) => r.openTokenIndex === tokenIndex);
}

/**
 * Estimate the length of the next item in an IN list.
 * Looks ahead from the current comma to find the next comma or close paren.
 */
function estimateNextInListItemLength(
  tokenList: any[],
  currentIndex: number,
  findNextNonWsTokenIndex: (idx: number) => number,
  closeParenIndex: number,
): number {
  let length = 0;
  let idx = findNextNonWsTokenIndex(currentIndex + 1);
  let depth = 0;

  while (idx >= 0 && idx < tokenList.length) {
    const token = tokenList[idx];
    const tokenIndex = token.tokenIndex;
    const text = token.text || '';
    const symName = SqlBaseLexer.symbolicNames[token.type];

    // Stop at the close paren of the IN list
    if (tokenIndex === closeParenIndex) {
      break;
    }

    // Track nested parens
    if (symName === 'LEFT_PAREN') {
      depth++;
      length += text.length;
    } else if (symName === 'RIGHT_PAREN') {
      if (depth > 0) {
        depth--;
        length += text.length;
      } else {
        break; // Reached closing paren
      }
    } else if (symName === 'COMMA' && depth === 0) {
      // Found the next comma at top level - this is the end of the item
      break;
    } else {
      length += text.length;
      // Add space between tokens (rough estimate)
      length += 1;
    }

    idx = findNextNonWsTokenIndex(idx + 1);
  }

  return length;
}

/**
 * Extract token context from analysis result.
 */
function getTokenContext(tokenIndex: number, analysis: AnalyzerResult) {
  return {
    isInIdentifierContext: analysis.identifierTokens.has(tokenIndex),
    isInQualifiedName: analysis.qualifiedNameTokens.has(tokenIndex),
    isFunctionCall: analysis.functionCallTokens.has(tokenIndex),
    isClauseStart: analysis.clauseStartTokens.has(tokenIndex),
    isListComma: analysis.listItemCommas.has(tokenIndex),
    isConditionOperator: analysis.conditionOperators.has(tokenIndex),
    isBetweenAnd: analysis.betweenAndTokens.has(tokenIndex),
    isJoinOn: analysis.joinOnTokens.has(tokenIndex),
    isSubqueryOpenParen: analysis.subqueryOpenParens.has(tokenIndex),
    isSubqueryCloseParen: analysis.subqueryCloseParens.has(tokenIndex),
    isSetOperandParen: analysis.setOperandParens.has(tokenIndex),
    isCteComma: analysis.cteCommas.has(tokenIndex),
    isCteMainSelect: analysis.cteMainSelectTokens.has(tokenIndex),
    isDdlComma: analysis.ddlColumnCommas.has(tokenIndex),
    isDdlOpenParen: analysis.ddlOpenParens.has(tokenIndex),
    isDdlCloseParen: analysis.ddlCloseParens.has(tokenIndex),
    isDdlMultiColumn: analysis.ddlMultiColumn.has(tokenIndex),
    isValuesComma: analysis.valuesCommas.has(tokenIndex),
    isSetComma: analysis.setClauseCommas.has(tokenIndex),
    isSetKeyword: tokenIndex === analysis.setKeywordToken,
    isLateralViewComma: analysis.lateralViewCommas.has(tokenIndex),
    isMergeUsing: analysis.mergeUsingTokens.has(tokenIndex),
    isMergeOn: analysis.mergeOnTokens.has(tokenIndex),
    isMergeWhen: analysis.mergeWhenTokens.has(tokenIndex),
  };
}

/**
 * Determine the output text for a token (casing rules).
 */
function determineOutputText(
  tokenIndex: number,
  tokenType: number,
  text: string,
  symbolicName: string | null,
  ctx: ReturnType<typeof getTokenContext>,
  analysis: AnalyzerResult,
  nextTokenType: number | null, // Added: peek at next token
): string {
  // SET config tokens - preserve casing
  if (analysis.setConfigTokens.has(tokenIndex)) {
    return text;
  }

  // GROUP BY ALL - uppercase
  if (analysis.groupByAllTokens.has(tokenIndex)) {
    return text.toUpperCase();
  }

  // Function call context
  if (ctx.isFunctionCall) {
    const funcLower = text.toLowerCase();
    const isBuiltIn =
      SPARK_BUILTIN_FUNCTIONS.has(funcLower) || isKeywordToken(tokenType, text);
    return isBuiltIn ? text.toUpperCase() : text;
  }

  // Structural keywords that should always be uppercase, even in identifier contexts.
  // These are syntactic markers, not actual identifier names.
  // e.g., "LATERAL VIEW EXPLODE(arr) AS item" - AS is a keyword, not an identifier.
  const structuralKeywords = new Set([
    'AS',
    'ON',
    'AND',
    'OR',
    'IN',
    'FOR',
    'USING',
  ]);
  if (symbolicName && structuralKeywords.has(symbolicName)) {
    return text.toUpperCase();
  }

  // Extension keywords: Should always be uppercase, even in identifier context.
  // Keywords not in Spark grammar (Delta Lake extensions).
  const extensionKeywords = new Set([
    // Spark SQL extensions not in grammar
    'SYSTEM', // SHOW SYSTEM FUNCTIONS
    'NOSCAN', // ANALYZE TABLE ... NOSCAN
    // Delta Lake keywords (none are in the Apache Spark grammar)
    'VACUUM',
    'RETAIN',
    'RESTORE',
    'CLONE',
    'SHALLOW',
    'DEEP',
    'OPTIMIZE',
    'ZORDER',
  ]);
  const textUpper = text.toUpperCase();
  if (extensionKeywords.has(textUpper)) {
    return textUpper;
  }

  // Partition transform functions: uppercase only when followed by '('
  // These are grammar keywords but appear as transformName=identifier in grammar.
  // When used as column names (not followed by '('), they should preserve casing.
  // e.g., "PARTITIONED BY (bucket(3, col))" - BUCKET uppercase
  // e.g., "SELECT year FROM t" - year lowercase (it's a column name)
  const partitionTransformFunctions = new Set([
    'BUCKET',
    'TRUNCATE',
    'YEAR',
    'YEARS',
    'MONTH',
    'MONTHS',
    'DAY',
    'DAYS',
    'HOUR',
    'HOURS',
  ]);
  if (partitionTransformFunctions.has(textUpper)) {
    // Check if next token is '(' (function call context)
    const isFollowedByParen =
      nextTokenType !== null && getSymbolicName(nextTokenType) === 'LEFT_PAREN';
    if (isFollowedByParen) {
      return textUpper;
    }
    // Not followed by paren - treat as regular identifier, preserve casing
  }

  // Identifier context - preserve casing
  // When a token is marked as identifier by the parse tree, it means the grammar
  // is using it as an identifier (column name, table name, etc.), so preserve casing.
  if (ctx.isInIdentifierContext) {
    return text;
  }

  // Keyword - uppercase
  if (isKeywordToken(tokenType, text)) {
    return text.toUpperCase();
  }

  // Default - preserve
  return text;
}
