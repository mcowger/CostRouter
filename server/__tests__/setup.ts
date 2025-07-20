/**
 * Jest test setup file
 * This file runs before each test suite and sets up global test configuration
 */

import { jest } from '@jest/globals';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Global test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
