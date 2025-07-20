/**
 * Script to start the mock LLM server
 */

import MockLLMServer from './mock-llm-server.js';

const port = parseInt(process.env.MOCK_SERVER_PORT || '3001');
const server = new MockLLMServer(port);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down mock server...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down mock server...');
  await server.stop();
  process.exit(0);
});

// Start the server
server.start().then(() => {
  console.log(`Mock LLM Server started on port ${port}`);
  console.log('Press Ctrl+C to stop');
}).catch((error) => {
  console.error('Failed to start mock server:', error);
  process.exit(1);
});
