/**
 * Start Test Environment Script
 * Starts mock servers and LLM Gateway for manual testing
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

interface ProcessInfo {
  name: string;
  process: ChildProcess;
  port: number;
}

class TestEnvironment {
  private processes: ProcessInfo[] = [];

  async start() {
    console.log('🚀 Starting Test Environment...\n');

    try {
      // Start mock servers
      await this.startMockServers();

      // Start LLM Gateway
      await this.startLLMGateway();

      // Wait for services
      await this.waitForServices();

      console.log('\n✅ Test environment is ready!');
      console.log('\n📋 Available endpoints:');
      console.log('  • LLM Gateway: http://localhost:3000');
      console.log('  • Mock Server: http://localhost:3001');
      console.log('\n🧪 Test the gateway:');
      console.log('  curl -X POST http://localhost:3000/v1/chat/completions \\');
      console.log('    -H "Content-Type: application/json" \\');
      console.log('    -d \'{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}\'');
      console.log('\nPress Ctrl+C to stop all services');

      // Keep running until interrupted
      await this.waitForShutdown();
    } catch (error) {
      console.error('\n❌ Failed to start test environment:', error);
      process.exit(1);
    } finally {
      await this.stopAllProcesses();
    }
  }

  private async startMockServers() {
    console.log('🎭 Starting mock servers...');

    const mockProcess = spawn('tsx', ['test/mock-server/start-mock-server.ts'], {
      env: { ...process.env, MOCK_SERVER_PORT: '3001' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.processes.push({
      name: 'Mock Server',
      process: mockProcess,
      port: 3001
    });

    // Log output
    mockProcess.stdout?.on('data', (data) => {
      console.log(`[Mock Server] ${data.toString().trim()}`);
    });

    mockProcess.stderr?.on('data', (data) => {
      console.error(`[Mock Server Error] ${data.toString().trim()}`);
    });

    mockProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Mock server exited with code ${code}`);
      }
    });


    await this.sleep(2000);
  }

  private async startLLMGateway() {
    console.log('🌉 Starting LLM Gateway...');

    const gatewayProcess = spawn('tsx', [
      'server/index.ts',
      '--config', path.join(process.cwd(), 'config.test.jsonc'),
      '--usage-db-path', path.join(process.cwd(), 'usage.test.db.json')
    ], {
      env: {
        ...process.env,
        NODE_ENV: 'test'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.processes.push({
      name: 'LLM Gateway',
      process: gatewayProcess,
      port: 3000
    });

    // Log output
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

    await this.sleep(3000);
  }

  private async waitForServices() {
    console.log('⏳ Waiting for services to be ready...');

    const services = [
      { name: 'Mock Server', url: 'http://localhost:3001/health' },
      { name: 'LLM Gateway', url: 'http://localhost:3000/health' }
    ];

    for (const service of services) {
      let retries = 30;
      while (retries > 0) {
        try {
          const response = await fetch(service.url);
          if (response.ok) {
            console.log(`✅ ${service.name} is ready`);
            break;
          }
        } catch (error) {
          // Service not ready yet
        }

        retries--;
        if (retries === 0) {
          throw new Error(`${service.name} failed to start`);
        }

        await this.sleep(1000);
      }
    }
  }

  private async waitForShutdown(): Promise<void> {
    return new Promise((resolve) => {
      process.on('SIGINT', () => {
        console.log('\n🛑 Received shutdown signal...');
        resolve();
      });

      process.on('SIGTERM', () => {
        console.log('\n🛑 Received shutdown signal...');
        resolve();
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

    console.log('✅ All processes stopped');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the test environment
const env = new TestEnvironment();
env.start().catch((error) => {
  console.error('Failed to start test environment:', error);
  process.exit(1);
});
