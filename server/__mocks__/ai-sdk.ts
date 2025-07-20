/**
 * Mock utilities for AI SDK components
 * Provides mock implementations for generateText, streamText, and provider factories
 */

import { jest } from '@jest/globals';
import { simulateReadableStream } from '@ai-sdk/core';

// Mock usage data for testing
export const mockUsage = {
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  inputTokens: 100,
  outputTokens: 50
};

// Mock response for non-streaming requests
export const mockGenerateTextResult = {
  text: 'This is a mock response from the AI model.',
  usage: mockUsage,
  finishReason: 'stop',
  response: {
    id: 'mock-response-id',
    timestamp: new Date(),
    modelId: 'mock-model'
  }
};

// Mock response for streaming requests
export const mockStreamTextResult = {
  textStream: simulateReadableStream({
    initialDelayInMs: 0,
    chunkDelayInMs: 10,
    chunks: [
      { type: 'text-delta', textDelta: 'This ' },
      { type: 'text-delta', textDelta: 'is ' },
      { type: 'text-delta', textDelta: 'a ' },
      { type: 'text-delta', textDelta: 'mock ' },
      { type: 'text-delta', textDelta: 'streaming ' },
      { type: 'text-delta', textDelta: 'response.' },
      { type: 'finish', finishReason: 'stop', usage: mockUsage }
    ]
  }),
  usage: Promise.resolve(mockUsage),
  finishReason: Promise.resolve('stop'),
  pipeTextStreamToResponse: jest.fn((res: any) => {
    // Mock the streaming response
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked'
    });
    
    // Simulate streaming chunks
    const chunks = ['This ', 'is ', 'a ', 'mock ', 'streaming ', 'response.'];
    chunks.forEach((chunk, index) => {
      setTimeout(() => {
        res.write(chunk);
        if (index === chunks.length - 1) {
          res.end();
        }
      }, index * 10);
    });
  })
};

// Mock AI SDK functions
export const mockGenerateText = jest.fn().mockResolvedValue(mockGenerateTextResult);
export const mockStreamText = jest.fn().mockReturnValue(mockStreamTextResult);

// Mock provider factory functions
export const mockCreateOpenAI = jest.fn().mockReturnValue((modelName: string) => ({
  modelId: modelName,
  provider: 'openai'
}));

export const mockCreateAnthropic = jest.fn().mockReturnValue((modelName: string) => ({
  modelId: modelName,
  provider: 'anthropic'
}));

export const mockCreateGoogle = jest.fn().mockReturnValue((modelName: string) => ({
  modelId: modelName,
  provider: 'google'
}));

export const mockCreateOpenAICompatible = jest.fn().mockReturnValue((modelName: string) => ({
  modelId: modelName,
  provider: 'openai-compatible'
}));

// Helper function to reset all mocks
export const resetAIMocks = () => {
  mockGenerateText.mockClear();
  mockStreamText.mockClear();
  mockCreateOpenAI.mockClear();
  mockCreateAnthropic.mockClear();
  mockCreateGoogle.mockClear();
  mockCreateOpenAICompatible.mockClear();
};

// Helper function to make generateText throw an error
export const makeGenerateTextFail = (error: Error) => {
  mockGenerateText.mockRejectedValueOnce(error);
};

// Helper function to make streamText throw an error
export const makeStreamTextFail = (error: Error) => {
  mockStreamText.mockImplementationOnce(() => {
    throw error;
  });
};
