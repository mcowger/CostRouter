/**
 * Comprehensive error handling and edge case tests
 * Tests various error scenarios, network issues, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock all dependencies before importing
jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn()
}));

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn()
}));

// Mock all provider modules to avoid import issues
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: jest.fn() }));
jest.mock('@ai-sdk/google-vertex', () => ({ createVertex: jest.fn() }));
jest.mock('@ai-sdk/amazon-bedrock', () => ({ createAmazonBedrock: jest.fn() }));
jest.mock('@ai-sdk/groq', () => ({ createGroq: jest.fn() }));
jest.mock('@ai-sdk/mistral', () => ({ createMistral: jest.fn() }));
jest.mock('@ai-sdk/deepseek', () => ({ createDeepSeek: jest.fn() }));
jest.mock('@ai-sdk/xai', () => ({ createXai: jest.fn() }));
jest.mock('@ai-sdk/perplexity', () => ({ createPerplexity: jest.fn() }));
jest.mock('@ai-sdk/togetherai', () => ({ createTogetherAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));
jest.mock('@openrouter/ai-sdk-provider', () => ({ openrouter: jest.fn() }));
jest.mock('ollama-ai-provider', () => ({ createOllama: jest.fn() }));
jest.mock('qwen-ai-provider', () => ({ createQwen: jest.fn() }));

jest.mock('../components/Logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../components/Utils.js', () => ({
  getErrorMessage: jest.fn((error: any) => error.message || 'Unknown error')
}));

describe('Error Scenarios and Edge Cases', () => {
  const mockUsageManager = {
    consume: jest.fn(),
    isUnderLimit: jest.fn().mockResolvedValue(true),
    getCurrentUsage: jest.fn().mockReturnValue([])
  };

  const createMockRequest = (overrides: any = {}) => ({
    body: {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
      stream: false,
      ...overrides.body
    },
    ...overrides
  });

  const createMockResponse = (overrides: any = {}) => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    write: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    writeHead: jest.fn().mockReturnThis(),
    locals: {
      chosenProvider: {
        id: 'test-provider',
        type: 'openai',
        apiKey: 'test-key'
      },
      chosenModel: {
        name: 'gpt-3.5-turbo'
      },
      ...overrides.locals
    },
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Network and API errors', () => {
    it('should handle network timeout errors', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      (generateText as jest.MockedFunction<typeof generateText>).mockRejectedValue(timeoutError);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI request failed' });
    });

    it('should handle API rate limit errors', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      (generateText as jest.MockedFunction<typeof generateText>).mockRejectedValue(rateLimitError);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI request failed' });
    });

    it('should handle authentication errors', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const authError = new Error('Invalid API key');
      authError.name = 'AuthenticationError';
      (generateText as jest.MockedFunction<typeof generateText>).mockRejectedValue(authError);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse({
        locals: {
          chosenProvider: { id: 'test-provider', type: 'openai', apiKey: 'invalid-key' },
          chosenModel: { name: 'gpt-3.5-turbo' }
        }
      });

      await executor.execute(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI request failed' });
    });

    it('should handle streaming errors', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { streamText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const streamError = new Error('Stream connection failed');
      (streamText as jest.MockedFunction<typeof streamText>).mockImplementation(() => {
        throw streamError;
      });
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest({ body: { stream: true } });
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI request failed' });
    });
  });

  describe('Configuration errors', () => {
    it('should handle unsupported provider types', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse({
        locals: {
          chosenProvider: { id: 'test-provider', type: 'unsupported-type', apiKey: 'test-key' },
          chosenModel: { name: 'gpt-3.5-turbo' }
        }
      });

      await executor.execute(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI request failed' });
    });

    it('should handle missing API keys gracefully', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { createOpenAI } = await import('@ai-sdk/openai');

      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockImplementation(() => {
        throw new Error('API key is required');
      });

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse({
        locals: {
          chosenProvider: { id: 'test-provider', type: 'openai' }, // Missing apiKey
          chosenModel: { name: 'gpt-3.5-turbo' }
        }
      });

      await executor.execute(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'AI request failed' });
    });
  });

  describe('Request validation errors', () => {
    it('should handle malformed request body', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 5 }
      } as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest({
        body: { model: 'gpt-3.5-turbo', messages: null } // Malformed messages
      });
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      // Should handle gracefully - either succeed or fail with proper error
      expect(generateText).toHaveBeenCalled();
    });

    it('should handle invalid message format', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 5 }
      } as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest({
        body: {
          model: 'gpt-3.5-turbo',
          messages: 'invalid-messages-format' // Should be array
        }
      });
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      // The AI SDK should handle this validation
      expect(generateText).toHaveBeenCalled();
    });
  });

  describe('Usage tracking errors', () => {
    it('should handle usage manager being called', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const mockResult = {
        text: 'Response',
        usage: { promptTokens: 100, completionTokens: 50 }
      };

      (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue(mockResult as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      expect(res.json).toHaveBeenCalledWith(mockResult);
      expect(mockUsageManager.consume).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle very large request payloads', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const largeMessages = Array(100).fill(0).map((_, i) => ({
        role: 'user',
        content: `Message ${i}: ${'x'.repeat(1000)}`
      }));

      (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10000, completionTokens: 500 }
      } as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest({
        body: {
          model: 'gpt-3.5-turbo',
          messages: largeMessages
        }
      });
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      expect(generateText).toHaveBeenCalledWith({
        model: expect.any(Object),
        messages: largeMessages
      });
    });

    it('should handle zero-length messages', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 1, completionTokens: 1 }
      } as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest({
        body: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: '' }]
        }
      });
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      expect(generateText).toHaveBeenCalled();
    });

    it('should handle concurrent requests', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue({
        text: 'Response',
        usage: { promptTokens: 10, completionTokens: 5 }
      } as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);

      const requests = Array(5).fill(0).map(() => {
        const req = createMockRequest();
        const res = createMockResponse();
        return executor.execute(req as any, res as any);
      });

      await Promise.all(requests);

      expect(generateText).toHaveBeenCalledTimes(5);
    });
  });
});
