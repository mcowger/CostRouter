/**
 * E2E Test Runner Script
 * Orchestrates the complete end-to-end testing process
 */

import { spawn } from 'child_process';

class E2ETestRunner {

  async run() {
    console.log('🚀 Running E2E Test Suite...\n');
    console.log('ℹ️  Expecting services to already be running:');
    console.log('   • LLM Gateway on http://localhost:3000');
    console.log('   • Mock Server on http://localhost:3001\n');

    try {
      // Step 1: Wait for services to be ready
      await this.waitForServices();

      // Step 2: Run E2E tests
      await this.runTests();

      console.log('\n✅ E2E tests completed successfully!');
    } catch (error) {
      console.error('\n❌ E2E tests failed:', error);
      console.error('\n💡 Make sure to start the test environment first:');
      console.error('   pnpm test:e2e:env');
      process.exit(1);
    }
  }



  private async waitForServices() {
    console.log('⏳ Waiting for services to be ready...');

    const maxRetries = 30;
    const retryDelay = 1000;

    // Check mock server
    let mockRetries = maxRetries;
    while (mockRetries > 0) {
      try {
        const response = await fetch('http://localhost:3001/health');
        if (response.ok) {
          console.log('✅ Mock server is ready');
          break;
        }
      } catch (error) {
        // Server not ready yet
      }

      mockRetries--;
      if (mockRetries === 0) {
        throw new Error('Mock server failed to start');
      }

      await this.sleep(retryDelay);
    }

    // Check LLM Gateway
    let gatewayRetries = maxRetries;
    while (gatewayRetries > 0) {
      try {
        const response = await fetch('http://localhost:3000/health');
        if (response.ok) {
          console.log('✅ LLM Gateway is ready');
          break;
        }
      } catch (error) {
        // Gateway not ready yet
      }

      gatewayRetries--;
      if (gatewayRetries === 0) {
        throw new Error('LLM Gateway failed to start');
      }

      await this.sleep(retryDelay);
    }

    console.log('🎉 All services are ready!\n');
  }

  private async runTests() {
    console.log('🧪 Running E2E tests...\n');

    return new Promise<void>((resolve, reject) => {
      const testProcess = spawn('jest', [
        '--config', 'jest.e2e.config.js',
        '--verbose',
        '--runInBand'
      ], {
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'test'
        }
      });

      testProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });
  }



  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run the tests
const runner = new E2ETestRunner();
runner.run().catch((error) => {
  console.error('E2E test runner failed:', error);
  process.exit(1);
});
