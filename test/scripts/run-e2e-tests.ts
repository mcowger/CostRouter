/**
 * E2E Test Runner Script
 * Orchestrates the complete end-to-end testing process
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

interface ProcessInfo {
  name: string;
  process: ChildProcess;
  port?: number;
}

class E2ETestRunner {
  private processes: ProcessInfo[] = [];
  private testDbPath = path.join(process.cwd(), 'usage.test.db.json');

  async run() {
    console.log('🚀 Starting E2E Test Suite...\n');

    try {
      // Step 1: Clean up any existing test data
      await this.cleanup();

      // Step 2: Start mock servers
      await this.startMockServers();

      // Step 3: Start LLM Gateway
      await this.startLLMGateway();

      // Step 4: Wait for services to be ready
      await this.waitForServices();

      // Step 5: Run E2E tests
      await this.runTests();

      console.log('\n✅ E2E tests completed successfully!');
    } catch (error) {
      console.error('\n❌ E2E tests failed:', error);
      process.exit(1);
    } finally {
      // Step 6: Cleanup
      await this.stopAllProcesses();
      await this.cleanup();
    }
  }

  private async cleanup() {
    console.log('🧹 Cleaning up test data...');
    
    try {
      await fs.unlink(this.testDbPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
  }

  private async startMockServers() {
    console.log('🎭 Starting mock servers...');

    const mockServerPorts = [3001, 3002, 3003];
    
    for (const port of mockServerPorts) {
      const process = spawn('tsx', ['test/mock-server/start-mock-server.ts'], {
        env: { ...process.env, MOCK_SERVER_PORT: port.toString() },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.processes.push({
        name: `Mock Server (${port})`,
        process,
        port
      });

      // Log output for debugging
      process.stdout?.on('data', (data) => {
        console.log(`[Mock ${port}] ${data.toString().trim()}`);
      });

      process.stderr?.on('data', (data) => {
        console.error(`[Mock ${port} Error] ${data.toString().trim()}`);
      });

      process.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Mock server on port ${port} exited with code ${code}`);
        }
      });
    }

    // Wait a bit for servers to start
    await this.sleep(2000);
  }

  private async startLLMGateway() {
    console.log('🌉 Starting LLM Gateway...');

    const gatewayProcess = spawn('tsx', ['server/index.ts'], {
      env: {
        ...process.env,
        NODE_ENV: 'test'
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
      // Pass config and db path as command line arguments
      args: [
        'server/index.ts',
        '--config', path.join(process.cwd(), 'config.test.jsonc'),
        '--usage-db-path', this.testDbPath
      ]
    });

    this.processes.push({
      name: 'LLM Gateway',
      process: gatewayProcess,
      port: 3000
    });

    // Log output for debugging
    gatewayProcess.stdout?.on('data', (data) => {
      console.log(`[Gateway] ${data.toString().trim()}`);
    });

    gatewayProcess.stderr?.on('data', (data) => {
      console.error(`[Gateway Error] ${data.toString().trim()}`);
    });

    gatewayProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`LLM Gateway exited with code ${code}`);
      }
    });

    // Wait for gateway to start
    await this.sleep(3000);
  }

  private async waitForServices() {
    console.log('⏳ Waiting for services to be ready...');

    const maxRetries = 30;
    const retryDelay = 1000;

    // Check mock servers
    for (const port of [3001, 3002, 3003]) {
      let retries = maxRetries;
      while (retries > 0) {
        try {
          const response = await fetch(`http://localhost:${port}/health`);
          if (response.ok) {
            console.log(`✅ Mock server on port ${port} is ready`);
            break;
          }
        } catch (error) {
          // Server not ready yet
        }

        retries--;
        if (retries === 0) {
          throw new Error(`Mock server on port ${port} failed to start`);
        }

        await this.sleep(retryDelay);
      }
    }

    // Check LLM Gateway
    let retries = maxRetries;
    while (retries > 0) {
      try {
        const response = await fetch('http://localhost:3000/health');
        if (response.ok) {
          console.log('✅ LLM Gateway is ready');
          break;
        }
      } catch (error) {
        // Gateway not ready yet
      }

      retries--;
      if (retries === 0) {
        throw new Error('LLM Gateway failed to start');
      }

      await this.sleep(retryDelay);
    }

    console.log('🎉 All services are ready!\n');
  }

  private async runTests() {
    console.log('🧪 Running E2E tests...\n');

    return new Promise<void>((resolve, reject) => {
      const testProcess = spawn('jest', ['test/e2e/e2e.test.ts', '--verbose'], {
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

  private async stopAllProcesses() {
    console.log('\n🛑 Stopping all processes...');

    for (const processInfo of this.processes) {
      try {
        console.log(`Stopping ${processInfo.name}...`);
        processInfo.process.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            processInfo.process.kill('SIGKILL');
            resolve();
          }, 5000);

          processInfo.process.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        console.error(`Error stopping ${processInfo.name}:`, error);
      }
    }

    this.processes = [];
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
