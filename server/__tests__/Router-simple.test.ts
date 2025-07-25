/**
 * Simplified Unit tests for Router
 * Tests provider selection logic and request routing
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies before importing
jest.mock('../components/ConfigManager.js', () => ({
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
    isUnderLimit: jest.fn(),
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset router singleton
    const Router = require('../components/Router.js').Router;
    (Router as any).instance = null;
  });

  it('should initialize router correctly', async () => {
    const { ConfigManager } = await import('../components/ConfigManager.js');
    const { UsageManager } = await import('../components/UsageManager.js');
    const { Router } = await import('../components/Router.js');

    // Setup mocks
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      getProviders: jest.fn().mockReturnValue(mockProviders),
    });
    (UsageManager.getInstance as jest.MockedFunction<any>).mockReturnValue(mockUsageManager);

    // Initialize router
    Router.initialize();
    const router = Router.getInstance();

    expect(router).toBeDefined();
    expect(typeof router.chooseProvider).toBe('function');
  });

  it('should select an available provider for requested model', async () => {
    const { ConfigManager } = await import('../components/ConfigManager.js');
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
    const { ConfigManager } = await import('../components/ConfigManager.js');
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
    const { ConfigManager } = await import('../components/ConfigManager.js');
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
    const { ConfigManager } = await import('../components/ConfigManager.js');
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
    const { ConfigManager } = await import('../components/ConfigManager.js');
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
    const { ConfigManager } = await import('../components/ConfigManager.js');
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
    const { ConfigManager } = await import('../components/ConfigManager.js');
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

  it('should throw error when getInstance called before initialize', async () => {
    const { Router } = await import('../components/Router.js');

    expect(() => Router.getInstance()).toThrow('Router must be initialized before use.');
  });
});
