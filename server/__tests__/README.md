# LLM Gateway Backend Testing Suite

This directory contains comprehensive unit tests for the LLM Gateway backend using Jest as the testing framework.

## Overview

The test suite provides comprehensive coverage of the core LLM request/response pipeline, including:

- **UnifiedExecutor**: Core LLM execution logic with streaming and non-streaming support
- **Router**: Provider selection and request routing logic
- **Integration Tests**: End-to-end request flow testing
- **Error Handling**: Network errors, API failures, and edge cases
- **Streaming**: Comprehensive streaming response testing

## Test Structure

### Core Test Files

- `simple.test.ts` - Basic Jest setup verification
- `UnifiedExecutor-simple.test.ts` - Core LLM execution logic tests
- `Router-simple.test.ts` - Provider selection and routing tests
- `integration-simple.test.ts` - End-to-end request flow tests
- `streaming.test.ts` - Streaming response handling tests
- `error-scenarios.test.ts` - Error handling and edge case tests

### Mock Files

- `__mocks__/ai-sdk.ts` - AI SDK mocking utilities (not used in simplified tests)
- `__mocks__/express.ts` - Express request/response mocking utilities (not used in simplified tests)

### Configuration Files

- `setup.ts` - Jest test setup and global configuration
- `../../jest.config.js` - Jest configuration for TypeScript and ES modules

## Running Tests

### All Tests
```bash
pnpm test
```

### Specific Test Files
```bash
pnpm test simple.test.ts
pnpm test UnifiedExecutor-simple.test.ts
pnpm test Router-simple.test.ts
pnpm test integration-simple.test.ts
pnpm test streaming.test.ts
pnpm test error-scenarios.test.ts
```

### With Coverage
```bash
pnpm test:coverage
```

### Watch Mode
```bash
pnpm test:watch
```

## Test Coverage

Current test coverage (as of latest run):
- **45 tests** passing across 6 test suites
- **Router**: 95% statement coverage, 87.5% branch coverage
- **UnifiedExecutor**: 85.22% statement coverage, 56.41% branch coverage
- **Executor**: 78.57% statement coverage, 50% branch coverage

## Mocking Strategy

### AI SDK Mocking
The tests use comprehensive mocking of the AI SDK to avoid hitting real LLM endpoints:

```typescript
jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn()
}));

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn()
}));
```

### Provider Mocking
All AI SDK provider modules are mocked to prevent import issues and ensure tests run in isolation.

### Express Mocking
Request and response objects are mocked using factory functions that create realistic Express-like objects.

## Key Testing Patterns

### 1. Dynamic Imports
Tests use dynamic imports to avoid module loading issues:

```typescript
const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
```

### 2. Mock Setup
Each test sets up mocks before execution:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  // Setup specific mocks for the test
});
```

### 3. Singleton Reset
Components using singleton patterns are reset between tests:

```typescript
afterEach(() => {
  (Router as any).instance = null;
});
```

## Test Categories

### 1. Unit Tests
- Test individual components in isolation
- Mock all dependencies
- Focus on specific functionality

### 2. Integration Tests
- Test complete request flows
- Test component interactions
- Verify end-to-end behavior

### 3. Error Handling Tests
- Network timeouts and failures
- API authentication errors
- Rate limiting scenarios
- Malformed requests

### 4. Streaming Tests
- Streaming response handling
- Usage tracking for streams
- Stream interruption scenarios
- Different provider streaming

### 5. Edge Case Tests
- Large payloads
- Concurrent requests
- Zero-length messages
- Configuration errors

## Best Practices

### 1. Test Isolation
- Each test runs in isolation with fresh mocks
- No shared state between tests
- Proper cleanup in afterEach hooks

### 2. Realistic Mocking
- Mocks simulate real API behavior
- Include realistic usage data
- Test both success and failure scenarios

### 3. Comprehensive Coverage
- Test both streaming and non-streaming flows
- Cover error scenarios and edge cases
- Verify usage tracking and cost calculation

### 4. Maintainable Tests
- Clear test descriptions
- Logical grouping with describe blocks
- Reusable mock factories

## Adding New Tests

When adding new tests:

1. Follow the existing naming convention (`*.test.ts`)
2. Use dynamic imports for components
3. Mock all external dependencies
4. Include both success and failure scenarios
5. Reset singletons in afterEach hooks
6. Use descriptive test names and organize with describe blocks

## Troubleshooting

### Common Issues

1. **Module Import Errors**: Ensure all dependencies are mocked before importing
2. **Singleton State**: Reset singleton instances between tests
3. **Async Errors**: Use proper async/await and error handling
4. **Mock Timing**: Set up mocks before calling the code under test

### Debug Tips

1. Use `console.log` in tests for debugging (mocked by default)
2. Check mock call counts and arguments
3. Verify async operations complete before assertions
4. Use Jest's `--verbose` flag for detailed output
