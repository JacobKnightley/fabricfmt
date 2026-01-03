/**
 * Function Expansion Handler
 *
 * Extracted from formatter.ts to reduce file size and improve maintainability.
 * This module handles multi-argument function expansion (e.g., COALESCE, CONCAT).
 */

import {
  type ExpandedFunctionStack,
  indentCalc,
} from './formatting-context.js';
import type { OutputBuilder } from './output-builder.js';
import type { AnalyzerResult, MultiArgFunctionInfo } from './types.js';

/**
 * State interface for function expansion.
 */
export interface FunctionExpansionState {
  justOutputMultiArgFunctionNewline: boolean;
}

/**
 * Handle multi-arg function expansion.
 *
 * When a function has multiple arguments that exceed line width, this adds
 * newlines after the opening paren and before each comma.
 */
export function handleFunctionExpansion(
  builder: OutputBuilder,
  expandedFuncs: ExpandedFunctionStack,
  funcInfo: MultiArgFunctionInfo,
  tokenList: any[],
  currentIndex: number,
  findNextNonWsTokenIndex: (idx: number) => number,
  analysis: AnalyzerResult,
  state: FunctionExpansionState,
): void {
  const depth = expandedFuncs.depth;

  // Check for chained function pattern
  // When functions are nested like TRIM(UPPER(col)), we check if the first
  // argument is also an expanded function to maintain proper indentation
  let firstArgIsChainedFunc = false;
  const shouldConsiderChaining = depth % 2 === 1;

  if (shouldConsiderChaining) {
    const nextTokenIdx = findNextNonWsTokenIndex(currentIndex + 1);
    if (nextTokenIdx > 0 && nextTokenIdx < tokenList.length) {
      const nextToken = tokenList[nextTokenIdx];
      const isNextTokenFuncName = analysis.functionCallTokens.has(
        nextToken.tokenIndex,
      );
      if (isNextTokenFuncName) {
        const parenIdx = findNextNonWsTokenIndex(nextTokenIdx + 1);
        if (parenIdx > 0 && parenIdx < tokenList.length) {
          const parenToken = tokenList[parenIdx];
          const nestedFuncInfo = analysis.multiArgFunctionInfo.get(
            parenToken.tokenIndex,
          );
          if (nestedFuncInfo) {
            firstArgIsChainedFunc = true;
          }
        }
      }
    }
  }

  // For STACK function, calculate which commas should NOT get newlines (pair grouping)
  // STACK format: STACK(count, alias1, col1, alias2, col2, ...)
  // We want: count on its own, then pairs of (alias, col) on each line
  // So after the first comma (after count), every ODD comma (1st, 3rd, 5th...) gets newline,
  // every EVEN comma (2nd, 4th, 6th...) stays inline
  let skipNewlineCommas: Set<number> | undefined;
  if (funcInfo.functionName === 'STACK' && funcInfo.commaIndices.length >= 2) {
    skipNewlineCommas = new Set<number>();
    // Skip newline for commas at indices 1, 3, 5... (0-based, so 2nd, 4th, 6th commas)
    for (let i = 1; i < funcInfo.commaIndices.length; i += 2) {
      skipNewlineCommas.add(funcInfo.commaIndices[i]);
    }
  }

  expandedFuncs.push({
    closeParenIndex: funcInfo.closeParenIndex,
    commaIndices: new Set(funcInfo.commaIndices),
    depth,
    openingColumn: builder.getColumn() - 1,
    firstArgIsChainedFunc,
    functionName: funcInfo.functionName,
    skipNewlineCommas,
  });

  if (!firstArgIsChainedFunc) {
    const contentIndent = indentCalc.getExpandedFunctionContentIndent(depth);
    builder.push(`\n${' '.repeat(contentIndent)}`);
    state.justOutputMultiArgFunctionNewline = true;
  }
}
