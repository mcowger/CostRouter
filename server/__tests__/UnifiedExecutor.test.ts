/**
 * Simplified Unit tests for UnifiedExecutor
 * Tests the core LLM request/response handling without complex mocking
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the AI SDK modules before importing anything
jest.mock('ai', () => ({
  generateText: jest.fn(),
  streamText: jest.fn()
}));

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn()
}));

jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: jest.fn()
}));

jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn()
}));

// Mock all the provider modules to avoid import issues (AI SDK v4 compatible)
jest.mock('@ai-sdk/google-vertex', () => ({ createVertex: jest.fn() }));
jest.mock('@ai-sdk/amazon-bedrock', () => ({ createAmazonBedrock: jest.fn() }));
jest.mock('@ai-sdk/groq', () => ({ createGroq: jest.fn() }));
jest.mock('@ai-sdk/mistral', () => ({ createMistral: jest.fn() }));
jest.mock('@ai-sdk/deepseek', () => ({ createDeepSeek: jest.fn() }));
jest.mock('@ai-sdk/xai', () => ({ createXai: jest.fn() }));
jest.mock('@ai-sdk/perplexity', () => ({ createPerplexity: jest.fn() }));
jest.mock('@ai-sdk/togetherai', () => ({ createTogetherAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));
jest.mock('ollama-ai-provider', () => ({ createOllama: jest.fn() }));
jest.mock('qwen-ai-provider', () => ({ createQwen: jest.fn() }));
jest.mock('ai-sdk-provider-gemini-cli', () => ({ createGeminiProvider: jest.fn() }));
jest.mock('ai-sdk-provider-claude-code', () => ({ createClaudeCode: jest.fn() }));

// Mock the logger to avoid import issues
jest.mock('../components/Logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock Utils
jest.mock('../components/Utils.js', () => ({
  getErrorMessage: jest.fn((error: any) => error.message || 'Unknown error')
}));

// Mock PriceData
const mockGetPriceWithOverride = jest.fn(() => ({
  inputCostPerMillionTokens: 1000,
  outputCostPerMillionTokens: 2000
}));

jest.mock('../components/PriceData.js', () => ({
  PriceData: {
    getInstance: jest.fn(() => ({
      getPriceWithOverride: mockGetPriceWithOverride
    }))
  }
}));

describe('UnifiedExecutor - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the PriceData mock
    mockGetPriceWithOverride.mockReturnValue({
      inputCostPerMillionTokens: 1000,
      outputCostPerMillionTokens: 2000
    });
  });

  // Mock data
  const mockUsage = {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150
  };

  const mockGenerateTextResult = {
    text: 'This is a mock response from the AI model.',
    usage: mockUsage,
    finishReason: 'stop'
  };

  const mockStreamTextResult = {
    usage: Promise.resolve(mockUsage),
    finishReason: Promise.resolve('stop'),
    textStream: (async function* () {
      yield 'Hello';
      yield ' world';
      yield '!';
    })()
  };

  // Mock UsageManager
  const mockUsageManager = {
    consume: jest.fn(),
    isUnderLimit: jest.fn().mockResolvedValue(true),
    getCurrentUsage: jest.fn().mockReturnValue([])
  };

  // Mock Express objects
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

  it('should be able to create UnifiedExecutor instance', async () => {
    // Dynamically import to avoid module loading issues
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    const executor = new UnifiedExecutor(mockUsageManager as any);
    
    expect(executor).toBeDefined();
    expect(typeof executor.execute).toBe('function');
    expect(typeof executor.clearCache).toBe('function');
  });

  it('should handle provider factory registration', async () => {
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    
    // Test static methods
    const supportedProviders = UnifiedExecutor.getSupportedProviders();
    expect(Array.isArray(supportedProviders)).toBe(true);
    expect(supportedProviders.length).toBeGreaterThan(0);
    
    // Test provider registration
    const mockFactory = jest.fn();
    UnifiedExecutor.registerProvider('test-provider', mockFactory);
    
    const updatedProviders = UnifiedExecutor.getSupportedProviders();
    expect(updatedProviders).toContain('test-provider');
  });

  it('should handle basic execution flow', async () => {
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    const { generateText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');
    
    // Setup mocks
    (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue(mockGenerateTextResult as any);
    (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
      modelId: modelName,
      provider: 'openai',
      // Add any other properties that the AI SDK model might expect
    }) as any);

    const executor = new UnifiedExecutor(mockUsageManager as any);
    const req = createMockRequest();
    const res = createMockResponse();

    await executor.execute(req as any, res as any);

    expect(generateText).toHaveBeenCalled();
    expect(mockUsageManager.consume).toHaveBeenCalled();

    // Expect OpenAI API format response
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^chatcmpl-/),
      object: "chat.completion",
      created: expect.any(Number),
      model: "gpt-3.5-turbo",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: "This is a mock response from the AI model.",
          refusal: null
        },
        finish_reason: "stop",
        logprobs: null
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      }
    }));
  });

  it('should handle errors gracefully', async () => {
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    const { generateText } = await import('ai');
    
    // Make generateText throw an error
    (generateText as jest.MockedFunction<typeof generateText>).mockRejectedValue(new Error('API Error'));

    const executor = new UnifiedExecutor(mockUsageManager as any);
    const req = createMockRequest();
    const res = createMockResponse();

    await executor.execute(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'AI request failed' });
  });

  it('should handle streaming requests', async () => {
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    const { streamText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');
    
    // Setup mocks
    (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamTextResult as any);
    (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
      modelId: modelName,
      provider: 'openai'
    }) as any);

    const executor = new UnifiedExecutor(mockUsageManager as any);
    const req = createMockRequest({ body: { stream: true } });
    const res = createMockResponse();

    await executor.execute(req as any, res as any);

    expect(streamText).toHaveBeenCalled();
    // For streaming, expect writeHead to be called to set up SSE headers
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked'
    }));
  });

  it('should clear cache correctly', async () => {
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    
    const executor = new UnifiedExecutor(mockUsageManager as any);
    
    // This should not throw
    expect(() => executor.clearCache()).not.toThrow();
  });

  it('should handle unsupported provider types', async () => {
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    
    const executor = new UnifiedExecutor(mockUsageManager as any);
    const req = createMockRequest();
    const res = createMockResponse({
      locals: {
        chosenProvider: {
          id: 'test-provider',
          type: 'unsupported-provider-type',
          apiKey: 'test-key'
        },
        chosenModel: {
          name: 'test-model'
        }
      }
    });

    await executor.execute(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'AI request failed' });
  });
});
