#!/usr/bin/env node

/**
 * Quick test for progress bar updates during large operations
 */

const JSLiteDB = require('../src/index.js');
const fs = require('fs').promises;
const path = require('path');
const cliProgress = require('cli-progress');
const colors = require('colors');

class ProgressTest {
  constructor() {
    this.tempDir = path.join(__dirname, 'temp-progress-test');
    this.multibar = null;
    this.operationProgressBar = null;
  }

  initializeProgressBars() {
    this.multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: colors.green(' {bar}') + ' | {percentage}% | {value}/{total} | {task}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
    }, cliProgress.Presets.shades_grey);

    this.operationProgressBar = this.multibar.create(100, 0, {
      task: colors.yellow('Current Operation')
    });
  }

  updateOperationProgress(value, task = '') {
    if (this.operationProgressBar) {
      this.operationProgressBar.update(value, {
        task: colors.yellow(task)
      });
    }
  }

  stopProgressBars() {
    if (this.multibar) {
      this.multibar.stop();
    }
  }

  generateTestData(count) {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        id: `user_${i}`,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: 20 + (i % 60),
        active: i % 2 === 0,
        createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString()
      });
    }
    return data;
  }

  async testProgressWithSize(size) {
    console.log(`\n🧪 Testing progress bars with ${size.toLocaleString()} documents...`);

    // Clean database
    await fs.rm(this.tempDir, { recursive: true, force: true });

    const db = new JSLiteDB({
      folderPath: this.tempDir,
      autoSaveInterval: 0,
      enableLogging: false
    });

    const collection = db.collection('progress_test');
    const testData = this.generateTestData(size);

    this.updateOperationProgress(0, `Insert Test - Preparing ${size} docs...`);

    // Insert with progress updates
    const progressInterval = Math.max(1, Math.floor(size / 100)); // Update every 1%
    const startTime = Date.now();

    for (let i = 0; i < testData.length; i++) {
      await collection.insert(testData[i].id, testData[i]);

      // Update progress frequently
      if (i % progressInterval === 0 || i === testData.length - 1) {
        const progressPercent = Math.round((i + 1) / testData.length * 100);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = Math.round((i + 1) / (Date.now() - startTime) * 1000);
        this.updateOperationProgress(progressPercent, `Inserting ${i + 1}/${testData.length} (${rate} docs/sec, ${elapsed}s elapsed)`);
      }
    }

    const duration = Date.now() - startTime;
    this.updateOperationProgress(100, `Insert Complete - ${size} docs in ${(duration/1000).toFixed(1)}s (${Math.round(size/duration*1000)} docs/sec)`);

    if (db.stopServer) {
      db.stopServer();
    }

    return duration;
  }

  async run() {
    try {
      this.initializeProgressBars();

      // Test with different sizes
      const testSizes = [1000, 5000, 10000];

      for (const size of testSizes) {
        await this.testProgressWithSize(size);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
      }

      this.stopProgressBars();
      console.log('\n✅ Progress bar test completed successfully!');

    } catch (error) {
      this.stopProgressBars();
      console.error('❌ Progress test failed:', error);
      throw error;
    } finally {
      // Cleanup
      try {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

// Run test if called directly
if (require.main === module) {
  const test = new ProgressTest();
  test.run()
    .then(() => {
      console.log('\n🎉 All tests passed!');
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = ProgressTest;