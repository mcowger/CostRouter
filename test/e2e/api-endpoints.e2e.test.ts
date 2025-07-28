/**
 * Self-contained End-to-End Test for LLM Gateway
 * Starts its own test environment and tests basic HTTP request flow
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const GATEWAY_BASE_URL = `http://localhost:3000`;
const MOCK_SERVER_PORT = 3001;

interface ProcessInfo {
  name: string;
  process: ChildProcess;
  port: number;
}

describe('LLM Gateway End-to-End Test', () => {
  let processes: ProcessInfo[] = [];

  const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const startMockServer = async (): Promise<void> => {
    console.log('🎭 Starting mock server...');

    const mockProcess = spawn('tsx', ['test/mock-server/start-mock-server.ts'], {
      env: { ...process.env, MOCK_SERVER_PORT: '3001' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    processes.push({
      name: 'Mock Server',
      process: mockProcess,
      port: 3001
    });

    // Suppress output unless there's an error
    mockProcess.stderr?.on('data', (data) => {
      console.error(`[Mock Server Error] ${data.toString().trim()}`);
    });

    mockProcess.on('exit', (code) => {
      if (code !== 0 && code !== 143) { // 143 = SIGTERM (graceful shutdown)
        console.error(`Mock server exited with code ${code}`);
      }
    });

    await sleep(2000);
  };

  const startLLMGateway = async (): Promise<void> => {
    console.log('🌉 Starting LLM Gateway...');

    const gatewayProcess = spawn('tsx', [
      'server/index.ts',
      '--config', path.join(process.cwd(), 'config.test.jsonc'),
      '--usage-db-path', path.join(process.cwd(), 'usage.test.db.json')
    ], {
      env: {
        ...process.env,
        NODE_ENV: 'test'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    processes.push({
      name: 'LLM Gateway',
      process: gatewayProcess,
      port: 3000
    });

    // Suppress output unless there's an error
    gatewayProcess.stderr?.on('data', (data) => {
      console.error(`[Gateway Error] ${data.toString().trim()}`);
    });

    gatewayProcess.on('exit', (code) => {
      if (code !== 0 && code !== 143) { // 143 = SIGTERM (graceful shutdown)
        console.error(`LLM Gateway exited with code ${code}`);
      }
    });

    await sleep(3000);
  };

  const waitForServices = async (): Promise<void> => {
    console.log('⏳ Waiting for services to be ready...');

    // Wait for mock server
    let mockRetries = 30;
    while (mockRetries > 0) {
      try {
        const response = await fetch(`http://localhost:${MOCK_SERVER_PORT}/health`);
        if (response.ok) {
          console.log('✅ Mock Server is ready');
          break;
        }
      } catch (error) {
        // Mock server not ready yet
      }

      mockRetries--;
      if (mockRetries === 0) {
        throw new Error('Mock Server failed to start within timeout');
      }

      await sleep(1000);
    }

    // Wait for LLM Gateway
    let gatewayRetries = 30;
    while (gatewayRetries > 0) {
      try {
        const response = await request(GATEWAY_BASE_URL).get('/health');
        if (response.status === 200) {
          console.log('✅ LLM Gateway is ready');
          break;
        }
      } catch (error) {
        // Gateway not ready yet
      }

      gatewayRetries--;
      if (gatewayRetries === 0) {
        throw new Error('LLM Gateway failed to start within timeout');
      }

      await sleep(1000);
    }
  };

  const stopAllProcesses = async (): Promise<void> => {
    console.log('🛑 Stopping all processes...');

    for (const processInfo of processes) {
      try {
        processInfo.process.kill('SIGTERM');

        // Wait for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            processInfo.process.kill('SIGKILL');
            resolve();
          }, 5000);

          processInfo.process.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        console.error(`Error stopping ${processInfo.name}:`, error);
      }
    }

    processes = [];
  };

  beforeAll(async () => {
    // Start test environment
    await startMockServer();
    await startLLMGateway();
    await waitForServices();
    console.log('🎉 Test environment is ready!');
  }, 60000);

  afterAll(async () => {
    // Clean up test environment
    await stopAllProcesses();
  }, 30000);

  beforeEach(async () => {
    // Reset mock server state before each test to avoid rate limiting issues
    try {
      await fetch(`http://localhost:${MOCK_SERVER_PORT}/test/reset`, { method: 'POST' });
    } catch (error) {
      // Ignore reset errors - mock server might not be ready yet
    }
  });

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

    // OpenAI API format response
    expect(response.body).toHaveProperty('id');
    expect(response.body.id).toMatch(/^chatcmpl-/);
    expect(response.body).toHaveProperty('object', 'chat.completion');
    expect(response.body).toHaveProperty('created');
    expect(response.body).toHaveProperty('model', 'gpt-4o');
    expect(response.body).toHaveProperty('choices');
    expect(response.body.choices).toHaveLength(1);
    expect(response.body.choices[0]).toHaveProperty('index', 0);
    expect(response.body.choices[0]).toHaveProperty('message');
    expect(response.body.choices[0].message).toHaveProperty('role', 'assistant');
    expect(response.body.choices[0].message).toHaveProperty('content');
    expect(response.body.choices[0].message.content).toContain('Mock response');
    expect(response.body.choices[0]).toHaveProperty('finish_reason', 'stop');
    expect(response.body).toHaveProperty('usage');
    expect(response.body.usage).toHaveProperty('prompt_tokens');
    expect(response.body.usage).toHaveProperty('completion_tokens');
    expect(response.body.usage).toHaveProperty('total_tokens');
  });

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

    // For streaming, expect plain text response with SSE format
    expect(response.headers['content-type']).toMatch(/text\/plain/);
    expect(response.headers['transfer-encoding']).toBe('chunked');
    expect(response.text).toContain('data:');
    expect(response.text).toContain('Mock');
    expect(response.text).toContain('streaming');
    expect(response.text).toContain('response');
    expect(response.text).toContain('[DONE]');
  });

  it('should handle different models', async () => {
    const requestBody = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Hello GPT-4o-mini!' }
      ],
      stream: false
    };

    const response = await request(GATEWAY_BASE_URL)
      .post('/v1/chat/completions')
      .send(requestBody)
      .expect(200);

    // Should return OpenAI API format with the requested model
    expect(response.body).toHaveProperty('model', 'gpt-4o-mini');
    expect(response.body.choices[0].message.content).toContain('Mock response');
    expect(response.body.choices[0].message.content).toContain('gpt-4o-mini');
  });

  it('should handle invalid model requests', async () => {
    const requestBody = {
      model: 'invalid-model',
      messages: [
        { role: 'user', content: 'Hello' }
      ],
      stream: false
    };

    const response = await request(GATEWAY_BASE_URL)
      .post('/v1/chat/completions')
      .send(requestBody)
      .expect(404);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('No configured provider found for model');
  });

  it('should handle malformed requests', async () => {
    const requestBody = {
      // Missing required 'model' field
      messages: [
        { role: 'user', content: 'Hello' }
      ]
    };

    const response = await request(GATEWAY_BASE_URL)
      .post('/v1/chat/completions')
      .send(requestBody)
      .expect(404); // Missing model returns 404 (no provider found)

    expect(response.body).toHaveProperty('error');
  });

  it('should return health status', async () => {
    const response = await request(GATEWAY_BASE_URL)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('ok');
  });




});
