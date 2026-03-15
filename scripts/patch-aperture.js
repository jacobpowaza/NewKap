#!/usr/bin/env node
// Patches aperture module for macOS Sonoma/Sequoia compatibility
const fs = require('fs');
const path = require('path');

const aperturePath = path.join(__dirname, '..', 'node_modules', 'aperture', 'index.js');

if (!fs.existsSync(aperturePath)) {
  console.log('aperture not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(aperturePath, 'utf8');
let patched = false;

// Increase recording start timeout from 5s to 30s for macOS Sonoma+
if (content.includes('within 5 seconds')) {
  content = content.replace(
    /Could not start recording within \d+ seconds/,
    'Could not start recording within 30 seconds'
  );
  content = content.replace(
    /},\s*5000\);/,
    '}, 30000);'
  );
  patched = true;
}

if (patched) {
  fs.writeFileSync(aperturePath, content);
  console.log('✅ Patched aperture: recording timeout increased to 30s');
} else {
  console.log('✅ Aperture already patched or timeout not found');
}
