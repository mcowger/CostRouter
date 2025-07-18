# LLM Gateway

An intelligent gateway for routing requests to Large Language Model (LLM) providers with real-time monitoring and cost optimization.

## Overview

LLM Gateway is a sophisticated reverse proxy that sits between your applications and multiple LLM provider APIs (OpenAI, Anthropic, GitHub Copilot, OpenRouter, etc.). It intelligently routes requests to the most suitable backend provider based on model availability and rate limits, allowing you to leverage the strengths of each provider while minimizing costs.  The real goal here is to allow you to use the various free limit options out there (Copilot, Google AI Studio, etc) as much as possible without incurring costs.

**Key Problem Solved**: Managing multiple LLM providers is complex and risky. Relying on a single provider can lead to downtime, and exceeding rate limits or free-tier quotas can be expensive. LLM Gateway solves this by providing intelligent failover, cost optimization, and unified access.

## Core Features

### 🚀 **Intelligent Request Routing**
- **Unified API Endpoint**: Single `/v1/chat/completions` endpoint compatible with OpenAI API standard
- **Smart Provider Selection**: Automatically chooses the best available provider based on real-time capacity and limits
- **Automatic Failover**: Seamlessly switches to alternative providers when primary ones hit limits, and switches back when they become available again.
- **Model-aware Routing**: Routes requests based on which providers support the requested model.  TODO: implement model mapping.

### 📊 **Real-time Monitoring & Analytics**
- **Live Usage Dashboard**: Vue.js-based web interface with real-time metrics
- **Historical Trends**: Sparkline visualizations showing usage patterns over time
- **Multi-dimensional Tracking**: Monitor requests, tokens, and costs across all providers
- **Visual Indicators**: Color-coded progress bars and alerts for approaching limits

### 💰 **Cost Optimization**

- **Cost Tracking**: Real-time cost monitoring with configurable limits

- **Flexible Pricing Models**: Supports per-token, per-request, and flat-rate pricing

### ⚙️ **Enterprise-grade Configuration**
- **Multi-provider Support**: OpenAI, GitHub Copilot, OpenRouter, and custom OpenAI-compatible APIs
- **Granular Rate Limits**: Configure limits per minute/hour/day for requests, tokens, and costs
- **Hot Configuration Reload**: Update settings without restarting the service
- **Schema Validation**: Zod-based configuration validation ensures reliability

## Architecture

LLM Gateway follows a modular pipeline architecture with singleton manager classes:


**Core Components:**
- **ConfigManager**: Loads and validates provider configurations
- **Router**: Selects optimal provider for each request
- **UsageManager**: Tracks and enforces rate limits using `rate-limiter-flexible`
- **Executor**: Handles API calls to selected providers
- **UsageDatabaseManager**: Persists usage history for analytics

## Quick Start

### Prerequisites

- **Node.js 22+** (LTS recommended)
- **pnpm** (package manager)

### Installation

1. **Clone and setup:**
   ```bash
   git clone https://github.com/mcowger/CostRouter.git
   cd CostRouter
   pnpm install
   ```

2. **Configure providers:**
   ```bash
   pnpm run setup  # Creates config.jsonc from template
   # Edit config.jsonc with your API keys and provider settings
   ```

3. **Start the services:**
   ```bash
   # Option 1: Start both server and UI together (recommended)
   pnpm run dev:all

   # Option 2: Start individually
   pnpm run dev:server  # Server only (port 3000)
   pnpm run dev:ui      # UI only (port 5173)
   ```

4. **Access the dashboard:**
   Open http://localhost:5173 to view the real-time usage dashboard

### Basic Usage

Once running, use the gateway exactly like the OpenAI API:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer does-not-matter-what-you-put-here" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

The gateway will automatically route to the best available provider.

## Configuration

### Provider Types

LLM Gateway supports multiple provider types:

