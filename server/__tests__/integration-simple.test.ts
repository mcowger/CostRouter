/**
 * Integration tests for the complete LLM Gateway request flow
 * Tests the end-to-end pipeline: Router -> Executor -> UnifiedExecutor
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

jest.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: jest.fn()
}));

// Mock all the provider modules
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

jest.mock('../components/ConfigManager.js', () => ({
  ConfigManager: {
    getProviders: jest.fn()
  }
}));

jest.mock('../components/UsageManager.js', () => ({
  UsageManager: {
    getInstance: jest.fn(),
    initialize: jest.fn()
  }
}));

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

describe('Integration Tests - Complete Request Flow', () => {
  // Mock configuration
  const mockProviders = [
    {
      id: 'openai-primary',
      type: 'openai',
      apiKey: 'test-openai-key',
      models: [
        { 
          name: 'gpt-3.5-turbo', 
          mappedName: 'gpt-3.5-turbo',
          pricing: {
            inputCostPerMillionTokens: 1000,
            outputCostPerMillionTokens: 2000
          }
        }
      ]
    },
    {
      id: 'openai-backup',
      type: 'openai',
      apiKey: 'test-backup-key',
      models: [
        { name: 'gpt-3.5-turbo', mappedName: 'gpt-3.5-turbo' }
      ]
    }
  ];

  const mockUsageManager = {
    isUnderLimit: jest.fn(),
    consume: jest.fn(),
    getCurrentUsage: jest.fn()
  };

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
    pipeTextStreamToResponse: jest.fn()
  };

  // Mock Express objects
  const createMockRequest = (overrides: any = {}) => ({
    body: {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, world!' }],
      stream: false,
      ...overrides.body
    },
    ...overrides
  });

  const createMockResponse = (overrides: any = {}) => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {},
    ...overrides
  });

  const createMockNext = () => jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset singletons
    const Router = require('../components/Router.js').Router;
    const Executor = require('../components/Executor.js').Executor;
    (Router as any).instance = null;
    (Executor as any).instance = null;
  });

  it('should handle complete non-streaming request flow', async () => {
    const { ConfigManager } = await import('../components/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');
    const { Executor } = await import('../components/Executor.js');
    const { generateText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');

    // Setup mocks
    (ConfigManager.getProviders as jest.MockedFunction<any>).mockReturnValue(mockProviders);
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);
    (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue(mockGenerateTextResult as any);
    (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
      modelId: modelName,
      provider: 'openai'
    }) as any);

    // Initialize components
    Router.initialize();
    const router = Router.getInstance();
    const executor = Executor.getInstance(mockUsageManager as any);

    const req = createMockRequest({
      body: {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello, world!' }],
        stream: false
      }
    });
    const res = createMockResponse();
    const next = createMockNext();

    // Step 1: Router selects provider
    await router.chooseProvider(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.locals.chosenProvider).toEqual(mockProviders[0]);
    expect(res.locals.chosenModel).toEqual(mockProviders[0].models[0]);

    // Step 2: Executor processes request
    await executor.execute(req as any, res as any);

    expect(generateText).toHaveBeenCalledWith({
      model: expect.any(Object),
      messages: req.body.messages
    });

    expect(res.json).toHaveBeenCalledWith(mockGenerateTextResult);
    expect(mockUsageManager.consume).toHaveBeenCalledWith(
      'openai-primary',
      'gpt-3.5-turbo',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle complete streaming request flow', async () => {
    const { ConfigManager } = await import('../components/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');
    const { Executor } = await import('../components/Executor.js');
    const { streamText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');

    // Setup mocks
    (ConfigManager.getProviders as jest.MockedFunction<any>).mockReturnValue(mockProviders);
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);
    (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamTextResult as any);
    (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
      modelId: modelName,
      provider: 'openai'
    }) as any);

    Router.initialize();
    const router = Router.getInstance();
    const executor = Executor.getInstance(mockUsageManager as any);

    const req = createMockRequest({
      body: {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello, world!' }],
        stream: true
      }
    });
    const res = createMockResponse();
    const next = createMockNext();

    // Step 1: Router selects provider
    await router.chooseProvider(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.locals.chosenProvider).toBeDefined();

    // Step 2: Executor processes streaming request
    await executor.execute(req as any, res as any);

    expect(streamText).toHaveBeenCalledWith({
      model: expect.any(Object),
      messages: req.body.messages
    });
    expect(mockStreamTextResult.pipeTextStreamToResponse).toHaveBeenCalledWith(res);
  });

  it('should handle provider failover correctly', async () => {
    const { ConfigManager } = await import('../components/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');
    const { Executor } = await import('../components/Executor.js');
    const { generateText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');

    // Setup mocks - primary provider is over limit, backup is available
    (ConfigManager.getProviders as jest.MockedFunction<any>).mockReturnValue(mockProviders);
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit
      .mockResolvedValueOnce(false) // Primary over limit
      .mockResolvedValueOnce(true);  // Backup available
    (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue(mockGenerateTextResult as any);
    (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
      modelId: modelName,
      provider: 'openai'
    }) as any);

    Router.initialize();
    const router = Router.getInstance();
    const executor = Executor.getInstance(mockUsageManager as any);

    const req = createMockRequest({
      body: {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello, world!' }]
      }
    });
    const res = createMockResponse();
    const next = createMockNext();

    // Router should select backup provider
    await router.chooseProvider(req as any, res as any, next);

    expect(res.locals.chosenProvider).toEqual(mockProviders[1]); // backup provider
    expect(next).toHaveBeenCalled();

    // Executor should work with backup provider
    await executor.execute(req as any, res as any);

    expect(generateText).toHaveBeenCalled();
    expect(mockUsageManager.consume).toHaveBeenCalledWith(
      'openai-backup',
      'gpt-3.5-turbo',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle model not found error', async () => {
    const { ConfigManager } = await import('../components/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');

    // Setup mocks
    (ConfigManager.getProviders as jest.MockedFunction<any>).mockReturnValue(mockProviders);
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: {
        model: 'nonexistent-model',
        messages: [{ role: 'user', content: 'Hello, world!' }]
      }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No configured provider found for model: nonexistent-model'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle AI API errors gracefully', async () => {
    const { ConfigManager } = await import('../components/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');
    const { Executor } = await import('../components/Executor.js');
    const { generateText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');

    // Setup mocks
    (ConfigManager.getProviders as jest.MockedFunction<any>).mockReturnValue(mockProviders);
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);
    (generateText as jest.MockedFunction<typeof generateText>).mockRejectedValue(new Error('API Error'));
    (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockReturnValue((modelName: string) => ({
      modelId: modelName,
      provider: 'openai'
    }) as any);

    Router.initialize();
    const router = Router.getInstance();
    const executor = Executor.getInstance(mockUsageManager as any);

    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    // Router succeeds
    await router.chooseProvider(req as any, res as any, next);
    expect(next).toHaveBeenCalled();

    // AI API fails
    await executor.execute(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'AI request failed' });
  });
});
