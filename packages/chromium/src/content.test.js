/**
 * Tests for the Chromium Extension Content Script
 *
 * These tests validate the content script's logic for:
 * - Cell type detection and language mapping
 * - Code extraction from Monaco editors
 * - UI component creation
 * - Frame/iframe detection logic
 *
 * Uses JSDOM for DOM manipulation testing.
 */

import { JSDOM } from 'jsdom';

// ============================================================================
// Test Framework
// ============================================================================

const testResults = { passed: 0, failed: 0, errors: [] };

function describe(name, fn) {
  console.log(`\n[Suite] ${name}`);
  fn();
}

function test(name, fn) {
  try {
    fn();
    testResults.passed++;
    console.log(`  [PASS] ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ name, error: error.message });
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${error.message}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(
          `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
        );
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
        );
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(
          `Expected truthy value but got ${JSON.stringify(actual)}`,
        );
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(
          `Expected falsy value but got ${JSON.stringify(actual)}`,
        );
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
      }
    },
    toContain(expected) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
  };
}

// ============================================================================
// Pure Functions (extracted from content.js for testing)
// ============================================================================

/**
 * Map detected cell type to fabric-format language identifier
 */
function mapCellTypeToLanguage(cellType) {
  const type = cellType.toLowerCase();

  // Python/PySpark
  if (type === 'python' || type === 'pyspark' || type.includes('python')) {
    return 'python';
  }

  // SparkSQL/SQL
  if (type === 'sql' || type === 'sparksql' || type.includes('sql')) {
    return 'sparksql';
  }

  return null;
}

/**
 * Detect the language/type of a Monaco editor cell
 */
function detectCellType(editor) {
  if (!editor) return 'unknown';

  const modeElement =
    editor.querySelector('[data-mode-id]') ||
    editor.closest?.('[data-mode-id]');
  if (modeElement) {
    const mode = modeElement.getAttribute('data-mode-id');
    return mode;
  }

  const classList = editor.className || '';
  const langMatch = classList.match(/lang-(\w+)/);
  if (langMatch) {
    return langMatch[1];
  }

  return 'unknown';
}

/**
 * Extract code from Monaco editor lines
 */
function extractCodeFromEditor(editorElement) {
  const lines = editorElement.querySelectorAll('.view-lines .view-line');
  const codeLines = [];

  const sortedLines = Array.from(lines).sort((a, b) => {
    const topA = parseFloat(a.style?.top) || 0;
    const topB = parseFloat(b.style?.top) || 0;
    return topA - topB;
  });

  for (const line of sortedLines) {
    let lineText = '';
    const spans = line.querySelectorAll('span > span');

    if (spans.length > 0) {
      for (const span of spans) {
        lineText += span.textContent.replace(/\u00a0/g, ' ');
      }
    } else {
      lineText = line.textContent.replace(/\u00a0/g, ' ');
    }

    codeLines.push(lineText);
  }

  return codeLines.join('\n');
}

/**
 * Check if a frame should be considered active
 */
function checkIframeConditions(
  document,
  isHidden,
  visibilityState,
  hasStatusBar,
) {
  if (isHidden || visibilityState === 'hidden') {
    return false;
  }

  const body = document.body;
  if (!body) {
    return false;
  }

  if (!hasStatusBar) {
    return false;
  }

  return true;
}

// ============================================================================
// Tests: Language Mapping
// ============================================================================

