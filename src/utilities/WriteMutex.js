/**
 * Simple mutex implementation for file write operations
 * Ensures only one write operation can proceed at a time to prevent file conflicts
 */
class WriteMutex {
  constructor() {
    this.locked = false;
    this.queue = [];
  }

  /**
   * Acquire the mutex lock
   * @returns {Promise<void>} Resolves when the lock is acquired
   */
  async acquire() {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  /**
   * Release the mutex lock and process the next queued operation
   */
  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.locked = false;
    }
  }

  /**
   * Execute a function with the mutex lock
   * @param {Function} fn - Function to execute with lock acquired
   * @returns {Promise<*>} The result of the function
   */
  async acquire(fn) {
    if (typeof fn === 'function') {
      // New usage: acquire(callback) - execute callback with lock
      await this._acquire();
      try {
        return await fn();
      } finally {
        this.release();
      }
    } else {
      // Old usage: acquire() - just get the lock
      return this._acquire();
    }
  }

  /**
   * Internal method to acquire the mutex lock
   * @returns {Promise<void>} Resolves when the lock is acquired
   */
  async _acquire() {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  /**
   * Get the current state of the mutex
   * @returns {Object} Object containing lock status and queue length
   */
  getStatus() {
    return {
      locked: this.locked,
      queueLength: this.queue.length
    };
  }
}

module.exports = WriteMutex;