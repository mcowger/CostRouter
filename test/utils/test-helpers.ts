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
   * Parse streaming response chunks
   */
  parseStreamingResponse(responseText: string) {
    const chunks = responseText
      .split('\n\n')
      .filter(chunk => chunk.startsWith('data: '))
      .map(chunk => chunk.replace('data: ', ''));

    const jsonChunks = chunks
      .filter(chunk => chunk !== '[DONE]')
      .map(chunk => {
        try {
          return JSON.parse(chunk);
        } catch (error) {
          console.warn('Failed to parse chunk:', chunk);
          return null;
        }
      })
      .filter(chunk => chunk !== null);

    return {
      chunks: jsonChunks,
      isDone: chunks.includes('[DONE]'),
      fullContent: this.extractContentFromChunks(jsonChunks)
    };
  }

  /**
   * Extract full content from streaming chunks
   */
  private extractContentFromChunks(chunks: any[]): string {
    return chunks
      .map(chunk => chunk.choices?.[0]?.delta?.content || '')
      .join('');
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
   * Validate OpenAI API response format
   */
  validateChatCompletionResponse(response: any): response is ChatCompletionResponse {
    return (
      typeof response === 'object' &&
      typeof response.id === 'string' &&
      response.object === 'chat.completion' &&
      typeof response.created === 'number' &&
      typeof response.model === 'string' &&
      Array.isArray(response.choices) &&
      response.choices.length > 0 &&
      typeof response.choices[0].message === 'object' &&
      typeof response.choices[0].message.role === 'string' &&
      typeof response.choices[0].message.content === 'string' &&
      typeof response.usage === 'object' &&
      typeof response.usage.prompt_tokens === 'number' &&
      typeof response.usage.completion_tokens === 'number' &&
      typeof response.usage.total_tokens === 'number'
    );
  }

  /**
   * Validate streaming chunk format
   */
  validateStreamingChunk(chunk: any): boolean {
    return (
      typeof chunk === 'object' &&
      typeof chunk.id === 'string' &&
      chunk.object === 'chat.completion.chunk' &&
      typeof chunk.created === 'number' &&
      typeof chunk.model === 'string' &&
      Array.isArray(chunk.choices) &&
      chunk.choices.length > 0
    );
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