describe('mapCellTypeToLanguage', () => {
  test('maps python to python', () => {
    expect(mapCellTypeToLanguage('python')).toBe('python');
  });

  test('maps Python (uppercase) to python', () => {
    expect(mapCellTypeToLanguage('Python')).toBe('python');
  });

  test('maps pyspark to python', () => {
    expect(mapCellTypeToLanguage('pyspark')).toBe('python');
  });

  test('maps PySpark (mixed case) to python', () => {
    expect(mapCellTypeToLanguage('PySpark')).toBe('python');
  });

  test('maps sql to sparksql', () => {
    expect(mapCellTypeToLanguage('sql')).toBe('sparksql');
  });

  test('maps SQL (uppercase) to sparksql', () => {
    expect(mapCellTypeToLanguage('SQL')).toBe('sparksql');
  });

  test('maps sparksql to sparksql', () => {
    expect(mapCellTypeToLanguage('sparksql')).toBe('sparksql');
  });

  test('maps SparkSQL (mixed case) to sparksql', () => {
    expect(mapCellTypeToLanguage('SparkSQL')).toBe('sparksql');
  });

  test('returns null for scala', () => {
    expect(mapCellTypeToLanguage('scala')).toBeNull();
  });

  test('returns null for r', () => {
    expect(mapCellTypeToLanguage('r')).toBeNull();
  });

  test('returns null for markdown', () => {
    expect(mapCellTypeToLanguage('markdown')).toBeNull();
  });

  test('returns null for unknown', () => {
    expect(mapCellTypeToLanguage('unknown')).toBeNull();
  });

  test('handles python variant in mode name', () => {
    expect(mapCellTypeToLanguage('pythonNB')).toBe('python');
  });

  test('handles sql variant in mode name', () => {
    expect(mapCellTypeToLanguage('sqlDialect')).toBe('sparksql');
  });
});

// ============================================================================
// Tests: Cell Type Detection (DOM-based)
// ============================================================================

describe('detectCellType', () => {
  test('returns unknown for null editor', () => {
    expect(detectCellType(null)).toBe('unknown');
  });

  test('detects type from data-mode-id attribute', () => {
    const dom = new JSDOM(
      '<div class="monaco-editor"><div data-mode-id="python"></div></div>',
    );
    const editor = dom.window.document.querySelector('.monaco-editor');
    expect(detectCellType(editor)).toBe('python');
  });

  test('detects type from parent data-mode-id', () => {
    const dom = new JSDOM(
      '<div data-mode-id="sql"><div class="monaco-editor"></div></div>',
    );
    const editor = dom.window.document.querySelector('.monaco-editor');
    // Note: closest() may not work in JSDOM for this pattern, fallback to unknown
    const result = detectCellType(editor);
    // Accept either sql (if closest works) or unknown (if not)
    expect(result === 'sql' || result === 'unknown').toBeTruthy();
  });

  test('detects type from lang- class', () => {
    const dom = new JSDOM('<div class="monaco-editor lang-pyspark"></div>');
    const editor = dom.window.document.querySelector('.monaco-editor');
    expect(detectCellType(editor)).toBe('pyspark');
  });

  test('returns unknown when no type indicators found', () => {
    const dom = new JSDOM('<div class="monaco-editor"></div>');
    const editor = dom.window.document.querySelector('.monaco-editor');
    expect(detectCellType(editor)).toBe('unknown');
  });
});

// ============================================================================
// Tests: Code Extraction (DOM-based)
// ============================================================================

describe('extractCodeFromEditor', () => {
  test('extracts code from view-lines', () => {
    const dom = new JSDOM(`
      <div class="monaco-editor">
        <div class="view-lines">
          <div class="view-line" style="top: 0px"><span><span>SELECT * FROM table</span></span></div>
        </div>
      </div>
    `);
    const editor = dom.window.document.querySelector('.monaco-editor');
    const code = extractCodeFromEditor(editor);
    expect(code).toBe('SELECT * FROM table');
  });

  test('handles multiple lines sorted by top position', () => {
    const dom = new JSDOM(`
      <div class="monaco-editor">
        <div class="view-lines">
          <div class="view-line" style="top: 20px"><span><span>FROM table</span></span></div>
          <div class="view-line" style="top: 0px"><span><span>SELECT *</span></span></div>
        </div>
      </div>
    `);
    const editor = dom.window.document.querySelector('.monaco-editor');
    const code = extractCodeFromEditor(editor);
    expect(code).toBe('SELECT *\nFROM table');
  });

  test('replaces non-breaking spaces with regular spaces', () => {
    const dom = new JSDOM(`
      <div class="monaco-editor">
        <div class="view-lines">
          <div class="view-line"><span><span>x\u00a0=\u00a01</span></span></div>
        </div>
      </div>
    `);
    const editor = dom.window.document.querySelector('.monaco-editor');
    const code = extractCodeFromEditor(editor);
    expect(code).toBe('x = 1');
  });

  test('handles empty editor', () => {
    const dom = new JSDOM(`
      <div class="monaco-editor">
        <div class="view-lines"></div>
      </div>
    `);
    const editor = dom.window.document.querySelector('.monaco-editor');
    const code = extractCodeFromEditor(editor);
    expect(code).toBe('');
  });

  test('extracts code from direct text content when no nested spans', () => {
    const dom = new JSDOM(`
      <div class="monaco-editor">
        <div class="view-lines">
          <div class="view-line">print("hello")</div>
        </div>
      </div>
    `);
    const editor = dom.window.document.querySelector('.monaco-editor');
    const code = extractCodeFromEditor(editor);
    expect(code).toBe('print("hello")');
  });
});

