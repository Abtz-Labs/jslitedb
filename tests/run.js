#!/usr/bin/env node

/**
 * Test Runner Scrip
 * Provides different test running modes and utilities
 */

const { spawn } = require('child_process');
const path = require('path');

const TEST_COMMANDS = {
  unit: 'jest tests/unit --verbose',
  integration: 'jest tests/integration --verbose',
  performance: 'jest tests/integration/performance.test.js --verbose',
  coverage: 'jest --coverage',
  watch: 'jest --watch',
  ci: 'jest --ci --coverage --watchAll=false',
  api: 'jest tests/integration/rest-api.test.js --verbose',
  core: 'jest tests/unit/jslitedb-core.test.js --verbose',
  collection: 'jest tests/unit/collection.test.js --verbose',
  queryresult: 'jest tests/unit/queryresult.test.js --verbose',
  utilities: 'jest tests/unit/utilities.test.js --verbose'
};

function showHelp() {
  console.log('JSLiteDB Test Runner');
  console.log('===================');
  console.log('');
  console.log('Available commands:');
  console.log('  npm test                 - Run all tests');
  console.log('  npm run test:unit        - Run unit tests only');
  console.log('  npm run test:integration - Run integration tests only');
  console.log('  npm run test:performance - Run performance tests only');
  console.log('  npm run test:coverage    - Run tests with coverage report');
  console.log('  npm run test:watch       - Run tests in watch mode');
  console.log('  npm run test:ci          - Run tests in CI mode');
  console.log('');
  console.log('Specific test files:');
  console.log('  node tests/run.js api        - Run REST API tests');
  console.log('  node tests/run.js core       - Run core JSLiteDB tests');
  console.log('  node tests/run.js collection - Run Collection class tests');
  console.log('  node tests/run.js queryresult- Run QueryResult class tests');
  console.log('  node tests/run.js utilities  - Run utility classes tests');
  console.log('');
  console.log('Other options:');
  console.log('  node tests/run.js help       - Show this help');
}

function runCommand(command) {
  console.log(`Running: ${command}`);
  console.log('='.repeat(50));

  const [cmd, ...args] = command.split(' ');
  const proc = spawn(cmd, args, {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..')
  });

  proc.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Tests completed successfully!');
    } else {
      console.log('\n❌ Tests failed!');
      process.exit(code);
    }
  });

  proc.on('error', (error) => {
    console.error('Failed to start test command:', error);
    process.exit(1);
  });
}

// Get command from command line arguments
const command = process.argv[2];

if (!command || command === 'help') {
  showHelp();
  process.exit(0);
}

if (TEST_COMMANDS[command]) {
  runCommand(TEST_COMMANDS[command]);
} else {
  console.error(`Unknown command: ${command}`);
  console.log('');
  showHelp();
  process.exit(1);
}