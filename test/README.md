# LLM Gateway End-to-End Testing

This directory contains comprehensive end-to-end tests for the LLM Gateway that test the complete request flow against real HTTP endpoints using mock LLM API servers.

## Overview

The E2E testing system includes:

- **Mock LLM API Servers**: Simulate real provider endpoints (OpenRouter-compatible)
- **Test Configuration**: Dedicated test config pointing to mock servers
- **Complete Request Flow Testing**: Real HTTP requests to the running LLM Gateway
- **Test Orchestration**: Automated startup/shutdown of all services
- **Performance Testing**: Load testing and performance metrics
- **AI SDK v4 Compatibility**: Updated for stable AI SDK v4 instead of beta v5

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   E2E Tests     │───▶│  LLM Gateway    │───▶│  Mock Servers   │
│                 │    │  (Port 3000)    │    │  (Ports 3001-3) │
│ - Basic Flow    │    │                 │    │                 │
│ - Streaming     │    │ - Router        │    │ - OpenAI API    │
│ - Failover      │    │ - Executor      │    │ - Anthropic API │
│ - Error Cases   │    │ - Usage Mgmt    │    │ - Rate Limits   │
│ - Performance   │    │                 │    │ - Auth Errors   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### Run Complete E2E Test Suite
```bash
pnpm test:e2e
```

### Start Test Environment for Manual Testing
```bash
pnpm test:e2e:env
```

### Run Individual Components
```bash
# Start mock servers only
pnpm test:mock-server

# Run unit tests + E2E tests
pnpm test:all
```

## Test Structure

### Core E2E Tests (`test/e2e/e2e.test.ts`)
- **Health Check**: Service availability validation
- **Non-Streaming Chat**: Basic request/response flow
- **Streaming Chat**: SSE streaming validation
- **Provider Failover**: Rate limit and error handling
- **Error Scenarios**: Authentication, timeouts, validation
- **Concurrent Requests**: Multi-request handling
- **Usage Tracking**: Cost calculation and token counting

### Performance Tests (`test/e2e/performance.test.ts`)
- **Response Time**: Latency measurements
- **Concurrent Load**: Multiple simultaneous requests
- **Burst Testing**: High-frequency request bursts
- **Sustained Load**: Long-duration performance
- **Resource Usage**: Large payloads and many messages

### Mock Server (`test/mock-server/`)
- **OpenRouter API Simulation**: Compatible endpoints and responses
- **Multiple Model Support**: GPT-4o, GPT-4o-mini, Claude models
- **Streaming Support**: Proper SSE formatting
- **Error Simulation**: Rate limits, auth errors, timeouts
- **Control Endpoints**: Test scenario configuration

## Configuration

### Test Configuration (`config.test.jsonc`)
```json
{
  "providers": [
    {
      "id": "mock-openai-primary",
      "type": "openrouter",
      "baseURL": "http://localhost:3001/v1",
      "models": [...]
    }
  ]
}
```

### Mock Server Ports
- **3001**: Mock OpenRouter Primary
- **3002**: Mock OpenRouter Backup
- **3003**: Mock OpenRouter Anthropic
- **3000**: LLM Gateway

## Test Scenarios

### 1. Basic Request Flow
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello!"}]}'
```

### 2. Streaming Request
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Stream test"}],"stream":true}'
```

### 3. Provider Failover Test
1. Trigger rate limit on primary provider
2. Send request - should use backup provider
3. Verify response comes from backup

### 4. Error Handling Test
1. Simulate authentication error
2. Send request - should return appropriate error
3. Verify error format matches OpenAI spec

## Mock Server Control

The mock servers provide control endpoints for testing scenarios:

### Reset Server State
```bash
curl -X POST http://localhost:3001/test/reset
```

### Simulate Rate Limit
```bash
curl -X POST http://localhost:3001/test/simulate-rate-limit \
  -H "Content-Type: application/json" \
  -d '{"provider":"mock-openai-primary"}'
```

### Simulate Timeout
```bash
curl -X POST http://localhost:3001/test/simulate-timeout \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'
```

### Simulate Auth Error
```bash
curl -X POST http://localhost:3001/test/simulate-auth-error \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'
```

## Test Utilities

### TestHelpers Class (`test/utils/test-helpers.ts`)
```typescript
const helpers = new TestHelpers();

// Send requests
await helpers.sendNonStreamingChat('gpt-3.5-turbo', 'Hello');
await helpers.sendStreamingChat('gpt-4', 'Stream test');

// Parse streaming responses
const parsed = helpers.parseStreamingResponse(response.text);

// Control mock servers
await helpers.simulateRateLimit(3001);
await helpers.resetMockServer(3001);

// Validate responses
const isValid = helpers.validateChatCompletionResponse(response.body);
```

## Running Tests

### Prerequisites
1. Node.js and pnpm installed
2. All dependencies installed (`pnpm install`)
3. No services running on ports 3000-3003

### Automated Test Execution
```bash
# Complete E2E test suite with automatic setup/teardown
pnpm test:e2e

# Run with verbose output
pnpm test:e2e -- --verbose
```

### Manual Test Environment
```bash
# Start test environment (keeps running)
pnpm test:e2e:env

# In another terminal, run individual tests
jest test/e2e/e2e.test.ts --config jest.e2e.config.js

# Stop with Ctrl+C
```

### Performance Testing
```bash
# Run performance tests specifically
jest test/e2e/performance.test.ts --config jest.e2e.config.js --verbose
```

## Validation

### Response Format Validation
- **OpenAI Compatibility**: Responses match OpenAI API specification
- **SSE Format**: Streaming responses use proper Server-Sent Events format
- **Error Format**: Error responses follow OpenAI error format
- **Usage Data**: Token counts and cost calculations are accurate

### Performance Metrics
- **Response Time**: < 5 seconds for non-streaming, < 2 seconds to first byte for streaming
- **Concurrent Handling**: 10+ concurrent requests without degradation
- **Success Rate**: > 90% success rate under load
- **Failover Time**: < 1 second to switch providers

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check for processes using test ports
   lsof -i :3000 -i :3001 -i :3002 -i :3003
   
   # Kill conflicting processes
   pkill -f "tsx.*server"
   ```

2. **Service Startup Timeout**
   ```bash
   # Check service logs
   pnpm test:e2e:env
   # Look for startup errors in output
   ```

3. **Test Failures**
   ```bash
   # Run with debug output
   DEBUG=* pnpm test:e2e
   
   # Run individual test file
   jest test/e2e/e2e.test.ts --config jest.e2e.config.js --verbose
   ```

### Debug Tips

1. **Check Service Health**
   ```bash
   curl http://localhost:3000/health
   curl http://localhost:3001/health
   ```

2. **Monitor Logs**
   - Mock server logs show request/response details
   - Gateway logs show routing and execution details
   - Test output shows timing and validation results

3. **Validate Configuration**
   - Ensure `config.test.jsonc` points to correct mock server URLs
   - Verify test API keys are configured
   - Check port configurations match between services

## Contributing

When adding new E2E tests:

1. **Follow Existing Patterns**: Use TestHelpers for common operations
2. **Test Both Success and Failure**: Include error scenarios
3. **Validate Response Format**: Use validation helpers
4. **Clean Up**: Reset mock server state between tests
5. **Document New Scenarios**: Update this README with new test cases

### Adding New Test Scenarios

1. Add test case to appropriate test file
2. Use beforeEach to reset mock server state
3. Use TestHelpers for common operations
4. Validate both response format and content
5. Include performance expectations where relevant