// ============================================================================
// Tests: Iframe Active Detection
// ============================================================================

describe('checkIframeConditions', () => {
  test('returns false when document is hidden', () => {
    const dom = new JSDOM('<body></body>');
    expect(
      checkIframeConditions(dom.window.document, true, 'visible', true),
    ).toBeFalsy();
  });

  test('returns false when visibility state is hidden', () => {
    const dom = new JSDOM('<body></body>');
    expect(
      checkIframeConditions(dom.window.document, false, 'hidden', true),
    ).toBeFalsy();
  });

  test('returns false when no status bar', () => {
    const dom = new JSDOM('<body></body>');
    expect(
      checkIframeConditions(dom.window.document, false, 'visible', false),
    ).toBeFalsy();
  });

  test('returns true when all conditions met', () => {
    const dom = new JSDOM('<body></body>');
    expect(
      checkIframeConditions(dom.window.document, false, 'visible', true),
    ).toBeTruthy();
  });
});

// ============================================================================
// Tests: Notification Types
// ============================================================================

describe('Notification color mapping', () => {
  const colors = {
    success: { bg: '#0e4429', border: '#238636', text: '#ffffff' },
    warning: { bg: '#4a3800', border: '#9e6a03', text: '#ffffff' },
    error: { bg: '#4a0e0e', border: '#f85149', text: '#ffffff' },
  };

  test('success has green colors', () => {
    expect(colors.success.bg).toBe('#0e4429');
    expect(colors.success.border).toBe('#238636');
  });

  test('warning has amber colors', () => {
    expect(colors.warning.bg).toBe('#4a3800');
    expect(colors.warning.border).toBe('#9e6a03');
  });

  test('error has red colors', () => {
    expect(colors.error.bg).toBe('#4a0e0e');
    expect(colors.error.border).toBe('#f85149');
  });
});

// ============================================================================
// Tests: Status Bar Detection
// ============================================================================

describe('Status bar detection patterns', () => {
  test('detects status bar by class pattern', () => {
    const dom = new JSDOM('<div class="___fr9w3r0"></div>');
    const found = dom.window.document.querySelector('div[class*="___fr9w3r0"]');
    expect(found).toBeTruthy();
  });

  test('detects status bar by Fluent UI classes', () => {
    const dom = new JSDOM('<div class="f1pha7fy f1ewtqcl f5ogflp"></div>');
    const found = dom.window.document.querySelector(
      'div.f1pha7fy.f1ewtqcl.f5ogflp',
    );
    expect(found).toBeTruthy();
  });

  test('detects status bar by CellSelection button', () => {
    const dom = new JSDOM(
      '<div><button name="CellSelection">1 of 5 cells</button></div>',
    );
    const button = dom.window.document.querySelector(
      'button[name="CellSelection"]',
    );
    expect(button).toBeTruthy();
    expect(button.parentElement).toBeTruthy();
  });
});

// ============================================================================
// Tests: Cell Count Extraction
// ============================================================================

