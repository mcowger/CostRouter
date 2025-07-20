/**
 * Performance and Load Tests for LLM Gateway
 * Tests system behavior under load and measures performance metrics
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import TestHelpers from '../utils/test-helpers.js';
import MockLLMServer from '../mock-server/mock-llm-server.js';

describe('LLM Gateway Performance Tests', () => {
  let testHelpers: TestHelpers;
  let mockServers: { [key: string]: MockLLMServer } = {};

  beforeAll(async () => {
    testHelpers = new TestHelpers();

    // Start mock servers
    mockServers.primary = new MockLLMServer(3001);
    mockServers.backup = new MockLLMServer(3002);
    mockServers.anthropic = new MockLLMServer(3003);

    await Promise.all([
      mockServers.primary.start(),
      mockServers.backup.start(),
      mockServers.anthropic.start()
    ]);

    // Wait for LLM Gateway
    await testHelpers.waitForService('http://localhost:3000/health');
  }, 60000);

  afterAll(async () => {
    await Promise.all([
      mockServers.primary?.stop(),
      mockServers.backup?.stop(),
      mockServers.anthropic?.stop()
    ]);
  });

  beforeEach(async () => {
    // Reset mock servers
    await Promise.all([
      testHelpers.resetMockServer(3001),
      testHelpers.resetMockServer(3002),
      testHelpers.resetMockServer(3003)
    ]);
  });

  describe('Response Time Tests', () => {
    it('should respond to non-streaming requests within acceptable time', async () => {
      const startTime = Date.now();
      
      const response = await testHelpers.sendNonStreamingChat(
        'gpt-4o',
        'Quick response test'
      );

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
      
      console.log(`Non-streaming response time: ${responseTime}ms`);
    });

    it('should start streaming responses quickly', async () => {
      const startTime = Date.now();
      
      const response = await testHelpers.sendStreamingChat(
        'gpt-4o',
        'Streaming response test'
      );

      const timeToFirstByte = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(timeToFirstByte).toBeLessThan(2000); // Should start streaming within 2 seconds
      
      console.log(`Time to first byte (streaming): ${timeToFirstByte}ms`);
    });
  });

  describe('Concurrent Request Tests', () => {
    it('should handle 10 concurrent non-streaming requests', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const requests = Array(concurrentRequests).fill(0).map((_, index) =>
        testHelpers.sendNonStreamingChat(
          'gpt-4o',
          `Concurrent test ${index}`
        )
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.choices[0].message.content).toContain(`Concurrent test ${index}`);
      });

      const averageResponseTime = totalTime / concurrentRequests;
      console.log(`${concurrentRequests} concurrent requests completed in ${totalTime}ms`);
      console.log(`Average response time: ${averageResponseTime}ms`);

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(15000); // All requests within 15 seconds
    });

    it('should handle 5 concurrent streaming requests', async () => {
      const concurrentRequests = 5;
      const startTime = Date.now();

      const requests = Array(concurrentRequests).fill(0).map((_, index) =>
        testHelpers.sendStreamingChat(
          'gpt-4o',
          `Streaming concurrent test ${index}`
        )
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/plain');
        
        const parsed = testHelpers.parseStreamingResponse(response.text);
        expect(parsed.isDone).toBe(true);
        expect(parsed.fullContent).toContain(`Streaming concurrent test ${index}`);
      });

      console.log(`${concurrentRequests} concurrent streaming requests completed in ${totalTime}ms`);
      expect(totalTime).toBeLessThan(20000); // All streaming requests within 20 seconds
    });

    it('should handle mixed streaming and non-streaming requests', async () => {
      const totalRequests = 8;
      const startTime = Date.now();

      const requests = Array(totalRequests).fill(0).map((_, index) => {
        const isStreaming = index % 2 === 0;
        return isStreaming
          ? testHelpers.sendStreamingChat('gpt-4o', `Mixed test ${index} streaming`)
          : testHelpers.sendNonStreamingChat('gpt-4o', `Mixed test ${index} non-streaming`);
      });

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        
        const isStreaming = index % 2 === 0;
        if (isStreaming) {
          expect(response.headers['content-type']).toContain('text/plain');
          const parsed = testHelpers.parseStreamingResponse(response.text);
          expect(parsed.fullContent).toContain(`Mixed test ${index} streaming`);
        } else {
          expect(response.body.choices[0].message.content).toContain(`Mixed test ${index} non-streaming`);
        }
      });

      console.log(`${totalRequests} mixed requests completed in ${totalTime}ms`);
      expect(totalTime).toBeLessThan(25000);
    });
  });

  describe('Load Testing', () => {
    it('should handle burst of requests without errors', async () => {
      const burstSize = 20;
      const batchSize = 5;
      const delayBetweenBatches = 100; // ms

      let successCount = 0;
      let errorCount = 0;

      for (let batch = 0; batch < burstSize / batchSize; batch++) {
        const batchRequests = Array(batchSize).fill(0).map((_, index) =>
          testHelpers.sendNonStreamingChat(
            'gpt-4o',
            `Burst test batch ${batch} request ${index}`
          ).then(response => {
            if (response.status === 200) {
              successCount++;
            } else {
              errorCount++;
            }
            return response;
          }).catch(error => {
            errorCount++;
            throw error;
          })
        );

        await Promise.allSettled(batchRequests);
        
        if (batch < (burstSize / batchSize) - 1) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }
      }

      console.log(`Burst test results: ${successCount} success, ${errorCount} errors`);
      
      // Should handle most requests successfully
      expect(successCount).toBeGreaterThan(burstSize * 0.8); // At least 80% success rate
      expect(errorCount).toBeLessThan(burstSize * 0.2); // Less than 20% errors
    });

    it('should maintain performance under sustained load', async () => {
      const duration = 10000; // 10 seconds
      const requestInterval = 500; // Request every 500ms
      const startTime = Date.now();
      
      const results: { time: number; success: boolean; responseTime: number }[] = [];

      while (Date.now() - startTime < duration) {
        const requestStart = Date.now();
        
        try {
          const response = await testHelpers.sendNonStreamingChat(
            'gpt-4o',
            `Sustained load test at ${Date.now()}`
          );
          
          const responseTime = Date.now() - requestStart;
          results.push({
            time: Date.now() - startTime,
            success: response.status === 200,
            responseTime
          });
        } catch (error) {
          const responseTime = Date.now() - requestStart;
          results.push({
            time: Date.now() - startTime,
            success: false,
            responseTime
          });
        }

        // Wait for next request
        const elapsed = Date.now() - requestStart;
        const waitTime = Math.max(0, requestInterval - elapsed);
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      const successRate = results.filter(r => r.success).length / results.length;
      const averageResponseTime = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.responseTime, 0) / results.filter(r => r.success).length;

      console.log(`Sustained load test results:`);
      console.log(`  Total requests: ${results.length}`);
      console.log(`  Success rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(`  Average response time: ${averageResponseTime.toFixed(0)}ms`);

      // Should maintain good performance under sustained load
      expect(successRate).toBeGreaterThan(0.9); // 90% success rate
      expect(averageResponseTime).toBeLessThan(3000); // Average response time under 3 seconds
    });
  });

  describe('Resource Usage Tests', () => {
    it('should handle large request payloads efficiently', async () => {
      const largeMessage = 'This is a very long message. '.repeat(100); // ~3000 characters
      
      const startTime = Date.now();
      const response = await testHelpers.sendNonStreamingChat('gpt-4o', largeMessage);
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.usage.prompt_tokens).toBeGreaterThan(500); // Should have many tokens
      expect(responseTime).toBeLessThan(10000); // Should handle large payloads within 10 seconds

      console.log(`Large payload response time: ${responseTime}ms`);
      console.log(`Prompt tokens: ${response.body.usage.prompt_tokens}`);
    });

    it('should handle requests with many messages efficiently', async () => {
      const messages = testHelpers.generateTestMessages(20); // 20 messages
      
      const startTime = Date.now();
      const response = await testHelpers.sendChatCompletion({
        model: 'gpt-4o',
        messages,
        stream: false
      });
      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.usage.prompt_tokens).toBeGreaterThan(100);
      expect(responseTime).toBeLessThan(8000);

      console.log(`Many messages response time: ${responseTime}ms`);
      console.log(`Total messages: ${messages.length}`);
    });
  });
});
