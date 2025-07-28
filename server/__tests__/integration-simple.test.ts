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
jest.mock('ollama-ai-provider', () => ({ createOllama: jest.fn() }));
jest.mock('qwen-ai-provider', () => ({ createQwen: jest.fn() }));
jest.mock('ai-sdk-provider-gemini-cli', () => ({ createGeminiProvider: jest.fn() }));
jest.mock('ai-sdk-provider-claude-code', () => ({ createClaudeCode: jest.fn() }));

jest.mock('../components/config/ConfigManager.js', () => ({
  ConfigManager: {
    getInstance: jest.fn(),
    initialize: jest.fn(),
  },
}));

jest.mock('../components/UsageManager.js', () => {
  let mockInstance;
  const mockUsageManager = {
    initialize: jest.fn(() => {
      mockInstance = {
        isUnderLimit: jest.fn(),
        consume: jest.fn(),
        getCurrentUsage: jest.fn(),
      };
    }),
    getInstance: jest.fn(() => {
      if (!mockInstance) {
        throw new Error("Mock UsageManager must be initialized before use.");
      }
      return mockInstance;
    }),
  };
  return { UsageManager: mockUsageManager };
});

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

// Mock PriceData
jest.mock('../components/PriceData.js', () => {
  let mockInstance;
  const mockPriceData = {
    initialize: jest.fn(() => {
      mockInstance = {
        getPriceWithOverride: jest.fn().mockReturnValue({
          inputCostPerMillionTokens: 1,
          outputCostPerMillionTokens: 2,
        }),
      };
    }),
    getInstance: jest.fn(() => {
      if (!mockInstance) {
        throw new Error("Mock PriceData must be initialized before use.");
      }
      return mockInstance;
    }),
  };
  return { PriceData: mockPriceData };
});

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
    textStream: (async function* () {
      yield 'Hello';
      yield ' world';
      yield '!';
    })()
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
    write: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    writeHead: jest.fn().mockReturnThis(),
    locals: {},
    ...overrides
  });

  const createMockNext = () => jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { PriceData } = await import('../components/PriceData.js');

    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);

    // Ensure PriceData is mocked and initialized before Router
    (PriceData.getInstance as jest.Mock).mockReturnValue({
      getPriceWithOverride: jest.fn(() => ({
        inputCostPerMillionTokens: 1,
        outputCostPerMillionTokens: 2
      }))
    });
    // Explicitly initialize PriceData and UsageManager here since Router depends on them
    PriceData.initialize();
    UsageManager.initialize();
  });

  afterEach(() => {
    const Router = require('../components/Router.js').Router;
    const UnifiedExecutor = require('../components/UnifiedExecutor.js').UnifiedExecutor;
    const PriceData = require('../components/PriceData.js').PriceData;
    const UsageManager = require('../components/UsageManager.js').UsageManager;

    // Resetting singletons
    (Router as any).instance = null;
    (UnifiedExecutor as any).instance = null;
    (PriceData as any).instance = null; // Reset PriceData as well
    (UsageManager as any).instance = null; // Reset UsageManager as well
  });

  it('should handle complete non-streaming request flow', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    const { generateText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');

    // Setup mocks
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true as never);
    (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue(mockGenerateTextResult as any);
    (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockImplementation(
      () => jest.fn((modelId: string) => ({ modelId, provider: 'openai' })) as any
    );

    // Initialize components
    Router.initialize();
    UnifiedExecutor.initialize(mockUsageManager as any);
    const router = Router.getInstance();
    const executor = UnifiedExecutor.getInstance();

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
    // Router now uses random selection, so just verify a valid provider was chosen
    expect(res.locals.chosenProvider).toBeDefined();
    expect(res.locals.chosenModel).toBeDefined();
    expect(res.locals.chosenProvider.type).toBe('openai');
    expect(res.locals.chosenModel.name).toBe('gpt-3.5-turbo');

    // Step 2: Executor processes request
    await executor.execute(req as any, res as any);

    expect(generateText).toHaveBeenCalledWith({
      model: expect.any(Object),
      messages: req.body.messages
    });

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
    expect(mockUsageManager.consume).toHaveBeenCalledWith(
      expect.any(String), // Provider ID (now random)
      'gpt-3.5-turbo',
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle complete streaming request flow', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    const { streamText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');

    // Setup mocks
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true as never);
    (streamText as jest.MockedFunction<typeof streamText>).mockReturnValue(mockStreamTextResult as any);
    (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockImplementation(
      () => jest.fn((modelId: string) => ({ modelId, provider: 'openai' })) as any
    );

    Router.initialize();
    UnifiedExecutor.initialize(mockUsageManager as any);
    const router = Router.getInstance();
    const executor = UnifiedExecutor.getInstance();

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
    // For streaming, expect writeHead to be called to set up SSE headers
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked'
    }));
  });

  it('should handle provider failover correctly', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    const { generateText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');

    // Setup mocks - primary provider is over limit, backup is available
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit
      .mockResolvedValueOnce(false as never) // Primary over limit
      .mockResolvedValueOnce(true as never);  // Backup available
    (generateText as jest.MockedFunction<typeof generateText>).mockResolvedValue(mockGenerateTextResult as any);
    (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockImplementation(
      () => jest.fn((modelId: string) => ({ modelId, provider: 'openai' })) as any
    );

    Router.initialize();
    UnifiedExecutor.initialize(mockUsageManager as any);
    const router = Router.getInstance();
    const executor = UnifiedExecutor.getInstance();

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
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');

    // Setup mocks
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
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
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');
    const { UnifiedExecutor } = await import('../components/UnifiedExecutor.js');
    const { generateText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');

    // Setup mocks
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true as never);
    (generateText as jest.MockedFunction<typeof generateText>).mockRejectedValue(new Error('API Error'));
    (createOpenAI as jest.MockedFunction<typeof createOpenAI>).mockImplementation(
      () => jest.fn((modelId: string) => ({ modelId, provider: 'openai' })) as any
    );

    Router.initialize();
    UnifiedExecutor.initialize(mockUsageManager as any);
    const router = Router.getInstance();
    const executor = UnifiedExecutor.getInstance();

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
