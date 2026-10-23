/**
 * test-framework.mjs
 * Lightweight, zero-dependency TAP and structured test framework for E2E testing.
 */

export class TestRunner {
  constructor(options = {}) {
    this.name = options.name || 'E2E Test Suite';
    this.tests = [];
    this.currentSuite = '';
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
    this.failures = [];
    this.startTime = 0;
    this.tapMode = options.tapMode || false;
  }

  suite(name) {
    this.currentSuite = name;
    if (!this.tapMode) {
      console.log(`\n\x1b[1;34m▶ Suite: ${name}\x1b[0m`);
    }
  }

  async test(name, fn) {
    const fullName = this.currentSuite ? `${this.currentSuite} > ${name}` : name;
    const testIndex = this.passed + this.failed + this.skipped + 1;
    const testStart = performance.now();

    try {
      if (!this.tapMode) {
        process.stdout.write(`  \x1b[90m•\x1b[0m ${name} ... `);
      }
      await fn();
      const durationMs = (performance.now() - testStart).toFixed(1);
      this.passed++;
      if (this.tapMode) {
        console.log(`ok ${testIndex} - ${fullName} # time=${durationMs}ms`);
      } else {
        console.log(`\x1b[32mPASS\x1b[0m \x1b[90m(${durationMs}ms)\x1b[0m`);
      }
    } catch (err) {
      const durationMs = (performance.now() - testStart).toFixed(1);
      this.failed++;
      this.failures.push({
        index: testIndex,
        suite: this.currentSuite,
        name,
        fullName,
        error: err.message || String(err),
        stack: err.stack,
      });

      if (this.tapMode) {
        console.log(`not ok ${testIndex} - ${fullName} # time=${durationMs}ms`);
        console.log(`  ---`);
        console.log(`  message: ${JSON.stringify(err.message)}`);
        console.log(`  ...`);
      } else {
        console.log(`\x1b[31mFAIL\x1b[0m \x1b[90m(${durationMs}ms)\x1b[0m`);
        console.log(`    \x1b[31m✖ Error: ${err.message}\x1b[0m`);
      }
    }
  }

  skip(name, reason = 'skipped') {
    const fullName = this.currentSuite ? `${this.currentSuite} > ${name}` : name;
    const testIndex = this.passed + this.failed + this.skipped + 1;
    this.skipped++;
    if (this.tapMode) {
      console.log(`ok ${testIndex} - ${fullName} # SKIP ${reason}`);
    } else {
      console.log(`  \x1b[90m•\x1b[0m ${name} ... \x1b[33mSKIP\x1b[0m \x1b[90m(${reason})\x1b[0m`);
    }
  }

  start() {
    this.startTime = performance.now();
    if (this.tapMode) {
      console.log(`TAP version 13`);
    } else {
      console.log(`\x1b[1;36m============================================================\x1b[0m`);
      console.log(`\x1b[1;36m  ${this.name}\x1b[0m`);
      console.log(`\x1b[1;36m============================================================\x1b[0m`);
    }
  }

  finish() {
    const total = this.passed + this.failed + this.skipped;
    const durationTotal = ((performance.now() - this.startTime) / 1000).toFixed(2);

    if (this.tapMode) {
      console.log(`1..${total}`);
      console.log(`# tests ${total}`);
      console.log(`# pass  ${this.passed}`);
      console.log(`# fail  ${this.failed}`);
      console.log(`# skip  ${this.skipped}`);
      console.log(`# duration ${durationTotal}s`);
    } else {
      console.log(`\n\x1b[1;36m============================================================\x1b[0m`);
      console.log(`\x1b[1;37m  SUMMARY:\x1b[0m Total: ${total} | \x1b[32mPassed: ${this.passed}\x1b[0m | \x1b[31mFailed: ${this.failed}\x1b[0m | \x1b[33mSkipped: ${this.skipped}\x1b[0m | \x1b[90m${durationTotal}s\x1b[0m`);
      if (this.failures.length > 0) {
        console.log(`\x1b[1;31m\n  FAILURES (${this.failures.length}):\x1b[0m`);
        for (const f of this.failures) {
          console.log(`  \x1b[31m[#${f.index}] ${f.fullName}\x1b[0m`);
          console.log(`    ${f.error}`);
        }
      }
      console.log(`\x1b[1;36m============================================================\x1b[0m\n`);
    }

    return {
      total,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      failures: this.failures,
      durationTotal,
      exitCode: this.failed > 0 ? 1 : 0,
    };
  }
}

export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Expected ${expectedStr}, but got ${actualStr}`
    );
  }
}

export function assertMatch(actual, regex, message) {
  if (!regex.test(String(actual))) {
    throw new Error(
      message || `Expected string to match ${regex}, got: ${actual}`
    );
  }
}

export function assertIncludes(actual, item, message) {
  if (Array.isArray(actual)) {
    if (!actual.includes(item)) {
      throw new Error(message || `Array does not include expected item: ${JSON.stringify(item)}`);
    }
  } else if (typeof actual === 'string') {
    if (!actual.includes(item)) {
      throw new Error(message || `String does not include expected substring: ${JSON.stringify(item)}`);
    }
  } else {
    throw new Error(`Unsupported type for assertIncludes: ${typeof actual}`);
  }
}

export function assertRange(value, min, max, message) {
  if (value < min || value > max) {
    throw new Error(message || `Expected ${value} to be within range [${min}, ${max}]`);
  }
}
