/**
 * Mock LLM API Server
 * Simulates OpenAI API endpoints for end-to-end testing
 */

import express from 'express';
import cors from 'cors';
import { Request, Response } from 'express';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
  }>;
}

class MockLLMServer {
  private app: express.Application;
  private server: any;
  private port: number;
  private requestCount: Map<string, number> = new Map();
  private rateLimitThreshold: number = 5;
  private shouldSimulateTimeout: boolean = false;
  private shouldSimulateAuthError: boolean = false;

  constructor(port: number = 3001) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, _res, next) => {
      console.log(`[Mock Server] ${req.method} ${req.path}`);
      next();
    });

    // Auth middleware
    this.app.use('/v1/*', (req, res, next) => {
      if (this.shouldSimulateAuthError) {
        return res.status(401).json({
          error: {
            message: 'Invalid API key provided',
            type: 'invalid_request_error',
            code: 'invalid_api_key'
          }
        });
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: {
            message: 'Missing or invalid authorization header',
            type: 'invalid_request_error',
            code: 'invalid_api_key'
          }
        });
      }

      next();
    });
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Chat completions endpoint
    this.app.post('/v1/chat/completions', this.handleChatCompletions.bind(this));

    // Models endpoint
    this.app.get('/v1/models', (_req, res) => {
      res.json({
        object: 'list',
        data: [
          {
            id: 'gpt-4o',
            object: 'model',
            created: 1715367049,
            owned_by: 'openai'
          },
          {
            id: 'gpt-4o-mini',
            object: 'model',
            created: 1721172741,
            owned_by: 'openai'
          },
          {
            id: 'gpt-4-turbo',
            object: 'model',
            created: 1712361441,
            owned_by: 'openai'
          },
          {
            id: 'gpt-3.5-turbo',
            object: 'model',
            created: 1677610602,
            owned_by: 'openai'
          },
          {
            id: 'claude-3-5-sonnet-20241022',
            object: 'model',
            created: 1729555200,
            owned_by: 'anthropic'
          },
          {
            id: 'claude-3-5-haiku-20241022',
            object: 'model',
            created: 1729555200,
            owned_by: 'anthropic'
          }
        ]
      });
    });

    // Control endpoints for testing
    this.app.post('/test/reset', (req, res) => {
      this.requestCount.clear();
      this.shouldSimulateTimeout = false;
      this.shouldSimulateAuthError = false;
      res.json({ message: 'Mock server reset' });
    });

    this.app.post('/test/simulate-rate-limit', (req, res) => {
      const { provider } = req.body;
      this.requestCount.set(provider || 'default', this.rateLimitThreshold);
      res.json({ message: 'Rate limit simulation enabled' });
    });

    this.app.post('/test/simulate-timeout', (req, res) => {
      this.shouldSimulateTimeout = req.body.enabled !== false;
      res.json({ message: `Timeout simulation ${this.shouldSimulateTimeout ? 'enabled' : 'disabled'}` });
    });

    this.app.post('/test/simulate-auth-error', (req, res) => {
      this.shouldSimulateAuthError = req.body.enabled !== false;
      res.json({ message: `Auth error simulation ${this.shouldSimulateAuthError ? 'enabled' : 'disabled'}` });
    });
  }

  private async handleChatCompletions(req: Request, res: Response) {
    const requestBody: ChatCompletionRequest = req.body;
    const provider = req.headers['x-provider-id'] as string || 'default';

    // Simulate timeout
    if (this.shouldSimulateTimeout) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second timeout
      return;
    }

    // Rate limiting simulation
    const currentCount = this.requestCount.get(provider) || 0;
    if (currentCount >= this.rateLimitThreshold) {
      return res.status(429).json({
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded'
        }
      });
    }
    this.requestCount.set(provider, currentCount + 1);

    // Validate request
    if (!requestBody.model || !requestBody.messages) {
      return res.status(400).json({
        error: {
          message: 'Missing required fields: model and messages',
          type: 'invalid_request_error',
          code: 'invalid_request'
        }
      });
    }

    // Check if model is supported (OpenRouter supports many models)
    const supportedModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-sonnet',
      'claude-3-haiku'
    ];
    if (!supportedModels.includes(requestBody.model)) {
      return res.status(404).json({
        error: {
          message: `Model '${requestBody.model}' not found`,
          type: 'invalid_request_error',
          code: 'model_not_found'
        }
      });
    }

    const responseId = `chatcmpl-${Date.now()}`;
    const created = Math.floor(Date.now() / 1000);

    if (requestBody.stream) {
      return this.handleStreamingResponse(req, res, responseId, created, requestBody);
    } else {
      return this.handleNonStreamingResponse(req, res, responseId, created, requestBody);
    }
  }

  private handleNonStreamingResponse(req: Request, res: Response, id: string, created: number, requestBody: ChatCompletionRequest) {
    const lastMessage = requestBody.messages[requestBody.messages.length - 1];
    const responseContent = `Mock response to: "${lastMessage.content}" using model ${requestBody.model}`;

    const response: ChatCompletionResponse = {
      id,
      object: 'chat.completion',
      created,
      model: requestBody.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseContent
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: this.estimateTokens(requestBody.messages),
        completion_tokens: this.estimateTokens([{ role: 'assistant', content: responseContent }]),
        total_tokens: 0
      }
    };

    response.usage.total_tokens = response.usage.prompt_tokens + response.usage.completion_tokens;

    res.json(response);
  }

  private handleStreamingResponse(req: Request, res: Response, id: string, created: number, requestBody: ChatCompletionRequest) {
    const lastMessage = requestBody.messages[requestBody.messages.length - 1];
    const responseContent = `Mock streaming response to: "${lastMessage.content}" using model ${requestBody.model}`;
    const words = responseContent.split(' ');

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send initial chunk with role
    const initialChunk: StreamChunk = {
      id,
      object: 'chat.completion.chunk',
      created,
      model: requestBody.model,
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null
      }]
    };
    res.write(`data: ${JSON.stringify(initialChunk)}\n\n`);

    // Send content chunks
    let wordIndex = 0;
    const sendNextWord = () => {
      if (wordIndex < words.length) {
        const chunk: StreamChunk = {
          id,
          object: 'chat.completion.chunk',
          created,
          model: requestBody.model,
          choices: [{
            index: 0,
            delta: { content: words[wordIndex] + (wordIndex < words.length - 1 ? ' ' : '') },
            finish_reason: null
          }]
        };
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        wordIndex++;
        setTimeout(sendNextWord, 50); // 50ms delay between words
      } else {
        // Send final chunk
        const finalChunk: StreamChunk = {
          id,
          object: 'chat.completion.chunk',
          created,
          model: requestBody.model,
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop'
          }]
        };
        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    };

    sendNextWord();
  }

  private estimateTokens(messages: ChatMessage[]): number {
    return messages.reduce((total, msg) => total + Math.ceil(msg.content.length / 4), 0);
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock LLM Server running on port ${this.port}`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock LLM Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getPort(): number {
    return this.port;
  }
}

export default MockLLMServer;
