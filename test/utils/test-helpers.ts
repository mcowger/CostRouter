/**
 * Test Helper Utilities
 * Common utilities for E2E testing
 */

import request from 'supertest';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatCompletionResponse {
  text: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  response: {
    id: string;
    modelId: string;
    timestamp: string;
    body: {
      id: string;
      object: string;
      created: number;
      model: string;
      choices: Array<{
        index: number;
        message: {
          role: string;
          content: string;
        };
        finish_reason: string;
      }>;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };
  };
}

export class TestHelpers {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Send a chat completion request
   */
  async sendChatCompletion(requestBody: ChatCompletionRequest) {
    return request(this.baseUrl)
      .post('/v1/chat/completions')
      .send(requestBody);
  }

  /**
   * Send a non-streaming chat completion request
   */
  async sendNonStreamingChat(model: string, message: string) {
    return this.sendChatCompletion({
      model,
      messages: [{ role: 'user', content: message }],
      stream: false
    });
  }

  /**
   * Send a streaming chat completion request
   */
  async sendStreamingChat(model: string, message: string) {
    return this.sendChatCompletion({
      model,
      messages: [{ role: 'user', content: message }],
      stream: true
    });
  }

  /**
   * Parse streaming response (AI SDK v4 returns plain text)
   */
  parseStreamingResponse(responseText: string) {
    return {
      fullContent: responseText,
      isDone: true, // AI SDK v4 streaming completes when response is received
      isValid: responseText && responseText.length > 0
    };
  }

  /**
   * Wait for a service to be ready
   */
  async waitForService(url: string, maxRetries: number = 30, retryDelay: number = 1000): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Service not ready yet
      }

      if (i < maxRetries - 1) {
        await this.sleep(retryDelay);
      }
    }

    throw new Error(`Service at ${url} failed to become ready after ${maxRetries} retries`);
  }

  /**
   * Wait for LLM Gateway to be ready
   */
  async waitForGateway(maxRetries: number = 30, retryDelay: number = 1000): Promise<void> {
    return this.waitForService(`${this.baseUrl}/health`, maxRetries, retryDelay);
  }

  /**
   * Reset mock server state
   */
  async resetMockServer(port: number) {
    try {
      await request(`http://localhost:${port}`)
        .post('/test/reset')
        .expect(200);
    } catch (error) {
      console.warn(`Failed to reset mock server on port ${port}:`, error);
    }
  }

  /**
   * Simulate rate limit on mock server
   */
  async simulateRateLimit(port: number, provider?: string) {
    return request(`http://localhost:${port}`)
      .post('/test/simulate-rate-limit')
      .send({ provider });
  }

  /**
   * Simulate timeout on mock server
   */
  async simulateTimeout(port: number, enabled: boolean = true) {
    return request(`http://localhost:${port}`)
      .post('/test/simulate-timeout')
      .send({ enabled });
  }

  /**
   * Simulate auth error on mock server
   */
  async simulateAuthError(port: number, enabled: boolean = true) {
    return request(`http://localhost:${port}`)
      .post('/test/simulate-auth-error')
      .send({ enabled });
  }

  /**
   * Check health of a service
   */
  async checkHealth(url: string) {
    try {
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate AI SDK v4 response format
   */
  validateChatCompletionResponse(response: any): response is ChatCompletionResponse {
    return (
      typeof response === 'object' &&
      typeof response.text === 'string' &&
      typeof response.finishReason === 'string' &&
      typeof response.usage === 'object' &&
      typeof response.usage.promptTokens === 'number' &&
      typeof response.usage.completionTokens === 'number' &&
      typeof response.usage.totalTokens === 'number' &&
      typeof response.response === 'object' &&
      typeof response.response.body === 'object' &&
      typeof response.response.body.model === 'string'
    );
  }

  /**
   * Validate streaming response format (AI SDK v4)
   */
  validateStreamingResponse(responseText: string): boolean {
    return typeof responseText === 'string' && responseText.length > 0;
  }

  /**
   * Generate test messages
   */
  generateTestMessages(count: number = 1): ChatMessage[] {
    const messages: ChatMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      messages.push({
        role: 'user',
        content: `Test message ${i + 1}: ${this.generateRandomText()}`
      });
    }

    return messages;
  }

  /**
   * Generate random text for testing
   */
  private generateRandomText(): string {
    const words = [
      'hello', 'world', 'test', 'message', 'artificial', 'intelligence',
      'language', 'model', 'completion', 'response', 'request', 'data'
    ];
    
    const length = Math.floor(Math.random() * 10) + 5;
    const selectedWords = [];
    
    for (let i = 0; i < length; i++) {
      selectedWords.push(words[Math.floor(Math.random() * words.length)]);
    }
    
    return selectedWords.join(' ');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default TestHelpers;