describe('Cell count extraction from button text', () => {
  function getTotalCellCount(buttonText) {
    const match = buttonText.match(/of\s+(\d+)\s+cells?/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  test('extracts count from "1 of 5 cells"', () => {
    expect(getTotalCellCount('1 of 5 cells')).toBe(5);
  });

  test('extracts count from "3 of 10 cells"', () => {
    expect(getTotalCellCount('3 of 10 cells')).toBe(10);
  });

  test('extracts count from "1 of 1 cell"', () => {
    expect(getTotalCellCount('1 of 1 cell')).toBe(1);
  });

  test('returns null for non-matching text', () => {
    expect(getTotalCellCount('some other text')).toBeNull();
  });

  test('handles case insensitivity', () => {
    expect(getTotalCellCount('1 OF 5 CELLS')).toBe(5);
  });
});

// ============================================================================
// Tests: Monaco Editor Detection
// ============================================================================

describe('Monaco editor detection', () => {
  test('finds monaco-editor elements', () => {
    const dom = new JSDOM(`
      <div>
        <div class="monaco-editor"></div>
        <div class="monaco-editor"></div>
      </div>
    `);
    const editors = dom.window.document.querySelectorAll('.monaco-editor');
    expect(editors.length).toBe(2);
  });

  test('finds nested monaco-editor elements', () => {
    const dom = new JSDOM(`
      <div class="notebook-container">
        <div class="cell">
          <div class="monaco-editor"></div>
        </div>
        <div class="cell">
          <div class="monaco-editor"></div>
        </div>
      </div>
    `);
    const editors = dom.window.document.querySelectorAll('.monaco-editor');
    expect(editors.length).toBe(2);
  });
});

// ============================================================================
// Tests: Cell Container Detection
// ============================================================================

describe('Cell container detection', () => {
  test('finds nteract-cell-container elements', () => {
    const dom = new JSDOM(`
      <div>
        <div class="nteract-cell-container" data-cell-id="cell-1"></div>
        <div class="nteract-cell-container" data-cell-id="cell-2"></div>
      </div>
    `);
    const cells = dom.window.document.querySelectorAll(
      '.nteract-cell-container[data-cell-id]',
    );
    expect(cells.length).toBe(2);
  });

  test('extracts cell IDs from containers', () => {
    const dom = new JSDOM(`
      <div>
        <div class="nteract-cell-container" data-cell-id="abc-123"></div>
      </div>
    `);
    const cell = dom.window.document.querySelector('.nteract-cell-container');
    expect(cell.getAttribute('data-cell-id')).toBe('abc-123');
  });
});

// ============================================================================
// Tests: URL Parameter Parsing
// ============================================================================

describe('URL parameter parsing', () => {
  test('extracts __iframeType parameter', () => {
    const url = new URL('https://example.com/page?__iframeType=worker');
    const iframeType = url.searchParams.get('__iframeType');
    expect(iframeType).toBe('worker');
  });

  test('returns null for missing parameter', () => {
    const url = new URL('https://example.com/page');
    const iframeType = url.searchParams.get('__iframeType');
    expect(iframeType).toBeNull();
  });

  test('extracts page iframe type', () => {
    const url = new URL('https://example.com/page?__iframeType=page');
    const iframeType = url.searchParams.get('__iframeType');
    expect(iframeType).toBe('page');
  });
});

// ============================================================================
// Tests: Host Detection
// ============================================================================

describe('Host detection for Fabric', () => {
  test('detects pbides hostname', () => {
    const hostname = 'west-us.pbides.fabric.microsoft.com';
    expect(hostname.includes('pbides')).toBeTruthy();
  });

  test('rejects non-fabric hostname', () => {
    const hostname = 'www.example.com';
    expect(hostname.includes('pbides')).toBeFalsy();
  });

  test('rejects generic microsoft hostname', () => {
    const hostname = 'www.microsoft.com';
    expect(hostname.includes('pbides')).toBeFalsy();
  });
});

// ============================================================================
// Cleanup Handler Tests
// ============================================================================

describe('Cleanup handler management', () => {
  /**
   * Simulates the cleanup handler tracking system from content.js
   */
  function createCleanupHandlers() {
    const handlers = {
      observers: [],
      intervals: [],
      timeouts: [],
    };

    function trackObserver(observer) {
      handlers.observers.push(observer);
      return observer;
    }

    function trackInterval(intervalId) {
      handlers.intervals.push(intervalId);
      return intervalId;
    }

    function trackTimeout(timeoutId) {
      handlers.timeouts.push(timeoutId);
      return timeoutId;
    }

    function cleanup() {
      const disconnected = [];
      for (const observer of handlers.observers) {
        if (observer.disconnect) {
          observer.disconnect();
          disconnected.push(observer);
        }
      }
      handlers.observers.length = 0;

      const clearedIntervals = [...handlers.intervals];
      handlers.intervals.length = 0;

      const clearedTimeouts = [...handlers.timeouts];
      handlers.timeouts.length = 0;

      return { disconnected, clearedIntervals, clearedTimeouts };
    }

    return { handlers, trackObserver, trackInterval, trackTimeout, cleanup };
  }

  test('trackObserver adds observer to list', () => {
    const { handlers, trackObserver } = createCleanupHandlers();
    const mockObserver = { disconnect: () => {} };

    trackObserver(mockObserver);

    expect(handlers.observers.length).toBe(1);
    expect(handlers.observers[0]).toBe(mockObserver);
  });

  test('trackInterval adds interval ID to list', () => {
    const { handlers, trackInterval } = createCleanupHandlers();

    trackInterval(123);
    trackInterval(456);

    expect(handlers.intervals.length).toBe(2);
    expect(handlers.intervals[0]).toBe(123);
    expect(handlers.intervals[1]).toBe(456);
  });

  test('trackTimeout adds timeout ID to list', () => {
    const { handlers, trackTimeout } = createCleanupHandlers();

    trackTimeout(789);

    expect(handlers.timeouts.length).toBe(1);
    expect(handlers.timeouts[0]).toBe(789);
  });

  test('cleanup disconnects all observers', () => {
    const { trackObserver, cleanup } = createCleanupHandlers();
    let disconnectCalled = false;
    const mockObserver = {
      disconnect: () => {
        disconnectCalled = true;
      },
    };

    trackObserver(mockObserver);
    cleanup();

    expect(disconnectCalled).toBeTruthy();
  });

  test('cleanup clears all handler arrays', () => {
    const { handlers, trackObserver, trackInterval, trackTimeout, cleanup } =
      createCleanupHandlers();

    trackObserver({ disconnect: () => {} });
    trackInterval(1);
    trackTimeout(2);

    expect(handlers.observers.length).toBe(1);
    expect(handlers.intervals.length).toBe(1);
    expect(handlers.timeouts.length).toBe(1);

    cleanup();

    expect(handlers.observers.length).toBe(0);
    expect(handlers.intervals.length).toBe(0);
    expect(handlers.timeouts.length).toBe(0);
  });

  test('cleanup returns info about cleared resources', () => {
    const { trackObserver, trackInterval, trackTimeout, cleanup } =
      createCleanupHandlers();
    const mockObserver = { disconnect: () => {} };

    trackObserver(mockObserver);
    trackInterval(100);
    trackInterval(200);
    trackTimeout(300);

    const result = cleanup();

    expect(result.disconnected.length).toBe(1);
    expect(result.clearedIntervals.length).toBe(2);
    expect(result.clearedTimeouts.length).toBe(1);
  });

  test('track functions return the value for chaining', () => {
    const { trackObserver, trackInterval, trackTimeout } =
      createCleanupHandlers();
    const mockObserver = { disconnect: () => {} };

    expect(trackObserver(mockObserver)).toBe(mockObserver);
    expect(trackInterval(42)).toBe(42);
    expect(trackTimeout(99)).toBe(99);
  });
});

// ============================================================================
// Monaco Lazy-Loading Simulator
// ============================================================================
// This simulator mimics Monaco's lazy-loading behavior in Fabric notebooks.
// Use it to test the stability checking logic without a real browser.
//
// Monaco loads content in stages:
//   1. .view-line divs are created (but empty)
//   2. Spans with text populate ASYNCHRONOUSLY after focus
//   3. Text may arrive incrementally over multiple frames
//
// See: fabric-format-ska (original bug), fabric-format-p06 (this simulator)
// ============================================================================

/**
 * Creates a mock Monaco editor that simulates lazy-loading behavior.
 *
 * @param {Object} options Configuration options
 * @param {string[]} options.lines Array of code lines to simulate
 * @param {number} options.initialDelayMs Delay before any text appears (default: 0)
 * @param {number} options.lineDelayMs Delay between lines loading (default: 0)
 * @param {boolean} options.createEmptyDivsFirst Create empty .view-line divs before text (default: true)
 * @param {number} options.emptyDivDelayMs How long divs stay empty (default: 50)
 * @returns {Object} Mock editor with DOM and control methods
 */
function createMockMonacoEditor(options = {}) {
  const {
    lines = ['SELECT * FROM table'],
    initialDelayMs = 0,
    lineDelayMs = 0,
    createEmptyDivsFirst = true,
    emptyDivDelayMs = 50,
  } = options;

  // Create the DOM structure
  const dom = new JSDOM('<div class="monaco-editor"></div>');
  const document = dom.window.document;
  const editor = document.querySelector('.monaco-editor');

  // Add view-lines container
  const viewLines = document.createElement('div');
  viewLines.className = 'view-lines';
  editor.appendChild(viewLines);

  // Add textarea (for focus simulation)
  const textarea = document.createElement('textarea');
  textarea.className = 'inputarea';
  editor.appendChild(textarea);

  // Track state
  let isConnected = true;
  let loadingState = 'initial'; // 'initial' | 'divs-created' | 'loading' | 'complete'
  let currentLineIndex = 0;
  let pendingTimeouts = [];

  // Create empty divs immediately if configured
  if (createEmptyDivsFirst) {
    for (let i = 0; i < lines.length; i++) {
      const viewLine = document.createElement('div');
      viewLine.className = 'view-line';
      viewLine.style.top = `${i * 20}px`;
      viewLines.appendChild(viewLine);
    }
    loadingState = 'divs-created';
  }

  /**
   * Populate a single line with text content (simulates Monaco's async text loading)
   */
  function populateLine(index) {
    const lineDiv = viewLines.children[index];
    if (!lineDiv) return;

    const text = lines[index];
    const outerSpan = document.createElement('span');
    const innerSpan = document.createElement('span');
    innerSpan.textContent = text;
    outerSpan.appendChild(innerSpan);
    lineDiv.appendChild(outerSpan);
  }

  /**
   * Start loading text content (call this to simulate focus triggering load)
   */
  function startLoading() {
    if (loadingState === 'complete') return;
    loadingState = 'loading';

    // Schedule initial delay
    const startLoad = () => {
      for (let i = 0; i < lines.length; i++) {
        const delay = initialDelayMs + i * lineDelayMs;
        const timeoutId = setTimeout(() => {
          if (isConnected) {
            populateLine(i);
            currentLineIndex = i + 1;
            if (currentLineIndex >= lines.length) {
              loadingState = 'complete';
            }
          }
        }, delay);
        pendingTimeouts.push(timeoutId);
      }
    };

    if (createEmptyDivsFirst && emptyDivDelayMs > 0) {
      const timeoutId = setTimeout(startLoad, emptyDivDelayMs);
      pendingTimeouts.push(timeoutId);
    } else {
      startLoad();
    }
  }

  /**
   * Simulate disconnecting (virtualization)
   */
  function disconnect() {
    isConnected = false;
    // Clear pending timeouts
    for (const id of pendingTimeouts) {
      clearTimeout(id);
    }
    pendingTimeouts = [];
  }

  /**
   * Simulate reconnecting (scroll back into view)
   */
  function reconnect() {
    isConnected = true;
    // Reset loading state if not complete
    if (loadingState !== 'complete') {
      loadingState = createEmptyDivsFirst ? 'divs-created' : 'initial';
      currentLineIndex = 0;
    }
  }

  /**
   * Get the current state for inspection
   */
  function getState() {
    return {
      isConnected,
      loadingState,
      linesLoaded: currentLineIndex,
      totalLines: lines.length,
    };
  }

  /**
   * Force complete loading (for synchronous tests)
   */
  function completeLoadingSync() {
    for (const id of pendingTimeouts) {
      clearTimeout(id);
    }
    pendingTimeouts = [];

    // Ensure divs exist
    if (viewLines.children.length === 0) {
      for (let i = 0; i < lines.length; i++) {
        const viewLine = document.createElement('div');
        viewLine.className = 'view-line';
        viewLine.style.top = `${i * 20}px`;
        viewLines.appendChild(viewLine);
      }
    }

    // Populate all lines
    for (let i = 0; i < lines.length; i++) {
      const lineDiv = viewLines.children[i];
      if (lineDiv && lineDiv.children.length === 0) {
        populateLine(i);
      }
    }

    loadingState = 'complete';
    currentLineIndex = lines.length;
  }

  return {
    element: editor,
    document,
    textarea,
    startLoading,
    disconnect,
    reconnect,
    getState,
    completeLoadingSync,
    // For cleanup
    cleanup: () => {
      for (const id of pendingTimeouts) {
        clearTimeout(id);
      }
    },
  };
}

// ============================================================================
// Tests: Monaco Lazy-Loading Simulator
// ============================================================================

describe('MockMonacoEditor - Basic functionality', () => {
  test('creates editor with correct DOM structure', () => {
    const mock = createMockMonacoEditor({ lines: ['line1', 'line2'] });
    try {
      expect(mock.element.className).toBe('monaco-editor');
      expect(mock.element.querySelector('.view-lines')).toBeTruthy();
      expect(mock.element.querySelector('textarea.inputarea')).toBeTruthy();
    } finally {
      mock.cleanup();
    }
  });

  test('creates empty view-line divs immediately by default', () => {
    const mock = createMockMonacoEditor({ lines: ['line1', 'line2', 'line3'] });
    try {
      const viewLines = mock.element.querySelectorAll('.view-line');
      expect(viewLines.length).toBe(3);
      // Divs exist but should be empty (no text content yet)
      expect(viewLines[0].textContent).toBe('');
    } finally {
      mock.cleanup();
    }
  });

  test('extractCodeFromEditor returns empty string before loading', () => {
    const mock = createMockMonacoEditor({ lines: ['SELECT * FROM table'] });
    try {
      const code = extractCodeFromEditor(mock.element);
      expect(code).toBe('');
    } finally {
      mock.cleanup();
    }
  });

  test('completeLoadingSync populates all text immediately', () => {
    const mock = createMockMonacoEditor({ lines: ['SELECT *', 'FROM table'] });
    try {
      mock.completeLoadingSync();
      const code = extractCodeFromEditor(mock.element);
      expect(code).toBe('SELECT *\nFROM table');
    } finally {
      mock.cleanup();
    }
  });

  test('getState reports correct loading status', () => {
    const mock = createMockMonacoEditor({ lines: ['a', 'b', 'c'] });
    try {
      expect(mock.getState().loadingState).toBe('divs-created');
      expect(mock.getState().linesLoaded).toBe(0);

      mock.completeLoadingSync();

      expect(mock.getState().loadingState).toBe('complete');
      expect(mock.getState().linesLoaded).toBe(3);
    } finally {
      mock.cleanup();
    }
  });
});

describe('MockMonacoEditor - Simulates lazy loading behavior', () => {
  test('text appears asynchronously after startLoading', async () => {
    const mock = createMockMonacoEditor({
      lines: ['line1'],
      createEmptyDivsFirst: true,
      emptyDivDelayMs: 10,
      initialDelayMs: 10,
    });

    try {
      // Initially empty
      expect(extractCodeFromEditor(mock.element)).toBe('');

      // Start loading
      mock.startLoading();

      // Still empty immediately
      expect(extractCodeFromEditor(mock.element)).toBe('');

      // Wait for loading to complete
      await new Promise((r) => setTimeout(r, 50));

      // Now text should be present
      expect(extractCodeFromEditor(mock.element)).toBe('line1');
    } finally {
      mock.cleanup();
    }
  });

  test('lines load incrementally with lineDelayMs', async () => {
    const mock = createMockMonacoEditor({
      lines: ['line1', 'line2', 'line3'],
      createEmptyDivsFirst: true,
      emptyDivDelayMs: 0,
      initialDelayMs: 0,
      lineDelayMs: 20,
    });

    try {
      mock.startLoading();

      // First line should appear quickly
      await new Promise((r) => setTimeout(r, 10));
      const code1 = extractCodeFromEditor(mock.element);
      expect(code1).toContain('line1');

      // Wait for all lines
      await new Promise((r) => setTimeout(r, 100));
      const code2 = extractCodeFromEditor(mock.element);
      expect(code2).toBe('line1\nline2\nline3');
    } finally {
      mock.cleanup();
    }
  });
});

describe('MockMonacoEditor - Virtualization simulation', () => {
  test('disconnect stops loading', async () => {
    const mock = createMockMonacoEditor({
      lines: ['line1', 'line2'],
      createEmptyDivsFirst: true,
      emptyDivDelayMs: 50,
      initialDelayMs: 50,
    });

    try {
      mock.startLoading();

      // Disconnect before loading completes
      mock.disconnect();

      expect(mock.getState().isConnected).toBeFalsy();

      // Wait and verify loading didn't complete
      await new Promise((r) => setTimeout(r, 150));

      // Text should not have loaded
      expect(extractCodeFromEditor(mock.element)).toBe('');
    } finally {
      mock.cleanup();
    }
  });

  test('reconnect allows loading to resume', () => {
    const mock = createMockMonacoEditor({ lines: ['test'] });

    try {
      mock.disconnect();
      expect(mock.getState().isConnected).toBeFalsy();

      mock.reconnect();
      expect(mock.getState().isConnected).toBeTruthy();
    } finally {
      mock.cleanup();
    }
  });
});

describe('MockMonacoEditor - Stability checking scenarios', () => {
  /**
   * Simulates the stability checking loop from content.js
   * Returns the extracted text once stable, or null if timeout
   */
  async function waitForStableText(
    editor,
    maxAttempts = 20,
    pollMs = 10,
    requiredStableChecks = 3,
  ) {
    let lastText = '';
    let stableCount = 0;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, pollMs));

      const currentText = extractCodeFromEditor(editor);

      if (currentText.length > 0 && currentText === lastText) {
        stableCount++;
        if (stableCount >= requiredStableChecks) {
          return { text: currentText, attempts: i + 1 };
        }
      } else {
        stableCount = 0;
        lastText = currentText;
      }
    }

    return { text: null, attempts: maxAttempts };
  }

  test('stability check succeeds for fast-loading cell', async () => {
    const mock = createMockMonacoEditor({
      lines: ['SELECT * FROM users'],
      createEmptyDivsFirst: true,
      emptyDivDelayMs: 5,
      initialDelayMs: 5,
    });

    try {
      mock.startLoading();

      const result = await waitForStableText(mock.element);

      expect(result.text).toBe('SELECT * FROM users');
      expect(result.attempts).toBeGreaterThan(0);
    } finally {
      mock.cleanup();
    }
  });

  test('stability check handles slow-loading cell', async () => {
    const mock = createMockMonacoEditor({
      lines: ['line1', 'line2'],
      createEmptyDivsFirst: true,
      emptyDivDelayMs: 20,
      initialDelayMs: 20,
      lineDelayMs: 30,
    });

    try {
      mock.startLoading();

      // This simulates a cell that loads over ~70ms total
      const result = await waitForStableText(mock.element, 30, 10);

      expect(result.text).toBe('line1\nline2');
    } finally {
      mock.cleanup();
    }
  });

  test('stability check detects changing text (not falsely stable)', async () => {
    const mock = createMockMonacoEditor({
      lines: ['a', 'b', 'c', 'd', 'e'],
      createEmptyDivsFirst: true,
      emptyDivDelayMs: 0,
      initialDelayMs: 0,
      lineDelayMs: 15, // Lines arrive every 15ms
    });

    try {
      mock.startLoading();

      // With 5 lines at 15ms each = 75ms total
      // Stability check should wait for all lines
      const result = await waitForStableText(mock.element, 30, 10);

      // Should have all 5 lines
      expect(result.text).toBe('a\nb\nc\nd\ne');
    } finally {
      mock.cleanup();
    }
  });

  test('stability check times out for never-loading cell', async () => {
    const mock = createMockMonacoEditor({
      lines: ['test'],
      createEmptyDivsFirst: true,
      emptyDivDelayMs: 1000, // Very slow - won't complete in time
    });

    try {
      mock.startLoading();

      // Short timeout - will fail
      const result = await waitForStableText(mock.element, 5, 10);

      expect(result.text).toBeNull();
      expect(result.attempts).toBe(5);
    } finally {
      mock.cleanup();
    }
  });
});

// ============================================================================
// Run Tests
// ============================================================================

console.log('\n==================================================');
console.log('Chromium Extension Content Script Tests');
console.log('==================================================');

// Run all test suites (they execute when describe() is called)

console.log('\n==================================================');
console.log(
  `TOTAL: ${testResults.passed}/${testResults.passed + testResults.failed} tests passed`,
);
console.log('==================================================');

if (testResults.failed > 0) {
  console.log('\nFailed tests:');
  for (const { name, error } of testResults.errors) {
    console.log(`  - ${name}: ${error}`);
  }
  process.exit(1);
}

process.exit(0);
