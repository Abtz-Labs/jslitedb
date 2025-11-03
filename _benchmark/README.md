# JSLiteDB Benchmark Suite

This directory contains a comprehensive benchmark suite that compares JSLiteDB performance against MongoDB and SQLite across various operations and data sizes.

## Features

- **Multi-database comparison**: Tests JSLiteDB, MongoDB, and SQLite
- **Comprehensive operations**: Insert, read, query, update, delete operations
- **Scalability testing**: Tests with 100, 1,000, 5,000, and 10,000 documents
- **Concurrency analysis**: Tests concurrent operations with multiple workers
- **Memory usage tracking**: Monitors memory consumption during operations
- **Detailed reporting**: Generates comprehensive markdown reports

## Quick Star

### Option 1: Run with all databases (recommended)

```bash
# Install optional dependencies for MongoDB and SQLite
npm run install-deps

# Run full benchmark and generate repor
npm run repor
```

### Option 2: Run JSLiteDB-only benchmarks

```bash
# Run benchmark (JSLiteDB only if MongoDB/SQLite not available)
npm run benchmark

# Or generate full repor
node generate-report.js
```

## Prerequisites

### For MongoDB testing:
- MongoDB server running on `localhost:27017`
- Install dependency: `npm install mongodb`

### For SQLite testing:
- Install dependency: `npm install better-sqlite3`

### JSLiteDB only:
- No additional dependencies required (runs automatically)

## Output Files

- `BENCHMARK.json` - Raw benchmark results in JSON forma
- `BENCHMARK.md` - Comprehensive human-readable repor

## Benchmark Operations

### Core Operations Tested:
1. **Insert**: Adding new documents/records
2. **Read**: Retrieving all documents/records
3. **Query**: Filtered searches (age > 30 AND active = true)
4. **Update**: Modifying existing documents/records
5. **Delete**: Removing documents/records

### Additional Tests:
- **Concurrency**: Parallel operations with 1, 5, 10, 20 workers
- **Memory Usage**: Memory consumption tracking
- **Scalability**: Performance across different dataset sizes

## Test Data Structure

Each test document contains:
```javascrip
{
  id: "user_123",
  name: "User 123",
  email: "user123@example.com",
  age: 25,
  active: true,
  profile: {
    bio: "This is user 123",
    location: "City 23",
    preferences: {
      theme: "dark",
      notifications: true
    }
  },
  tags: ["tag3", "category3"],
  createdAt: "2024-01-15T10:30:00.000Z"
}
```

## Understanding Results

### Performance Metrics:
- **Duration**: Time taken to complete operation (milliseconds)
- **Throughput**: Operations per second (when applicable)
- **Memory Usage**: RSS, heap used, and heap total memory

### Result Interpretation:
- Lower duration = Better performance
- Higher throughput = Better performance
- Lower memory usage = More efficien

## Customization

### Modify Test Parameters:
Edit `benchmark.js` to change:
- `testSizes`: Array of document counts to tes
- `concurrencyLevels`: Array of concurrent worker counts
- Test data structure in `generateTestData()`

### Add New Operations:
1. Implement test function in `BenchmarkSuite` class
2. Add to benchmark execution chain in `run()` method
3. Update report generation in `generate-report.js`

## Architecture

### Files:
- `benchmark.js` - Core benchmark suite implementation
- `generate-report.js` - Markdown report generator
- `package.json` - Dependencies and scripts
- `README.md` - This documentation

### Classes:
- `BenchmarkSuite` - Main benchmark orchestrator
- Individual database setup and testing methods
- Report generation and formatting utilities

## Troubleshooting

### MongoDB Connection Issues:
```bash
# Start MongoDB service
brew services start mongodb-community
# Or
sudo systemctl start mongod
```

### SQLite Compilation Issues:
```bash
# Install build tools (macOS)
xcode-select --install

# Install build tools (Linux)
sudo apt-get install build-essential python3
```

### Memory Issues:
```bash
# Increase Node.js memory limi
node --max-old-space-size=4096 generate-report.js
```

## Expected Runtime

- JSLiteDB only: ~30-60 seconds
- With MongoDB: ~60-120 seconds
- With SQLite: ~45-90 seconds
- Full suite: ~90-180 seconds

Runtime varies based on system performance and dataset sizes.