#### OpenAI-Compatible Providers
```jsonc
{
  "id": "openai-main",
  "type": "openai",
  "baseURL": "https://api.openai.com/v1",
  "apiKey": "sk-your-key-here",
  "models": [
    {
      "name": "gpt-4",
      "pricing": {
        "inputCostPerMillionTokens": 10.00,
        "outputCostPerMillionTokens": 30.00
      }
    }
  ],
  "limits": {
    "requestsPerMinute": 100,
    "tokensPerDay": 1000000,
    "costPerDay": 5.00
  }
}
```

#### GitHub Copilot
```jsonc
{
  "id": "copilot-provider",
  "type": "copilot",
  "oauthToken": "your-github-oauth-token",
  "models": [
    { "name": "gpt-4o" },
    { "name": "claude-3.5-sonnet" }
  ]
}
```

### Rate Limiting Options

Configure granular limits for each provider:
- **Time-based**: `requestsPerMinute`, `requestsPerHour`, `requestsPerDay`
- **Token-based**: `tokensPerMinute`, `tokensPerHour`, `tokensPerDay`
- **Cost-based**: `costPerMinute`, `costPerHour`, `costPerDay`

## Real-time Dashboard

### Features

🔄 **Live Monitoring**
- Real-time updates every second
- Provider status indicators
- Current vs. limit progress bars

📈 **Historical Analytics**
- Sparkline charts for trends
- Configurable time windows (1m, 5m, 10m, 30m, 60m)
- Request, token, and cost tracking

⚙️ **Configuration Management**
- Live provider configuration editing
- Schema validation
- Hot-reload without service restart

### Testing & Simulation

Use the included simulation script for testing:

```bash
# Start continuous usage simulation
./simulate_usage.sh

# Or manually simulate usage
curl -X POST http://localhost:3000/usage/simulate \
  -H "Content-Type: application/json" \
  -d '{"providerId": "openai-main", "tokens": 500, "cost": 0.05}'
```

### API Endpoints

- `GET /v1/chat/completions` - Main LLM proxy endpoint
- `GET /v1/models` - List configured models across all defined providers
- `GET /usage/current` - Current usage statistics
- `GET /usage/historical` - Historical usage data
- `POST /usage/simulate` - Simulate usage (development only)
- `GET /config` - Get current configuration
- `POST /config` - Update configuration

## Production Deployment

### Building for Production

DONT RUN THIS IN PRODUCTION

### Running in Production

DONT RUN THIS IN PRODUCTION

### Environment Variables

```bash
# Optional: Set log level
export LOG_LEVEL=info

# Optional: Custom port
export PORT=3000
```

## Technology Stack

### Backend (Node.js/TypeScript)
- **Express.js**: Web framework and API server
- **Vercel AI SDK**: LLM provider integrations and streaming
- **rate-limiter-flexible**: Advanced rate limiting and usage tracking
- **Zod**: Runtime schema validation and type safety
- **Pino**: High-performance structured logging
- **LowDB**: Lightweight JSON database for usage history

### Frontend (Vue.js)
- **Vue 3**: Progressive web framework with Composition API
- **Pinia**: State management for configuration and usage data
- **Vue Router**: Client-side routing
- **vue-sparklines**: Real-time usage trend visualizations
- **Vite**: Fast development server and build tool

### Development Tools
- **pnpm**: Fast, disk space efficient package manager
- **TypeScript**: Type safety across the entire stack
- **tsx**: TypeScript execution for development hot-reloading
- **Prettier**: Code formatting and style consistency


## Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow TypeScript best practices** and maintain type safety
3. **Add tests** for new functionality
4. **Update documentation** for any API changes
5. **Submit a pull request** with a clear description

### Development Setup

```bash
# Clone and install
git clone https://github.com/mcowger/CostRouter.git
cd CostRouter
pnpm install

# Setup configuration
pnpm run setup

# Start development environment
pnpm run dev:all

# Build for production
pnpm run build

# Format code
pnpm run format

# Clean build artifacts
pnpm run clean
```

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Support

- **Issues**: Report bugs and request features on [GitHub Issues](https://github.com/mcowger/CostRouter/issues)

---

**Built with ❤️ for the AI development community**