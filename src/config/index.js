require('dotenv').config();

/**
 * Application configuration module
 * Manages all environment variables and configuration settings
 */
class Config {
  constructor() {
    this.validateRequiredEnvVars();
  }

  // Slack Configuration
  get slack() {
    return {
      botToken: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      botUserId: process.env.BOT_USER_ID,
      channelsToMonitor: process.env.CHANNELS_TO_MONITOR?.split(',') || ['general'],
      enableAutoResponse: process.env.ENABLE_AUTO_RESPONSE === 'true',
      responseConfidenceThreshold: parseFloat(process.env.RESPONSE_CONFIDENCE_THRESHOLD) || 0.8
    };
  }

  // OpenAI Configuration
  get openai() {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000
    };
  }

  // LangSmith Configuration
  get langsmith() {
    return {
      apiKey: process.env.LANGSMITH_API_KEY,
      project: process.env.LANGSMITH_PROJECT || 'ai-slack-assistant',
      enabled: !!process.env.LANGSMITH_API_KEY
    };
  }

  // Vector Database Configuration
  get vectorDb() {
    return {
      host: process.env.CHROMA_HOST || 'localhost',
      port: parseInt(process.env.CHROMA_PORT) || 8000,
      collectionName: process.env.CHROMA_COLLECTION_NAME || 'slack_conversations'
    };
  }

  // Application Configuration
  get app() {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT) || 3000,
      logLevel: process.env.LOG_LEVEL || 'info'
    };
  }

  // Message Classification Categories
  get messageCategories() {
    return {
      URGENT: 'urgent',
      QUESTION: 'question',
      INFO: 'info',
      MEETING: 'meeting',
      DISCUSSION: 'discussion',
      SOCIAL: 'social'
    };
  }

  // Priority Levels
  get priorityLevels() {
    return {
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low'
    };
  }

  /**
   * Validate that required environment variables are set
   */
  validateRequiredEnvVars() {
    const required = [
      'SLACK_BOT_TOKEN',
      'SLACK_APP_TOKEN',
      'SLACK_SIGNING_SECRET',
      'OPENAI_API_KEY'
    ];

    const missing = required.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      console.warn(`Warning: Missing required environment variables: ${missing.join(', ')}`);
      console.warn('Please check your .env file or environment configuration.');
    }
  }

  /**
   * Get development mode status
   */
  isDevelopment() {
    return this.app.nodeEnv === 'development';
  }

  /**
   * Get production mode status
   */
  isProduction() {
    return this.app.nodeEnv === 'production';
  }
}

module.exports = new Config();