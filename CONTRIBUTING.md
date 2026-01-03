# Contributing

## Prerequisites

- Node.js 18+
- Python 3.8+ (for ANTLR build script)
- Java 11+ (for ANTLR code generation)

## Repository Structure

This is a monorepo with two packages:

```
fabric-format/
├── packages/
│   ├── core/           # @jacobknightley/fabric-format (npm library)
│   │   ├── src/
│   │   ├── grammar/
│   │   └── .build/     # ANTLR build scripts
│   └── chromium/       # Chrome/Edge extension
│       ├── src/
│       ├── dist/
│       └── manifest.json
├── README.md
├── SQL_STYLE_GUIDE.md
└── tsconfig.base.json
```

## Build

```bash
npm install
npm run build          # Build all packages
npm run build:core     # Build core library only
npm run build:chromium # Build extension only
```

## Test

```bash
npm test               # Run all tests (core + chromium)
npm run test:core      # Run core library tests only
npm run test:chromium  # Run extension tests only
npm run test:verbose   # With failure details
```

### Testing the Chromium Extension

The extension tests run in Node.js with a mocked DOM environment:

```bash
npm run test:chromium
```

For manual testing in the browser:

1. Build the extension: `npm run build:chromium`
2. Load as unpacked extension in Chrome/Edge (see [README](./README.md#installation))
3. Open a Fabric notebook and test the Format button

**Note:** Content scripts run in an isolated context. You cannot test extension code directly in the browser's DevTools console—the page's JavaScript and the extension's JavaScript are in separate worlds.

## Architecture

The SQL formatter is **100% grammar-driven** — Apache Spark's ANTLR grammar is the single source of truth. No hardcoded keyword lists.

```
Input SQL → Dual Lexing → ANTLR Parser → Parse Tree → Analyzer → Formatter → Output
```

### Key Design Decisions

1. **Grammar-Driven**: Keywords detected via `symbolicNames[tokenType] === text.toUpperCase()`
2. **Parse Tree Context**: Visitor pattern identifies identifier vs keyword positions
3. **Dual Lexing**: Parse uppercase for token types, preserve original text

### Core Package Structure

```
packages/core/src/
├── cli.ts                 # CLI entry point
├── cell-formatter.ts      # Low-level cell formatting API
├── notebook-formatter.ts  # Notebook file formatting
├── formatters/
│   ├── sparksql/          # Spark SQL (ANTLR-based)
│   └── python/            # Ruff WASM wrapper
└── tests/
```

### Chromium Package Structure

```
packages/chromium/
├── src/
│   └── content.js         # Content script injected into Fabric
├── build.js               # esbuild configuration
├── manifest.json          # Extension manifest
└── PRIVACY.md             # Privacy policy for store submission
```

## Adding Tests

```typescript
// packages/core/src/tests/sparksql/my-feature.test.ts
export const myFeatureTests: TestSuite = {
  name: "My Feature",
  tests: [{ name: "test case", input: "select ...", expected: "SELECT ..." }],
};
```

Then import and add to `packages/core/src/tests/index.ts`.

## Publishing

### Core (npm)

```bash
cd packages/core
npm version patch|minor|major
npm publish
```

### Chromium (Web Store)

1. `npm run build:chromium`
2. Zip contents of `packages/chromium` (excluding `node_modules`)
3. Upload to Chrome Web Store / Edge Add-ons