# Setup Guide

## Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn
- OpenAI API key
- Slack workspace with admin permissions

## Step-by-Step Setup

### 1. Clone and Install

```bash
git clone https://github.com/khanhtq0811/agent.git
cd agent
npm install
```

### 2. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name your app "AI Slack Assistant" and select your workspace
4. Click "Create App"

### 3. Configure Slack App

#### Enable Socket Mode
1. Go to **Socket Mode** in the sidebar
2. Toggle "Enable Socket Mode" to On
3. Click "Generate Token" and add these scopes:
   - `connections:write`
4. Save the **App Token** (starts with `xapp-`)

#### Set Bot Token Scopes
1. Go to **OAuth & Permissions**
2. In "Scopes" → "Bot Token Scopes", add:
   - `app_mentions:read`
   - `channels:read`
   - `chat:write`
   - `im:read`
   - `im:write`
   - `reactions:write`
   - `users:read`

#### Install App to Workspace
1. In **OAuth & Permissions**, click "Install to Workspace"
2. Authorize the permissions
3. Save the **Bot User OAuth Token** (starts with `xoxb-`)

#### Get Signing Secret
1. Go to **Basic Information**
2. Copy the **Signing Secret**

### 4. Get OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Go to API Keys section
4. Create a new secret key
5. Copy the API key (starts with `sk-`)

### 5. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Bot Configuration
CHANNELS_TO_MONITOR=general,random
ENABLE_AUTO_RESPONSE=false
BOT_USER_ID=U12345678  # Will be shown when bot starts
```

### 6. Test Setup

```bash
npm run health-check
```

You should see:
```
✅ Configuration loaded
✅ Message Classification fallback working
✅ Bot mention detection working
✅ Action item extraction working
✅ Vector Storage service created
Configuration status: ✅ Ready for production
```

### 7. Start the Bot

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### 8. Test in Slack

1. Invite the bot to a channel: `/invite @ai-slack-assistant`
2. Mention the bot: `@ai-slack-assistant Hello!`
3. Send a DM to the bot
4. Check that the bot responds

## Configuration Options

### Monitored Channels

To monitor specific channels, update `CHANNELS_TO_MONITOR`:
```env
CHANNELS_TO_MONITOR=general,dev-team,support,announcements
```

### Auto Response

Enable automatic responses to high-confidence messages:
```env
ENABLE_AUTO_RESPONSE=true
RESPONSE_CONFIDENCE_THRESHOLD=0.8
```

### Logging

Set log level for debugging:
```env
LOG_LEVEL=debug  # error, warn, info, debug
```

## Troubleshooting

### Bot Not Responding

1. Check if bot is online in Slack
2. Verify permissions are correctly set
3. Check logs for errors
4. Ensure bot is invited to the channel

### "Missing API Key" Errors

1. Verify `.env` file exists and has correct format
2. Check that API keys don't have extra spaces
3. Restart the application after changing `.env`

### OpenAI API Errors

1. Check if API key is valid
2. Verify you have credits in your OpenAI account
3. Check rate limits if getting 429 errors

### Vector Database Issues

By default, the app uses in-memory vector storage. For production:

1. Install and run ChromaDB separately
2. Update `CHROMA_HOST` and `CHROMA_PORT` in `.env`

## Advanced Configuration

### Using External ChromaDB

```bash
# Install ChromaDB
pip install chromadb

# Run ChromaDB server
chroma run --host localhost --port 8000
```

Update `.env`:
```env
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

### LangSmith Integration (Optional)

For monitoring and optimization:

```env
LANGSMITH_API_KEY=your-langsmith-key
LANGSMITH_PROJECT=ai-slack-assistant
```

### Custom Prompts

Edit message classification prompts in:
`src/services/messageClassifier.js`

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Health Check

```bash
npm run health-check
```

## Production Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start src/index.js --name "ai-slack-assistant"
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables for Production

```env
NODE_ENV=production
LOG_LEVEL=info
ENABLE_AUTO_RESPONSE=true
```

## Getting Help

- **Documentation**: Check README.md
- **Issues**: [GitHub Issues](https://github.com/khanhtq0811/agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/khanhtq0811/agent/discussions)