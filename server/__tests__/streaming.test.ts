/**
 * Comprehensive streaming tests
 * Tests streaming LLM responses using simulateReadableStream from @ai-sdk/core
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock AI SDK with streaming support
jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn()
}));

// Note: @ai-sdk/core is not available in this project, so we'll mock streaming differently

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn()
}));

// Mock all provider modules
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
jest.mock('@openrouter/ai-sdk-provider', () => ({ createOpenRouter: jest.fn() }));
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

describe('Streaming Tests', () => {
  const mockUsageManager = {
    consume: jest.fn(),
    isUnderLimit: jest.fn().mockResolvedValue(true),
    getCurrentUsage: jest.fn().mockReturnValue([])
  };

  const mockUsage = {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150
  };

  const createMockRequest = (overrides: any = {}) => ({
    body: {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Tell me a story' }],
      stream: true,
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
    setHeader: jest.fn().mockReturnThis(),
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

  describe('Basic streaming functionality', () => {
    it('should handle successful streaming request', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { streamText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      // Mock streaming result
      const mockStreamResult = {
        usage: Promise.resolve(mockUsage),
        finishReason: Promise.resolve('stop'),
        pipeTextStreamToResponse: jest.fn()
      };

      (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamResult as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      expect(streamText).toHaveBeenCalledWith({
        model: expect.any(Object),
        messages: req.body.messages
      });

      expect(mockStreamResult.pipeTextStreamToResponse).toHaveBeenCalledWith(res);
    });

    it('should track usage after streaming completion', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { streamText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const mockStreamResult = {
        usage: Promise.resolve(mockUsage),
        finishReason: Promise.resolve('stop'),
        pipeTextStreamToResponse: jest.fn()
      };

      (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamResult as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      // Wait for the usage promise to resolve
      await mockStreamResult.usage;

      expect(mockUsageManager.consume).toHaveBeenCalledWith(
        'test-provider',
        'gpt-3.5-turbo',
        expect.objectContaining({
          promptTokens: 100,
          completionTokens: 50
        }),
        expect.any(Number)
      );
    });

    it('should handle streaming with cost calculation', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { streamText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const mockStreamResult = {
        usage: Promise.resolve(mockUsage),
        finishReason: Promise.resolve('stop'),
        pipeTextStreamToResponse: jest.fn()
      };

      (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamResult as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse({
        locals: {
          chosenProvider: {
            id: 'test-provider',
            type: 'openai',
            apiKey: 'test-key'
          },
          chosenModel: {
            name: 'gpt-3.5-turbo',
            pricing: {
              inputCostPerMillionTokens: 1000,
              outputCostPerMillionTokens: 2000
            }
          }
        }
      });

      await executor.execute(req as any, res as any);

      // Wait for usage tracking
      await mockStreamResult.usage;

      // Expected cost: (100 * 1000 + 50 * 2000) / 1_000_000 = 0.2
      expect(mockUsageManager.consume).toHaveBeenCalledWith(
        'test-provider',
        'gpt-3.5-turbo',
        expect.any(Object),
        0.2
      );
    });
  });

  describe('Streaming error handling', () => {
    it('should handle streaming initialization errors', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { streamText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const streamError = new Error('Failed to initialize stream');
      (streamText as jest.MockedFunction<typeof streamText>).mockImplementation(() => {
        throw streamError;
      });
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

    it('should handle usage tracking errors in streaming', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { streamText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const mockStreamResult = {
        usage: Promise.reject(new Error('Usage tracking failed')),
        finishReason: Promise.resolve('stop'),
        pipeTextStreamToResponse: jest.fn()
      };

      (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamResult as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      // Should still pipe the stream even if usage tracking fails
      expect(mockStreamResult.pipeTextStreamToResponse).toHaveBeenCalledWith(res);

      // Wait for usage promise to be handled
      try {
        await mockStreamResult.usage;
      } catch (error) {
        // Expected to fail
      }

      // Usage manager should not be called due to error
      expect(mockUsageManager.consume).not.toHaveBeenCalled();
    });

    it('should handle stream interruption', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { streamText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const mockStreamResult = {
        usage: Promise.resolve(mockUsage),
        finishReason: Promise.resolve('interrupted'),
        pipeTextStreamToResponse: jest.fn()
      };

      (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamResult as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      expect(mockStreamResult.pipeTextStreamToResponse).toHaveBeenCalledWith(res);

      // Should still track usage even if interrupted
      await mockStreamResult.usage;
      expect(mockUsageManager.consume).toHaveBeenCalled();
    });
  });

  describe('Streaming with different providers', () => {
    it('should handle streaming with Anthropic provider', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { streamText } = await import('ai');
      const { createAnthropic } = await import('@ai-sdk/anthropic');

      const mockStreamResult = {
        usage: Promise.resolve(mockUsage),
        finishReason: Promise.resolve('stop'),
        pipeTextStreamToResponse: jest.fn()
      };

      (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamResult as any);
      (createAnthropic as jest.MockedFunction<typeof createAnthropic>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'anthropic'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse({
        locals: {
          chosenProvider: {
            id: 'anthropic-provider',
            type: 'anthropic',
            apiKey: 'test-key'
          },
          chosenModel: {
            name: 'claude-3-sonnet'
          }
        }
      });

      await executor.execute(req as any, res as any);

      expect(streamText).toHaveBeenCalledWith({
        model: expect.objectContaining({
          modelId: 'claude-3-sonnet',
          provider: 'anthropic'
        }),
        messages: req.body.messages
      });
    });

    it('should handle streaming with custom provider', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { streamText } = await import('ai');
      const { createOpenAICompatible } = await import('@ai-sdk/openai-compatible');

      const mockStreamResult = {
        usage: Promise.resolve(mockUsage),
        finishReason: Promise.resolve('stop'),
        pipeTextStreamToResponse: jest.fn()
      };

      (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamResult as any);
      (createOpenAICompatible as jest.MockedFunction<typeof createOpenAICompatible>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai-compatible'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse({
        locals: {
          chosenProvider: {
            id: 'custom-provider',
            type: 'openai-compatible',
            apiKey: 'test-key',
            baseURL: 'https://api.custom.com'
          },
          chosenModel: {
            name: 'custom-model'
          }
        }
      });

      await executor.execute(req as any, res as any);

      expect(streamText).toHaveBeenCalledWith({
        model: expect.objectContaining({
          modelId: 'custom-model',
          provider: 'openai-compatible'
        }),
        messages: req.body.messages
      });
    });
  });

  describe('Usage format compatibility in streaming', () => {
    it('should handle both v1 and v2 usage formats in streaming', async () => {
      const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
      const { streamText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      // Test with v2 format (inputTokens/outputTokens)
      const v2Usage = {
        inputTokens: 75,
        outputTokens: 25,
        totalTokens: 100
      };

      const mockStreamResult = {
        usage: Promise.resolve(v2Usage),
        finishReason: Promise.resolve('stop'),
        pipeTextStreamToResponse: jest.fn()
      };

      (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamResult as any);
      (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
        modelId: modelName,
        provider: 'openai'
      }) as any);

      const executor = new UnifiedExecutor(mockUsageManager as any);
      const req = createMockRequest();
      const res = createMockResponse();

      await executor.execute(req as any, res as any);

      await mockStreamResult.usage;

      expect(mockUsageManager.consume).toHaveBeenCalledWith(
        'test-provider',
        'gpt-3.5-turbo',
        expect.objectContaining({
          promptTokens: 75,
          completionTokens: 25
        }),
        expect.any(Number)
      );
    });
  });
});
