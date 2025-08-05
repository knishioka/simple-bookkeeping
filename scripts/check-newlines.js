#!/usr/bin/env node

/**
 * Check for missing newlines at end of files
 * This script is used in pre-commit hooks to ensure all text files have a newline at EOF
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// File extensions to check
const CHECK_EXTENSIONS = [
  '.sh',
  '.bash',
  '.zsh',
  '.fish',
  '.env',
  '.env.example',
  '.env.local.example',
  '.gitignore',
  '.prettierignore',
  '.eslintignore',
  '.dockerignore',
  '.editorconfig',
  'Dockerfile',
  'Makefile',
];

// Patterns to check (for files without extensions)
const CHECK_PATTERNS = [
  /^\.env/,
  /^Dockerfile/,
  /^Makefile/,
  /^\..*rc$/, // .bashrc, .zshrc, etc.
];

function shouldCheckFile(filename) {
  const basename = path.basename(filename);

  // Check by extension
  if (CHECK_EXTENSIONS.some((ext) => filename.endsWith(ext))) {
    return true;
  }

  // Check by pattern
  if (CHECK_PATTERNS.some((pattern) => pattern.test(basename))) {
    return true;
  }

  return false;
}

function checkNewlineAtEOF(filepath) {
  try {
    const content = fs.readFileSync(filepath);
    if (content.length === 0) {
      return true; // Empty files are OK
    }

    const lastChar = content[content.length - 1];
    return lastChar === 0x0a; // LF character
  } catch (error) {
    console.error(`Error reading file ${filepath}:`, error.message);
    return true; // Assume OK if we can't read
  }
}

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
    });
    return output
      .trim()
      .split('\n')
      .filter((file) => file.length > 0);
  } catch (error) {
    return [];
  }
}

function main() {
  const stagedFiles = getStagedFiles();
  const filesToCheck = stagedFiles.filter(shouldCheckFile);

  if (filesToCheck.length === 0) {
    return 0;
  }

  console.log('🔍 Checking for newlines at end of files...');

  const missingNewlines = [];

  for (const file of filesToCheck) {
    if (!checkNewlineAtEOF(file)) {
      missingNewlines.push(file);
    }
  }

  if (missingNewlines.length > 0) {
    console.error('❌ The following files are missing newlines at EOF:');
    missingNewlines.forEach((file) => console.error(`   - ${file}`));
    console.error('\n💡 Fix by running: echo "" >> <filename>');
    return 1;
  }

  console.log('✅ All files have proper newlines at EOF');
  return 0;
}

// Run if called directly
if (require.main === module) {
  process.exit(main());
}
