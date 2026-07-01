#!/usr/bin/env node

// When installed via npx/npm, use the ncc bundle (self-contained, no deps to install).
// Fall back to the raw tsc output when running from source (local dev / npm link).
try {
  require('../dist/bundle/index.js');
} catch {
  require('../dist/index.js');
}
