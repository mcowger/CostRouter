/**
 * End-to-End Tests for LLM Gateway
 * Tests complete HTTP request flow against running servers
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import MockLLMServer from '../mock-server/mock-llm-server.js';

// Test configuration
const GATEWAY_PORT = 3000;
const MOCK_SERVER_PORTS = {
  primary: 3001,
  backup: 3002,
  anthropic: 3003
};

const GATEWAY_BASE_URL = `http://localhost:${GATEWAY_PORT}`;

describe('LLM Gateway End-to-End Tests', () => {
  let mockServers: { [key: string]: MockLLMServer } = {};

  beforeAll(async () => {
    // Start mock servers
    console.log('Starting mock servers...');
    
    mockServers.primary = new MockLLMServer(MOCK_SERVER_PORTS.primary);
    mockServers.backup = new MockLLMServer(MOCK_SERVER_PORTS.backup);
    mockServers.anthropic = new MockLLMServer(MOCK_SERVER_PORTS.anthropic);

    await Promise.all([
      mockServers.primary.start(),
      mockServers.backup.start(),
      mockServers.anthropic.start()
    ]);

    console.log('Mock servers started');

    // Wait for LLM Gateway to be ready (should be started externally)
    console.log('Waiting for LLM Gateway to be ready...');
    let retries = 30;
    while (retries > 0) {
      try {
        const response = await request(GATEWAY_BASE_URL).get('/v1/models');
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
  }, 60000);

  afterAll(async () => {
    // Stop mock servers
    console.log('Stopping mock servers...');
    await Promise.all([
      mockServers.primary?.stop(),
      mockServers.backup?.stop(),
      mockServers.anthropic?.stop()
    ]);
    console.log('Mock servers stopped');
  });

  beforeEach(async () => {
    // Reset mock servers before each test
    await Promise.all([
      request(`http://localhost:${MOCK_SERVER_PORTS.primary}`).post('/test/reset'),
      request(`http://localhost:${MOCK_SERVER_PORTS.backup}`).post('/test/reset'),
      request(`http://localhost:${MOCK_SERVER_PORTS.anthropic}`).post('/test/reset')
    ]);
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(GATEWAY_BASE_URL)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Non-Streaming Chat Completions', () => {
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

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('object', 'chat.completion');
      expect(response.body).toHaveProperty('choices');
      expect(response.body.choices).toHaveLength(1);
      expect(response.body.choices[0]).toHaveProperty('message');
      expect(response.body.choices[0].message).toHaveProperty('role', 'assistant');
      expect(response.body.choices[0].message).toHaveProperty('content');
      expect(response.body).toHaveProperty('usage');
      expect(response.body.usage).toHaveProperty('prompt_tokens');
      expect(response.body.usage).toHaveProperty('completion_tokens');
      expect(response.body.usage).toHaveProperty('total_tokens');
    });

    it('should handle different models', async () => {
      const models = ['gpt-4o', 'gpt-4o-mini'];

      for (const model of models) {
        const requestBody = {
          model,
          messages: [{ role: 'user', content: `Test message for ${model}` }],
          stream: false
        };

        const response = await request(GATEWAY_BASE_URL)
          .post('/v1/chat/completions')
          .send(requestBody)
          .expect(200);

        expect(response.body.model).toBe(model);
        expect(response.body.choices[0].message.content).toContain(model);
      }
    });

    it('should return 404 for unsupported models', async () => {
      const requestBody = {
        model: 'unsupported-model',
        messages: [{ role: 'user', content: 'Test message' }],
        stream: false
      };

      const response = await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('unsupported-model');
    });

    it('should validate request body', async () => {
      // Missing model
      await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send({
          messages: [{ role: 'user', content: 'Test' }]
        })
        .expect(400);

      // Missing messages
      await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send({
          model: 'gpt-4o'
        })
        .expect(400);

      // Empty messages array
      await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send({
          model: 'gpt-4o',
          messages: []
        })
        .expect(400);
    });
  });

  describe('Streaming Chat Completions', () => {
    it('should handle streaming chat completion request', async () => {
      const requestBody = {
        model: 'gpt-4o',
        messages: [
          { role: 'user', content: 'Tell me a short story' }
        ],
        stream: true
      };

      const response = await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.headers['transfer-encoding']).toBe('chunked');

      // Parse streaming response
      const chunks = response.text.split('\n\n').filter(chunk => chunk.startsWith('data: '));
      expect(chunks.length).toBeGreaterThan(0);

      // Check for proper SSE format
      const firstChunk = chunks[0];
      expect(firstChunk).toMatch(/^data: /);
      
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk).toBe('data: [DONE]');

      // Parse JSON chunks (excluding [DONE])
      const jsonChunks = chunks.slice(0, -1).map(chunk => {
        const jsonStr = chunk.replace('data: ', '');
        return JSON.parse(jsonStr);
      });

      expect(jsonChunks.length).toBeGreaterThan(0);
      expect(jsonChunks[0]).toHaveProperty('object', 'chat.completion.chunk');
      expect(jsonChunks[0]).toHaveProperty('choices');
    });

    it('should handle streaming with different models', async () => {
      const requestBody = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Stream test for GPT-4o-mini' }],
        stream: true
      };

      const response = await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');

      // Verify model in response
      const chunks = response.text.split('\n\n').filter(chunk => chunk.startsWith('data: '));
      const firstJsonChunk = JSON.parse(chunks[0].replace('data: ', ''));
      expect(firstJsonChunk.model).toBe('gpt-4o-mini');
    });
  });

  describe('Provider Failover', () => {
    it('should failover to backup provider when primary is rate limited', async () => {
      // Simulate rate limit on primary provider
      await request(`http://localhost:${MOCK_SERVER_PORTS.primary}`)
        .post('/test/simulate-rate-limit')
        .send({ provider: 'mock-openai-primary' });

      const requestBody = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test failover' }],
        stream: false
      };

      // First request should still work (using backup)
      const response = await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(200);

      expect(response.body.choices[0].message.content).toContain('Test failover');
    });

    it('should return 503 when all providers are rate limited', async () => {
      // Simulate rate limit on all providers
      await Promise.all([
        request(`http://localhost:${MOCK_SERVER_PORTS.primary}`)
          .post('/test/simulate-rate-limit')
          .send({ provider: 'mock-openai-primary' }),
        request(`http://localhost:${MOCK_SERVER_PORTS.backup}`)
          .post('/test/simulate-rate-limit')
          .send({ provider: 'mock-openai-backup' })
      ]);

      const requestBody = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test all rate limited' }],
        stream: false
      };

      await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(503);
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      // Simulate auth error on primary provider
      await request(`http://localhost:${MOCK_SERVER_PORTS.primary}`)
        .post('/test/simulate-auth-error')
        .send({ enabled: true });

      const requestBody = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test auth error' }],
        stream: false
      };

      // Should failover to backup provider
      const response = await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(200);

      expect(response.body.choices[0].message.content).toContain('Test auth error');
    });

    it('should handle timeout errors', async () => {
      // Simulate timeout on primary provider
      await request(`http://localhost:${MOCK_SERVER_PORTS.primary}`)
        .post('/test/simulate-timeout')
        .send({ enabled: true });

      const requestBody = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test timeout' }],
        stream: false
      };

      // Should failover to backup provider or return error
      const response = await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send(requestBody);

      // Either succeeds with backup or returns appropriate error
      expect([200, 500, 503]).toContain(response.status);
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const requestBody = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Concurrent test' }],
        stream: false
      };

      const requests = Array(5).fill(0).map((_, index) => 
        request(GATEWAY_BASE_URL)
          .post('/v1/chat/completions')
          .send({
            ...requestBody,
            messages: [{ role: 'user', content: `Concurrent test ${index}` }]
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.choices[0].message.content).toContain(`Concurrent test ${index}`);
      });
    });
  });

  describe('Usage Tracking', () => {
    it('should track usage and costs correctly', async () => {
      const requestBody = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test usage tracking with a longer message to generate more tokens' }],
        stream: false
      };

      const response = await request(GATEWAY_BASE_URL)
        .post('/v1/chat/completions')
        .send(requestBody)
        .expect(200);

      expect(response.body.usage).toHaveProperty('prompt_tokens');
      expect(response.body.usage).toHaveProperty('completion_tokens');
      expect(response.body.usage).toHaveProperty('total_tokens');
      expect(response.body.usage.prompt_tokens).toBeGreaterThan(0);
      expect(response.body.usage.completion_tokens).toBeGreaterThan(0);
      expect(response.body.usage.total_tokens).toBe(
        response.body.usage.prompt_tokens + response.body.usage.completion_tokens
      );
    });
  });
});
