/**
 * Simplified Unit tests for Router
 * Tests provider selection logic and request routing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies before importing
jest.mock('../components/config/ConfigManager.js', () => ({
  ConfigManager: {
    getInstance: jest.fn().mockReturnValue({
      getProviders: jest.fn(),
    }),
  },
}));

jest.mock('../components/UsageManager.js', () => ({
  UsageManager: {
    getInstance: jest.fn(),
    initialize: jest.fn()
  }
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

jest.mock('../components/Logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Router - Basic Tests', () => {
  // Mock providers configuration
  const mockProviders = [
    {
      id: 'openai-provider',
      type: 'openai',
      apiKey: 'test-openai-key',
      models: [
        { name: 'gpt-3.5-turbo', mappedName: 'gpt-3.5-turbo' },
        { name: 'gpt-4', mappedName: 'gpt-4' }
      ]
    },
    {
      id: 'anthropic-provider',
      type: 'anthropic',
      apiKey: 'test-anthropic-key',
      models: [
        { name: 'claude-3-sonnet', mappedName: 'claude-3-sonnet' },
        { name: 'claude-3-haiku', mappedName: 'claude-3-haiku' }
      ]
    },
    {
      id: 'backup-openai',
      type: 'openai',
      apiKey: 'test-backup-key',
      models: [
        { name: 'gpt-3.5-turbo', mappedName: 'gpt-3.5-turbo' }
      ]
    }
  ];

  // Mock UsageManager instance
  const mockUsageManager = {
    isUnderLimit: jest.fn<(providerId: string, modelName: string) => Promise<boolean>>(),
    consume: jest.fn(),
    getCurrentUsage: jest.fn()
  };

  // Mock Express objects
  const createMockRequest = (overrides: any = {}) => ({
    body: {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { PriceData } = await import('../components/PriceData.js');

    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    (PriceData.getInstance as jest.MockedFunction<any>).mockReturnValue({
      getPriceWithOverride: jest.fn().mockReturnValue({
        inputCostPerMillionTokens: 1,
        outputCostPerMillionTokens: 2,
      }),
    });

    UsageManager.initialize();
    PriceData.initialize();
    // Router is initialized in each test where it's needed.
  });

  afterEach(() => {
    // Reset router singleton
    const Router = require('../components/Router.js').Router;
    (Router as any).instance = null;
  });

  // Re-added for explicit test coverage, but setup is now in beforeEach
  it('should initialize router correctly via getInstance', async () => {
    const { Router } = await import('../components/Router.js');
    Router.initialize(); // Explicitly initialize for this test
    const router = Router.getInstance();
    expect(router).toBeDefined();
    expect(typeof router.chooseProvider).toBe('function');
  });

  it('should select an available provider for requested model', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');

    // Setup mocks
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: { model: 'gpt-3.5-turbo', messages: [] }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    // Router now uses random selection, so we should check that a valid provider was selected
    // that supports the requested model
    expect(res.locals.chosenProvider).toBeDefined();
    expect(res.locals.chosenModel).toBeDefined();
    expect(res.locals.chosenProvider.type).toBe('openai'); // Both providers that support gpt-3.5-turbo are openai type
    expect(res.locals.chosenModel.name).toBe('gpt-3.5-turbo');
    expect(next).toHaveBeenCalled();
  });

  it('should skip providers that are over limit and select next available', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');

    // Setup mocks
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);

    // First provider is over limit, third is available
    mockUsageManager.isUnderLimit
      .mockResolvedValueOnce(false) // openai-provider over limit
      .mockResolvedValueOnce(true);  // backup-openai available

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: { model: 'gpt-3.5-turbo', messages: [] }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    expect(res.locals.chosenProvider).toEqual(mockProviders[2]); // backup-openai
    expect(res.locals.chosenModel).toEqual(mockProviders[2].models[0]);
    expect(next).toHaveBeenCalled();
  });

  it('should return 404 when no provider supports the requested model', async () => {
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
      body: { model: 'unsupported-model', messages: [] }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No configured provider found for model: unsupported-model'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 503 when all providers for model are over limit', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');

    // Setup mocks
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(false);

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: { model: 'gpt-3.5-turbo', messages: [] }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "All providers for model 'gpt-3.5-turbo' are currently at their rate limit. Please try again later."
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should handle mapped model names correctly', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');

    // Provider with mapped model names
    const providersWithMapping = [
      {
        id: 'custom-provider',
        type: 'openai-compatible',
        apiKey: 'test-key',
        baseURL: 'https://api.custom.com',
        models: [
          { name: 'custom-gpt-3.5', mappedName: 'gpt-3.5-turbo' }
        ]
      }
    ];

    // Setup mocks
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(providersWithMapping),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: { model: 'gpt-3.5-turbo', messages: [] }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    expect(res.locals.chosenProvider).toEqual(providersWithMapping[0]);
    expect(res.locals.chosenModel).toEqual(providersWithMapping[0].models[0]);
    expect(next).toHaveBeenCalled();
  });

  it('should use real model name for rate limiting checks', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');

    const providersWithMapping = [
      {
        id: 'custom-provider',
        type: 'openai-compatible',
        apiKey: 'test-key',
        models: [
          { name: 'real-model-name', mappedName: 'gpt-3.5-turbo' }
        ]
      }
    ];

    // Setup mocks
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(providersWithMapping),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: { model: 'gpt-3.5-turbo', messages: [] }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    expect(mockUsageManager.isUnderLimit).toHaveBeenCalledWith(
      'custom-provider',
      'real-model-name' // Should use real name, not mapped name
    );
  });

  it('should handle missing model in request body', async () => {
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
      body: { messages: [] } // No model specified
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No configured provider found for model: undefined'
    });
  });

  it('should select the lowest input cost provider among available paid providers', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { PriceData } = await import('../components/PriceData.js');
    const { Router } = await import('../components/Router.js');

    const lowestCostProvider = {
      id: 'low-cost-provider',
      type: 'openai',
      apiKey: 'test-low-cost-key',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const midCostProvider = {
      id: 'mid-cost-provider',
      type: 'anthropic',
      apiKey: 'test-mid-cost-key',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const highCostProvider = {
      id: 'high-cost-provider',
      type: 'google',
      apiKey: 'test-high-cost-key',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const mockCostProviders = [
      highCostProvider,
      lowestCostProvider,
      midCostProvider,
    ];

    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockCostProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);

    (PriceData.getInstance as jest.MockedFunction<any>).mockReturnValue({
      getPriceWithOverride: jest.fn((provider: any, model: any) => { // Cast provider and model to any
        if (provider.id === 'low-cost-provider') {
          return { inputCostPerMillionTokens: 0.001, outputCostPerMillionTokens: 0.002 };
        } else if (provider.id === 'mid-cost-provider') {
          return { inputCostPerMillionTokens: 0.005, outputCostPerMillionTokens: 0.010 };
        } else if (provider.id === 'high-cost-provider') {
          return { inputCostPerMillionTokens: 0.010, outputCostPerMillionTokens: 0.020 };
        }
        return { inputCostPerMillionTokens: 1, outputCostPerMillionTokens: 2 };
      }),
    });

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: { model: 'gpt-4', messages: [] }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    expect(res.locals.chosenProvider).toBe(lowestCostProvider);
    expect(res.locals.chosenModel).toEqual(lowestCostProvider.models[0]);
    expect(next).toHaveBeenCalled();
  });
  it('should select the lowest output cost provider when input costs are equal', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { PriceData } = await import('../components/PriceData.js');
    const { Router } = await import('../components/Router.js');

    const equalInputLowestOutput = {
      id: 'equal-input-lowest-output',
      type: 'openai',
      apiKey: 'test-key-1',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const equalInputMidOutput = {
      id: 'equal-input-mid-output',
      type: 'anthropic',
      apiKey: 'test-key-2',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const equalInputHighOutput = {
      id: 'equal-input-high-output',
      type: 'google',
      apiKey: 'test-key-3',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const mockCostProviders = [
      equalInputHighOutput,
      equalInputLowestOutput,
      equalInputMidOutput,
    ];

    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockCostProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);

    (PriceData.getInstance as jest.MockedFunction<any>).mockReturnValue({
      getPriceWithOverride: jest.fn((provider: any, model: any) => {
        if (provider.id === 'equal-input-lowest-output') {
          return { inputCostPerMillionTokens: 0.001, outputCostPerMillionTokens: 0.002 };
        } else if (provider.id === 'equal-input-mid-output') {
          return { inputCostPerMillionTokens: 0.001, outputCostPerMillionTokens: 0.005 };
        } else if (provider.id === 'equal-input-high-output') {
          return { inputCostPerMillionTokens: 0.001, outputCostPerMillionTokens: 0.010 };
        }
        return { inputCostPerMillionTokens: 1, outputCostPerMillionTokens: 2 };
      }),
    });

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: { model: 'gpt-4', messages: [] }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    expect(res.locals.chosenProvider).toBe(equalInputLowestOutput);
    expect(res.locals.chosenModel).toEqual(equalInputLowestOutput.models[0]);
    expect(next).toHaveBeenCalled();
  });
  it('should maintain original order for stable sort tie-breaking when costs are identical', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { PriceData } = await import('../components/PriceData.js');
    const { Router } = await import('../components/Router.js');

    const identicalCostProviderA = {
      id: 'identical-cost-a',
      type: 'openai',
      apiKey: 'test-key-a',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const identicalCostProviderB = {
      id: 'identical-cost-b',
      type: 'anthropic',
      apiKey: 'test-key-b',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const identicalCostProviderC = {
      id: 'identical-cost-c',
      type: 'google',
      apiKey: 'test-key-c',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    // The order here is important for the test
    const mockCostProviders = [
      identicalCostProviderA,
      identicalCostProviderB,
      identicalCostProviderC,
    ];

    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockCostProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);

    // Mock prices to be identical for all providers
    (PriceData.getInstance as jest.MockedFunction<any>).mockReturnValue({
      getPriceWithOverride: jest.fn(() => ({
        inputCostPerMillionTokens: 0.005,
        outputCostPerMillionTokens: 0.010,
      })),
    });

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: { model: 'gpt-4', messages: [] }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    // With a stable sort, the first provider in the original list should be chosen
    expect(res.locals.chosenProvider).toBe(identicalCostProviderA);
    expect(res.locals.chosenModel).toEqual(identicalCostProviderA.models[0]);
    expect(next).toHaveBeenCalled();
  });

  it('should correctly handle providers with undefined costs, sorting them last', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { PriceData } = await import('../components/PriceData.js');
    const { Router } = await import('../components/Router.js');

    const definedCostProvider = {
      id: 'defined-cost-provider',
      type: 'openai',
      apiKey: 'test-key-1',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const undefinedInputProvider = {
      id: 'undefined-input-provider',
      type: 'anthropic',
      apiKey: 'test-key-2',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const undefinedOutputProvider = {
      id: 'undefined-output-provider',
      type: 'google',
      apiKey: 'test-key-3',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const mockCostProviders = [
      undefinedInputProvider,
      definedCostProvider,
      undefinedOutputProvider,
    ];

    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockCostProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);

    (PriceData.getInstance as jest.MockedFunction<any>).mockReturnValue({
      getPriceWithOverride: jest.fn((provider: any, model: any) => {
        if (provider.id === 'defined-cost-provider') {
          return { inputCostPerMillionTokens: 10, outputCostPerMillionTokens: 20 };
        } else if (provider.id === 'undefined-input-provider') {
          return { inputCostPerMillionTokens: undefined, outputCostPerMillionTokens: 5 };
        } else if (provider.id === 'undefined-output-provider') {
          return { inputCostPerMillionTokens: 5, outputCostPerMillionTokens: undefined };
        }
        return { inputCostPerMillionTokens: undefined, outputCostPerMillionTokens: undefined };
      }),
    });

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: { model: 'gpt-4', messages: [] }
    });
    const res = createMockResponse();
    const next = createMockNext();

    await router.chooseProvider(req as any, res as any, next);

    expect(res.locals.chosenProvider).toBe(definedCostProvider);
    expect(res.locals.chosenModel).toEqual(definedCostProvider.models[0]);
    expect(next).toHaveBeenCalled();
  });

  it('should throw error when getInstance called before initialize', async () => {
    const { Router } = await import('../components/Router.js');

    expect(() => Router.getInstance()).toThrow('Router must be initialized before use.');
  });
  it('should prioritize zero-cost providers randomly, even if cheaper paid options exist', async () => {
    const { ConfigManager } = await import('../components/config/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { PriceData } = await import('../components/PriceData.js');
    const { Router } = await import('../components/Router.js');

    const zeroCostProvider1 = {
      id: 'zero-cost-1',
      type: 'openai',
      apiKey: 'test-key-zero-1',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };
    const zeroCostProvider2 = {
      id: 'zero-cost-2',
      type: 'anthropic',
      apiKey: 'test-key-zero-2',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };
    const cheapPaidProvider = {
      id: 'cheap-paid',
      type: 'google',
      apiKey: 'test-key-cheap',
      models: [{ name: 'gpt-4', mappedName: 'gpt-4' }]
    };

    const mockZeroCostProviders = [
      cheapPaidProvider,
      zeroCostProvider1,
      zeroCostProvider2,
    ];

    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockZeroCostProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
    mockUsageManager.isUnderLimit.mockResolvedValue(true);

    (PriceData.getInstance as jest.MockedFunction<any>).mockReturnValue({
      getPriceWithOverride: jest.fn((provider: any, model: any) => {
        if (provider.id === 'zero-cost-1' || provider.id === 'zero-cost-2') {
          return { inputCostPerMillionTokens: 0, outputCostPerMillionTokens: 0 };
        }
        if (provider.id === 'cheap-paid') {
          return { inputCostPerMillionTokens: 0.001, outputCostPerMillionTokens: 0.002 };
        }
        return { inputCostPerMillionTokens: 1, outputCostPerMillionTokens: 2 };
      }),
    });

    Router.initialize();
    const router = Router.getInstance();

    const req = createMockRequest({
      body: { model: 'gpt-4', messages: [] }
    });
    const next = createMockNext();

    // Run multiple times to ensure the choice is consistent
    for (let i = 0; i < 20; i++) {
      const res = createMockResponse();
      await router.chooseProvider(req as any, res as any, next);

      expect(res.locals.chosenProvider).toBeDefined();
      const chosenId = res.locals.chosenProvider.id;
      // Should correctly prioritize zero-cost providers over paid options
      expect(['zero-cost-1', 'zero-cost-2']).toContain(chosenId);
    }
    expect(next).toHaveBeenCalledTimes(20);
  });

  describe('Helper Functions', () => {
    let router: any;

    beforeEach(async () => {
      const { ConfigManager } = await import('../components/config/ConfigManager.js');
      const { UsageManager } = await import('../components/UsageManager.js');
      const { PriceData } = await import('../components/PriceData.js');
      const { Router } = await import('../components/Router.js');

      (ConfigManager.getInstance as jest.Mock).mockReturnValue({
        getProviders: jest.fn().mockReturnValue(mockProviders),
      });
      (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);
      (PriceData.getInstance as jest.MockedFunction<any>).mockReturnValue({
        getPriceWithOverride: jest.fn().mockReturnValue({
          inputCostPerMillionTokens: 1,
          outputCostPerMillionTokens: 2,
        }),
      });

      Router.initialize();
      router = Router.getInstance();
    });

    describe('filterAvailableCandidates', () => {
      it('should filter out providers that are over rate limit', async () => {
        const candidates = [
          { provider: mockProviders[0], model: mockProviders[0].models[0] },
          { provider: mockProviders[1], model: mockProviders[1].models[0] },
        ];

        mockUsageManager.isUnderLimit
          .mockResolvedValueOnce(false) // First provider over limit
          .mockResolvedValueOnce(true);  // Second provider available

        const result = await router.filterAvailableCandidates(candidates, 'test-model');

        expect(result).toHaveLength(1);
        expect(result[0].provider).toBe(mockProviders[1]);
        expect(mockUsageManager.isUnderLimit).toHaveBeenCalledTimes(2);
      });

      it('should return all candidates when all are under limit', async () => {
        const candidates = [
          { provider: mockProviders[0], model: mockProviders[0].models[0] },
          { provider: mockProviders[1], model: mockProviders[1].models[0] },
        ];

        mockUsageManager.isUnderLimit.mockResolvedValue(true);

        const result = await router.filterAvailableCandidates(candidates, 'test-model');

        expect(result).toHaveLength(2);
        expect(result).toEqual(candidates);
      });

      it('should return empty array when all providers are over limit', async () => {
        const candidates = [
          { provider: mockProviders[0], model: mockProviders[0].models[0] },
          { provider: mockProviders[1], model: mockProviders[1].models[0] },
        ];

        mockUsageManager.isUnderLimit.mockResolvedValue(false);

        const result = await router.filterAvailableCandidates(candidates, 'test-model');

        expect(result).toHaveLength(0);
      });
    });

    describe('partitionCandidatesByCost', () => {
      beforeEach(() => {
        // Mock isZeroCost method on router instance
        router.isZeroCost = jest.fn();
      });

      it('should partition candidates into zero-cost and paid', () => {
        const candidates = [
          { provider: mockProviders[0], model: mockProviders[0].models[0] },
          { provider: mockProviders[1], model: mockProviders[1].models[0] },
          { provider: mockProviders[2], model: mockProviders[2].models[0] },
        ];

        router.isZeroCost
          .mockReturnValueOnce(true)   // First provider is zero-cost
          .mockReturnValueOnce(false)  // Second provider is paid
          .mockReturnValueOnce(true);  // Third provider is zero-cost

        const result = router.partitionCandidatesByCost(candidates);

        expect(result.zeroCost).toHaveLength(2);
        expect(result.paid).toHaveLength(1);
        expect(result.zeroCost).toEqual([candidates[0], candidates[2]]);
        expect(result.paid).toEqual([candidates[1]]);
      });

      it('should handle all zero-cost providers', () => {
        const candidates = [
          { provider: mockProviders[0], model: mockProviders[0].models[0] },
          { provider: mockProviders[1], model: mockProviders[1].models[0] },
        ];

        router.isZeroCost.mockReturnValue(true);

        const result = router.partitionCandidatesByCost(candidates);

        expect(result.zeroCost).toHaveLength(2);
        expect(result.paid).toHaveLength(0);
      });

      it('should handle all paid providers', () => {
        const candidates = [
          { provider: mockProviders[0], model: mockProviders[0].models[0] },
          { provider: mockProviders[1], model: mockProviders[1].models[0] },
        ];

        router.isZeroCost.mockReturnValue(false);

        const result = router.partitionCandidatesByCost(candidates);

        expect(result.zeroCost).toHaveLength(0);
        expect(result.paid).toHaveLength(2);
      });
    });

    describe('selectBestCandidate', () => {
      beforeEach(() => {
        router.randomSelect = jest.fn();
        router.selectBestPaidProvider = jest.fn();
      });

      it('should select from zero-cost providers when available', () => {
        const zeroCostCandidates = [
          { provider: mockProviders[0], model: mockProviders[0].models[0] },
          { provider: mockProviders[1], model: mockProviders[1].models[0] },
        ];
        const paidCandidates = [
          { provider: mockProviders[2], model: mockProviders[2].models[0] },
        ];

        const expectedSelection = zeroCostCandidates[0];
        router.randomSelect.mockReturnValue(expectedSelection);

        const result = router.selectBestCandidate(zeroCostCandidates, paidCandidates);

        expect(router.randomSelect).toHaveBeenCalledWith(zeroCostCandidates);
        expect(router.selectBestPaidProvider).not.toHaveBeenCalled();
        expect(result).toBe(expectedSelection);
      });

      it('should select from paid providers when no zero-cost available', () => {
        const zeroCostCandidates: any[] = [];
        const paidCandidates = [
          { provider: mockProviders[0], model: mockProviders[0].models[0] },
          { provider: mockProviders[1], model: mockProviders[1].models[0] },
        ];

        const expectedSelection = paidCandidates[0];
        router.selectBestPaidProvider.mockReturnValue(expectedSelection);

        const result = router.selectBestCandidate(zeroCostCandidates, paidCandidates);

        expect(router.randomSelect).not.toHaveBeenCalled();
        expect(router.selectBestPaidProvider).toHaveBeenCalledWith(paidCandidates);
        expect(result).toBe(expectedSelection);
      });

      it('should return undefined when no candidates available', () => {
        const zeroCostCandidates: any[] = [];
        const paidCandidates: any[] = [];

        const result = router.selectBestCandidate(zeroCostCandidates, paidCandidates);

        expect(router.randomSelect).not.toHaveBeenCalled();
        expect(router.selectBestPaidProvider).not.toHaveBeenCalled();
        expect(result).toBeUndefined();
      });
    });
  });
});
