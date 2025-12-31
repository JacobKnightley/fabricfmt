# Privacy Policy for fabricfmt Chrome Extension

**Last Updated:** December 31, 2025

## Overview

The fabricfmt Chrome extension ("the Extension") is a code formatting tool for Microsoft Fabric notebooks. This privacy policy explains how the Extension handles user data.

## Data Collection

**The Extension does not collect, store, or transmit any user data.**

Specifically, the Extension:
- Does NOT collect personal information
- Does NOT track user behavior or analytics
- Does NOT transmit any data to external servers
- Does NOT use cookies or local storage for tracking
- Does NOT access browsing history

## How the Extension Works

The Extension operates entirely within your browser:

1. It detects code cells on Microsoft Fabric notebook pages
2. It formats code locally using bundled formatting libraries
3. All processing happens on your device—no data leaves your browser

## Permissions

The Extension requires the following permissions:

- **Host permissions** (`fabric.microsoft.com`, `powerbi.com`): Required to inject the formatting functionality into Fabric notebook pages
- **Clipboard access**: Required to apply formatted code back to notebook cells

These permissions are used solely for the formatting functionality and not for data collection.

## Third-Party Services

The Extension does not integrate with any third-party services or APIs. All formatting is performed locally using:
- [Ruff](https://github.com/astral-sh/ruff) (Python formatting, via WebAssembly)
- Custom Spark SQL formatter (based on Apache Spark's ANTLR grammar)

## Changes to This Policy

Any changes to this privacy policy will be posted in this file and reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue at:
https://github.com/jacobknightley/fabricfmt/issues

## Open Source

This extension is open source. You can review the complete source code at:
https://github.com/jacobknightley/fabricfmt
