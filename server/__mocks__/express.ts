/**
 * Mock utilities for Express Request and Response objects
 */

import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';

// Mock Request object
export const createMockRequest = (overrides: Partial<Request> = {}): Partial<Request> => ({
  body: {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Hello, how are you?' }
    ],
    stream: false,
    ...overrides.body
  },
  headers: {
    'content-type': 'application/json',
    'authorization': 'Bearer test-api-key',
    ...overrides.headers
  },
  method: 'POST',
  url: '/v1/chat/completions',
  ...overrides
});

// Mock Response object
export const createMockResponse = (overrides: Partial<Response> = {}): Partial<Response> => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    write: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    writeHead: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    locals: {
      chosenProvider: null,
      chosenModel: null,
      ...overrides.locals
    },
    ...overrides
  };
  
  return res as Partial<Response>;
};

// Mock NextFunction
export const createMockNext = (): NextFunction => jest.fn();

// Helper to create a complete mock request with streaming
export const createStreamingRequest = (overrides: Partial<Request> = {}): Partial<Request> => 
  createMockRequest({
    body: {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, how are you?' }],
      stream: true,
      ...overrides.body
    },
    ...overrides
  });

// Helper to create a mock request with specific model
export const createRequestWithModel = (model: string, overrides: Partial<Request> = {}): Partial<Request> =>
  createMockRequest({
    body: {
      model,
      messages: [{ role: 'user', content: 'Test message' }],
      ...overrides.body
    },
    ...overrides
  });

// Helper to create response with chosen provider and model
export const createResponseWithProvider = (
  providerId: string, 
  modelName: string, 
  overrides: Partial<Response> = {}
): Partial<Response> => 
  createMockResponse({
    locals: {
      chosenProvider: {
        id: providerId,
        type: 'openai',
        apiKey: 'test-key',
        models: [{ name: modelName, mappedName: modelName }]
      },
      chosenModel: {
        name: modelName,
        mappedName: modelName
      },
      ...overrides.locals
    },
    ...overrides
  });
