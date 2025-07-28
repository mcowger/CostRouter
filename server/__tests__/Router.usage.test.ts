import { Router } from '../components/Router';
import { ConfigManager } from '../components/config/ConfigManager';
import { UsageManager } from '../components/UsageManager';
import { PriceData } from '../components/PriceData';
import { Provider } from '#schemas/provider.schema';
import { Model } from '#schemas/model.schema';

// Mock the singletons
jest.mock('../components/config/ConfigManager');
jest.mock('../components/UsageManager');
jest.mock('../components/PriceData');

describe('Router.getBestProviderForModel', () => {
  let mockConfigManager: jest.Mocked<ConfigManager>;
  let mockUsageManager: jest.Mocked<UsageManager>;
  let mockPriceData: jest.Mocked<PriceData>;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    (Router as any).instance = undefined;

    // Mock getInstance for each singleton to return our mock instances
    mockConfigManager = new (ConfigManager as any)();
    (ConfigManager.getInstance as jest.Mock) = jest.fn(() => mockConfigManager);

    mockUsageManager = new (UsageManager as any)();
    (UsageManager.getInstance as jest.Mock) = jest.fn(() => mockUsageManager);

    mockPriceData = new (PriceData as any)();
    (PriceData.getInstance as jest.Mock) = jest.fn(() => mockPriceData);

    // Initialize the Router with our mocked UsageManager
    Router.initialize();
  });

  test('should return the correct provider and model when a single best option is available', async () => {
    const testModel: Model = {
      name: 'gpt-4-test',
      mappedName: 'gpt-4-test',
    };

    const testProvider: Provider = {
      id: 'test-provider',
      type: 'openai-compatible',
      baseURL: 'http://localhost:8080/v1',
      apiKey: 'test-key',
      models: [testModel],
    };

    // Configure mocks for the "happy path"
    mockConfigManager.getProviders = jest.fn().mockReturnValue([testProvider]);
    mockUsageManager.isUnderLimit = jest.fn().mockResolvedValue(true);
    mockPriceData.getPriceWithOverride = jest.fn().mockReturnValue({
      inputCostPerMillionTokens: 10,
      outputCostPerMillionTokens: 30,
    });

    const router = Router.getInstance();
    const result = await router.getBestProviderForModel('gpt-4-test');

    // Assertions
    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('model');

    if ('provider' in result) {
      expect(result.provider).toEqual(testProvider);
      expect(result.model).toEqual(testModel);
    }

    // Verify that the mocks were called as expected
    expect(mockConfigManager.getProviders).toHaveBeenCalledTimes(1);
    expect(mockUsageManager.isUnderLimit).toHaveBeenCalledWith(testProvider.id, testModel.name);
  });
  test('should return a 404 error if no provider is configured for the model', async () => {
    const unconfiguredModelName = 'unconfigured-model';

    // Configure mocks to return providers that do NOT offer the requested model
    mockConfigManager.getProviders = jest.fn().mockReturnValue([
      {
        id: 'provider-1',
        type: 'openai-compatible',
        baseURL: 'http://localhost:8080/v1',
        apiKey: 'key-1',
        models: [{ name: 'another-model', mappedName: 'another-model' }],
      },
    ]);
    mockUsageManager.isUnderLimit = jest.fn().mockResolvedValue(true);
    mockPriceData.getPriceWithOverride = jest.fn();

    const router = Router.getInstance();
    const result = await router.getBestProviderForModel(unconfiguredModelName);

    // Assertions
    expect(result).toHaveProperty('status', 404);
    expect(result).toHaveProperty('error', `No configured provider found for model: ${unconfiguredModelName}`);
    expect(mockConfigManager.getProviders).toHaveBeenCalledTimes(1);
    expect(mockUsageManager.isUnderLimit).not.toHaveBeenCalled(); // Should not be called if no providers found
  });

  test('should return a 503 error if all available providers are rate-limited', async () => {
    const rateLimitedModelName = 'rate-limited-model';
    const rateLimitedProvider: Provider = {
      id: 'rate-limited-provider',
      type: 'openai-compatible',
      baseURL: 'http://localhost:8080/v1',
      apiKey: 'rate-key',
      models: [{ name: rateLimitedModelName, mappedName: rateLimitedModelName }],
    };

    // Configure mocks: provider offers the model, but isUnderLimit always returns false
    mockConfigManager.getProviders = jest.fn().mockReturnValue([rateLimitedProvider]);
    mockUsageManager.isUnderLimit = jest.fn().mockResolvedValue(false); // All providers are rate-limited
    mockPriceData.getPriceWithOverride = jest.fn().mockReturnValue({
      inputCostPerMillionTokens: 10,
      outputCostPerMillionTokens: 30,
    });

    const router = Router.getInstance();
    const result = await router.getBestProviderForModel(rateLimitedModelName);

    // Assertions
    expect(result).toHaveProperty('status', 503);
    expect(result).toHaveProperty('error', `All providers for model '${rateLimitedModelName}' are currently at their rate limit. Please try again later.`);
    expect(mockConfigManager.getProviders).toHaveBeenCalledTimes(1);
    expect(mockUsageManager.isUnderLimit).toHaveBeenCalledWith(rateLimitedProvider.id, rateLimitedModelName);
  });
});