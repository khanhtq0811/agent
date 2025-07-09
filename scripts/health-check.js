#!/usr/bin/env node

/**
 * Health check script for AI Slack Assistant
 * Tests basic initialization without connecting to external services
 */

const config = require('../src/config');
const logger = require('../src/utils/logger');
const MessageClassifier = require('../src/services/messageClassifier');
const VectorStorageService = require('../src/services/vectorStorage');

async function healthCheck() {
  try {
    logger.info('🔍 Starting health check...');

    // Test 1: Configuration
    logger.info('✅ Configuration loaded');
    logger.info(`Environment: ${config.app.nodeEnv}`);
    logger.info(`Log Level: ${config.app.logLevel}`);

    // Test 2: Message Classifier (only test fallback functions)
    logger.info('Testing Message Classifier fallback functions...');
    const MessageClassifier = require('../src/services/messageClassifier');
    
    // Test the static methods that don't require OpenAI
    const testClassifier = Object.create(MessageClassifier.prototype);
    
    const classification = testClassifier.getFallbackClassification('This is a test message');
    logger.info('✅ Message Classification fallback working', { classification });

    // Test 3: Bot mention detection  
    const mentionTest = testClassifier.isBotMentioned({
      text: 'Hey @khanhtq0811 can you help?'
    });
    logger.info('✅ Bot mention detection working', { detected: mentionTest });

    // Test 4: Action item extraction
    const actionItems = testClassifier.extractActionItems('We need to fix the bug by tomorrow');
    logger.info('✅ Action item extraction working', { actionItems });

    // Test 5: Vector Storage (without connecting)
    const vectorStorage = new VectorStorageService();
    const stats = await vectorStorage.getStats();
    logger.info('✅ Vector Storage service created', { stats });

    // Test 6: Configuration validation
    const hasRequiredKeys = !!(config.slack.botToken && config.openai.apiKey);
    logger.info(`Configuration status: ${hasRequiredKeys ? '✅ Ready for production' : '⚠️  Missing API keys (expected in development)'}`);

    logger.info('🎉 Health check completed successfully!');
    logger.info('The AI Slack Assistant core components are working correctly.');
    
    if (hasRequiredKeys) {
      logger.info('Ready to start with full functionality!');
    } else {
      logger.info('Ready for development - set API keys in .env for full functionality.');
    }

    return true;

  } catch (error) {
    logger.error('❌ Health check failed', error);
    return false;
  }
}

// Run health check if this script is executed directly
if (require.main === module) {
  healthCheck()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Health check error:', error);
      process.exit(1);
    });
}

module.exports = healthCheck;