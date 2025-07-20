import { PriceData } from '../components/PriceData';
import { ProviderType } from '../../schemas/provider.schema';
import { Model } from '../../schemas/model.schema';

// Mock the logger to avoid console output during tests
jest.mock('../components/Logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PriceData', () => {
  // Reset all mocks and PriceData instance before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    (PriceData as any).instance = undefined;
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Singleton Pattern', () => {
    it('should throw error when getInstance is called before initialize', () => {
      expect(() => PriceData.getInstance()).toThrow('PriceData must be initialized before use.');
    });

    it('should return the same instance after initialization', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ metadata: { total_models: 0 }, data: [] }),
      });

      await PriceData.initialize();
      const instance1 = PriceData.getInstance();
      const instance2 = PriceData.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should warn when initialize is called multiple times', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ metadata: { total_models: 0 }, data: [] }),
      });

      await PriceData.initialize();
      await PriceData.initialize();

      const { logger } = require('../components/Logger');
      expect(logger.warn).toHaveBeenCalledWith('PriceData has already been initialized.');
    });
  });

  describe('Data Fetching', () => {
    it('should successfully fetch and process pricing data', async () => {
      const mockResponse = {
        metadata: { total_models: 2 },
        data: [
          {
            provider: 'ANTHROPIC',
            model: 'claude-2',
            operator: 'equals',
            input_cost_per_1m: 8,
            output_cost_per_1m: 24,
          },
          {
            provider: 'OPENAI',
            model: 'gpt-4',
            operator: 'equals',
            input_cost_per_1m: 30,
            output_cost_per_1m: 60,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await PriceData.initialize();
      const instance = PriceData.getInstance();

      expect(instance.isReady()).toBe(true);
      expect(instance.getProviderCount()).toBe(2);
      expect(instance.getModelCount()).toBe(2);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await PriceData.initialize();
      const instance = PriceData.getInstance();

      expect(instance.isReady()).toBe(true);
      expect(instance.getProviderCount()).toBe(0);
      expect(instance.getModelCount()).toBe(0);

      const { logger } = require('../components/Logger');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch pricing data from Helicone API')
      );
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await PriceData.initialize();
      const instance = PriceData.getInstance();

      expect(instance.isReady()).toBe(true);
      expect(instance.getProviderCount()).toBe(0);

      const { logger } = require('../components/Logger');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('HTTP 500: Internal Server Error')
      );
    });

    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); },
      });

      await PriceData.initialize();
      const instance = PriceData.getInstance();

      expect(instance.isReady()).toBe(true);
      expect(instance.getProviderCount()).toBe(0);
    });

    it('should handle timeout', async () => {
      // Mock fetch to reject with AbortError after timeout
      mockFetch.mockRejectedValueOnce(new Error('AbortError'));

      await PriceData.initialize();

      const instance = PriceData.getInstance();
      expect(instance.isReady()).toBe(true);
      expect(instance.getProviderCount()).toBe(0);

      const { logger } = require('../components/Logger');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch pricing data from Helicone API')
      );
    });
  });

  describe('Provider Mapping', () => {
    beforeEach(async () => {
      const mockResponse = {
        metadata: { total_models: 3 },
        data: [
          {
            provider: 'ANTHROPIC',
            model: 'claude-2',
            operator: 'equals',
            input_cost_per_1m: 8,
            output_cost_per_1m: 24,
          },
          {
            provider: 'UNKNOWN_PROVIDER',
            model: 'unknown-model',
            operator: 'equals',
            input_cost_per_1m: 1,
            output_cost_per_1m: 1,
          },
          {
            provider: 'X',
            model: 'grok-beta',
            operator: 'equals',
            input_cost_per_1m: 5,
            output_cost_per_1m: 15,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await PriceData.initialize();
    });

    it('should map known providers correctly', () => {
      const instance = PriceData.getInstance();
      
      // Should have mapped ANTHROPIC -> anthropic and X -> xai
      expect(instance.getProviderCount()).toBe(2);
      expect(instance.getModelCount()).toBe(2); // UNKNOWN_PROVIDER should be skipped
    });

    it('should skip unmapped providers', () => {
      const instance = PriceData.getInstance();
      
      // UNKNOWN_PROVIDER should not be included
      const pricing = instance.getPrice('openai-compatible', 'unknown-model');
      expect(pricing).toBeUndefined();
    });
  });

  describe('getPrice Method', () => {
    beforeEach(async () => {
      const mockResponse = {
        metadata: { total_models: 4 },
        data: [
          {
            provider: 'ANTHROPIC',
            model: 'claude-2',
            operator: 'equals',
            input_cost_per_1m: 8,
            output_cost_per_1m: 24,
          },
          {
            provider: 'ANTHROPIC',
            model: 'claude-3',
            operator: 'startsWith',
            input_cost_per_1m: 3,
            output_cost_per_1m: 15,
          },
          {
            provider: 'OPENAI',
            model: 'gpt-4o-mini',
            operator: 'equals',
            input_cost_per_1m: 0.15,
            output_cost_per_1m: 0.6,
            per_call: 0.001,
          },
          {
            provider: 'OPENAI',
            model: 'gpt',
            operator: 'includes',
            input_cost_per_1m: 10,
            output_cost_per_1m: 30,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await PriceData.initialize();
    });

    it('should find exact matches', () => {
      const instance = PriceData.getInstance();
      
      const pricing = instance.getPrice('anthropic', 'claude-2');
      expect(pricing).toEqual({
        inputCostPerMillionTokens: 8,
        outputCostPerMillionTokens: 24,
      });
    });

    it('should only find exact matches (no partial matching)', () => {
      const instance = PriceData.getInstance();

      // These should NOT match because we only do exact matching now
      expect(instance.getPrice('anthropic', 'claude-3-sonnet')).toBeUndefined();
      expect(instance.getPrice('openai', 'some-gpt-model')).toBeUndefined();
      expect(instance.getPrice('openai', 'gpt-4-partial')).toBeUndefined();
    });

    it('should include per-request costs when available', () => {
      const instance = PriceData.getInstance();
      
      const pricing = instance.getPrice('openai', 'gpt-4o-mini');
      expect(pricing).toEqual({
        inputCostPerMillionTokens: 0.15,
        outputCostPerMillionTokens: 0.6,
        costPerRequest: 0.001,
      });
    });

    it('should return undefined for invalid provider types', () => {
      const instance = PriceData.getInstance();
      
      const pricing = instance.getPrice('invalid-provider', 'some-model');
      expect(pricing).toBeUndefined();
    });

    it('should return undefined for unknown providers', () => {
      const instance = PriceData.getInstance();
      
      const pricing = instance.getPrice('groq', 'some-model');
      expect(pricing).toBeUndefined();
    });

    it('should return undefined for unknown models', () => {
      const instance = PriceData.getInstance();
      
      const pricing = instance.getPrice('anthropic', 'unknown-model');
      expect(pricing).toBeUndefined();
    });

    it('should return exact match only', () => {
      const instance = PriceData.getInstance();

      // Exact match should work
      const pricing = instance.getPrice('openai', 'gpt-4o-mini');
      expect(pricing).toEqual({
        inputCostPerMillionTokens: 0.15,
        outputCostPerMillionTokens: 0.6,
        costPerRequest: 0.001,
      });

      // Partial matches should not work
      expect(instance.getPrice('openai', 'gpt-4o')).toBeUndefined();
      expect(instance.getPrice('openai', 'gpt-nonexistent')).toBeUndefined();
    });
  });

  describe('getPriceWithOverride Method', () => {
    beforeEach(async () => {
      const mockResponse = {
        metadata: { total_models: 2 },
        data: [
          {
            provider: 'ANTHROPIC',
            model: 'claude-2',
            operator: 'equals',
            input_cost_per_1m: 8,
            output_cost_per_1m: 24,
          },
          {
            provider: 'OPENAI',
            model: 'gpt-4',
            operator: 'equals',
            input_cost_per_1m: 30,
            output_cost_per_1m: 60,
            per_call: 0.002,
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await PriceData.initialize();
    });

    it('should use model.pricing when explicitly defined', () => {
      const instance = PriceData.getInstance();

      const modelWithPricing: Model = {
        name: 'claude-2',
        pricing: {
          inputCostPerMillionTokens: 10,
          outputCostPerMillionTokens: 30,
          costPerRequest: 0.005,
        },
      };

      const pricing = instance.getPriceWithOverride('anthropic', modelWithPricing);

      // Should return the explicit pricing from the model, not from PriceData
      expect(pricing).toEqual({
        inputCostPerMillionTokens: 10,
        outputCostPerMillionTokens: 30,
        costPerRequest: 0.005,
      });
    });

    it('should fall back to PriceData lookup when model.pricing is undefined', () => {
      const instance = PriceData.getInstance();

      const modelWithoutPricing: Model = {
        name: 'claude-2',
        // No pricing property
      };

      const pricing = instance.getPriceWithOverride('anthropic', modelWithoutPricing);

      // Should return pricing from PriceData lookup
      expect(pricing).toEqual({
        inputCostPerMillionTokens: 8,
        outputCostPerMillionTokens: 24,
      });
    });

    it('should prefer model.pricing over PriceData even when both are available', () => {
      const instance = PriceData.getInstance();

      const modelWithPricing: Model = {
        name: 'gpt-4', // This model exists in PriceData
        pricing: {
          inputCostPerMillionTokens: 25, // Different from PriceData (30)
          outputCostPerMillionTokens: 50, // Different from PriceData (60)
        },
      };

      const pricing = instance.getPriceWithOverride('openai', modelWithPricing);

      // Should return the explicit pricing from the model, not from PriceData
      expect(pricing).toEqual({
        inputCostPerMillionTokens: 25,
        outputCostPerMillionTokens: 50,
      });
    });

    it('should return undefined when model has no pricing and PriceData has no match', () => {
      const instance = PriceData.getInstance();

      const modelWithoutPricing: Model = {
        name: 'unknown-model',
        // No pricing property
      };

      const pricing = instance.getPriceWithOverride('anthropic', modelWithoutPricing);

      // Should return undefined since neither model nor PriceData has pricing
      expect(pricing).toBeUndefined();
    });

    it('should handle partial pricing in model.pricing', () => {
      const instance = PriceData.getInstance();

      const modelWithPartialPricing: Model = {
        name: 'claude-2',
        pricing: {
          inputCostPerMillionTokens: 12,
          // Missing outputCostPerMillionTokens and costPerRequest
        },
      };

      const pricing = instance.getPriceWithOverride('anthropic', modelWithPartialPricing);

      // Should return the partial pricing from the model
      expect(pricing).toEqual({
        inputCostPerMillionTokens: 12,
      });
    });

    it('should handle invalid provider types gracefully', () => {
      const instance = PriceData.getInstance();

      const modelWithoutPricing: Model = {
        name: 'claude-2',
        // No pricing property
      };

      const pricing = instance.getPriceWithOverride('invalid-provider', modelWithoutPricing);

      // Should return undefined due to invalid provider type
      expect(pricing).toBeUndefined();
    });

    it('should return undefined when model has empty pricing object', () => {
      const instance = PriceData.getInstance();

      const modelWithEmptyPricing: Model = {
        name: 'unknown-model',
        pricing: {}, // Empty pricing object
      };

      const pricing = instance.getPriceWithOverride('anthropic', modelWithEmptyPricing);

      // Should return the empty pricing object from the model
      expect(pricing).toEqual({});
    });

    it('should distinguish between zero cost and undefined cost', () => {
      const instance = PriceData.getInstance();

      const modelWithZeroCost: Model = {
        name: 'free-model',
        pricing: {
          inputCostPerMillionTokens: 0,
          outputCostPerMillionTokens: 0,
          costPerRequest: 0,
        },
      };

      const modelWithoutPricing: Model = {
        name: 'unknown-model',
        // No pricing property
      };

      const zeroCostPricing = instance.getPriceWithOverride('anthropic', modelWithZeroCost);
      const undefinedPricing = instance.getPriceWithOverride('anthropic', modelWithoutPricing);

      // Zero cost should return the explicit zero values
      expect(zeroCostPricing).toEqual({
        inputCostPerMillionTokens: 0,
        outputCostPerMillionTokens: 0,
        costPerRequest: 0,
      });

      // No pricing should return undefined
      expect(undefinedPricing).toBeUndefined();
    });
  });
});
