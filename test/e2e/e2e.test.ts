/**
 * Simple End-to-End Test for LLM Gateway
 * Tests basic HTTP request flow against a running server
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';

const GATEWAY_BASE_URL = `http://localhost:3000`;
const MOCK_SERVER_PORT = 3001;

describe('LLM Gateway End-to-End Test', () => {
  beforeAll(async () => {
    // Just wait for services to be ready (they should be started externally)
    console.log('Waiting for LLM Gateway to be ready...');
    let retries = 30;
    while (retries > 0) {
      try {
        const response = await request(GATEWAY_BASE_URL).get('/health');
        if (response.status === 200) {
          console.log('LLM Gateway is ready');
          break;
        }
      } catch (error) {
        // Gateway not ready yet
      }

      retries--;
      if (retries === 0) {
        throw new Error('LLM Gateway failed to start within timeout');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check mock server is ready too
    console.log('Waiting for Mock Server to be ready...');
    let mockRetries = 30;
    while (mockRetries > 0) {
      try {
        const response = await fetch(`http://localhost:${MOCK_SERVER_PORT}/health`);
        if (response.ok) {
          console.log('Mock Server is ready');
          break;
        }
      } catch (error) {
        // Mock server not ready yet
      }

      mockRetries--;
      if (mockRetries === 0) {
        throw new Error('Mock Server failed to start within timeout');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }, 60000);

  it('should handle basic chat completion request', async () => {
    const requestBody = {
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      stream: false
    };

    const response = await request(GATEWAY_BASE_URL)
      .post('/v1/chat/completions')
      .send(requestBody)
      .expect(200);

    // AI SDK v4 response format
    expect(response.body).toHaveProperty('text');
    expect(response.body).toHaveProperty('finishReason', 'stop');
    expect(response.body).toHaveProperty('usage');
    expect(response.body.usage).toHaveProperty('promptTokens');
    expect(response.body.usage).toHaveProperty('completionTokens');
    expect(response.body.usage).toHaveProperty('totalTokens');
    expect(response.body).toHaveProperty('response');
    expect(response.body.response).toHaveProperty('body');
    expect(response.body.response.body).toHaveProperty('model');
    expect(response.body.text).toContain('Mock response');
  });

  it('should return health status', async () => {
    const response = await request(GATEWAY_BASE_URL)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('ok');
  });


});
