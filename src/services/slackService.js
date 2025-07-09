const { App } = require('@slack/bolt');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Slack Service
 * Manages Slack Bot connection and message handling
 */
class SlackService {
  constructor() {
    this.app = new App({
      token: config.slack.botToken,
      appToken: config.slack.appToken,
      signingSecret: config.slack.signingSecret,
      socketMode: true, // Enable socket mode for easier development
      port: config.app.port
    });

    this.messageHandlers = [];
    this.isConnected = false;
    
    this.setupEventHandlers();
  }

  /**
   * Set up Slack event handlers
   */
  setupEventHandlers() {
    // Handle app mentions
    this.app.event('app_mention', async ({ event, context, client }) => {
      logger.logSlackEvent('app_mention', event);
      await this.handleMessage(event, context, client, true);
    });

    // Handle direct messages
    this.app.event('message', async ({ event, context, client }) => {
      // Only process messages in monitored channels or DMs
      if (this.shouldProcessMessage(event)) {
        logger.logSlackEvent('message', event);
        await this.handleMessage(event, context, client, false);
      }
    });

    // Handle app startup
    this.app.event('app_home_opened', async ({ event, client }) => {
      logger.info('App home opened', { user: event.user });
      
      try {
        await client.views.publish({
          user_id: event.user,
          view: {
            type: 'home',
            callback_id: 'home_view',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: '*Xin chào! 👋* \n\nTôi là AI Slack Assistant. Tôi có thể giúp bạn:\n\n• Phân tích và tóm tắt tin nhắn\n• Research thông tin và đưa ra giải pháp\n• Theo dõi và ưu tiên tin nhắn quan trọng\n• Tạo tóm tắt hàng ngày\n\nChỉ cần mention @ai-assistant trong channel hoặc nhắn tin trực tiếp!'
                }
              }
            ]
          }
        });
      } catch (error) {
        logger.error('Error publishing home view', error);
      }
    });

    // Handle errors
    this.app.error(async (error) => {
      logger.error('Slack app error', error);
    });
  }

  /**
   * Check if message should be processed
   * @param {Object} event - Slack event
   * @returns {boolean}
   */
  shouldProcessMessage(event) {
    // Skip bot messages
    if (event.subtype === 'bot_message') return false;
    
    // Skip our own messages
    if (event.user === config.slack.botUserId) return false;
    
    // Process DMs
    if (event.channel_type === 'im') return true;
    
    // Process monitored channels
    const monitoredChannels = config.slack.channelsToMonitor;
    if (monitoredChannels.includes(event.channel)) return true;
    
    // Process if bot is mentioned
    if (event.text && event.text.includes(`<@${config.slack.botUserId}>`)) return true;
    
    return false;
  }

  /**
   * Handle incoming messages
   * @param {Object} event - Slack event
   * @param {Object} context - Slack context
   * @param {Object} client - Slack client
   * @param {boolean} isMention - Whether this is a mention
   */
  async handleMessage(event, context, client, isMention = false) {
    try {
      // Get thread context if this is part of a thread
      let threadContext = '';
      if (event.thread_ts) {
        threadContext = await this.getThreadContext(client, event.channel, event.thread_ts);
      }

      // Prepare message data
      const messageData = {
        ...event,
        threadContext,
        isMention,
        timestamp: new Date(parseFloat(event.ts) * 1000)
      };

      // Notify all registered handlers
      for (const handler of this.messageHandlers) {
        try {
          await handler(messageData, client);
        } catch (handlerError) {
          logger.error('Message handler error', handlerError);
        }
      }

      // Send acknowledgment for mentions
      if (isMention) {
        await this.sendAcknowledgment(client, event.channel, event.ts);
      }

    } catch (error) {
      logger.error('Error handling message', error);
    }
  }

  /**
   * Get thread context for better understanding
   * @param {Object} client - Slack client
   * @param {string} channel - Channel ID
   * @param {string} threadTs - Thread timestamp
   * @returns {Promise<string>} Thread context
   */
  async getThreadContext(client, channel, threadTs) {
    try {
      const result = await client.conversations.replies({
        channel: channel,
        ts: threadTs,
        limit: 10 // Get last 10 messages in thread
      });

      if (result.messages) {
        return result.messages
          .map(msg => `${msg.user}: ${msg.text}`)
          .join('\n');
      }
    } catch (error) {
      logger.error('Error getting thread context', error);
    }
    
    return '';
  }

  /**
   * Send acknowledgment for mentions
   * @param {Object} client - Slack client
   * @param {string} channel - Channel ID
   * @param {string} threadTs - Thread timestamp
   */
  async sendAcknowledgment(client, channel, threadTs) {
    try {
      await client.reactions.add({
        channel: channel,
        timestamp: threadTs,
        name: 'eyes' // 👀 emoji to show we're looking at it
      });
    } catch (error) {
      logger.warn('Could not add reaction', error);
    }
  }

  /**
   * Send a message to Slack
   * @param {string} channel - Channel ID
   * @param {string} text - Message text
   * @param {string} threadTs - Thread timestamp (optional)
   * @returns {Promise<Object>} Slack response
   */
  async sendMessage(channel, text, threadTs = null) {
    try {
      const message = {
        channel: channel,
        text: text
      };

      if (threadTs) {
        message.thread_ts = threadTs;
      }

      const result = await this.app.client.chat.postMessage(message);
      logger.info('Message sent successfully', { 
        channel, 
        ts: result.ts,
        thread: !!threadTs 
      });
      
      return result;
    } catch (error) {
      logger.error('Error sending message', error);
      throw error;
    }
  }

  /**
   * Register a message handler
   * @param {Function} handler - Message handler function
   */
  addMessageHandler(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Get channel information
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Channel info
   */
  async getChannelInfo(channelId) {
    try {
      const result = await this.app.client.conversations.info({
        channel: channelId
      });
      return result.channel;
    } catch (error) {
      logger.error('Error getting channel info', error);
      return null;
    }
  }

  /**
   * Get user information
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User info
   */
  async getUserInfo(userId) {
    try {
      const result = await this.app.client.users.info({
        user: userId
      });
      return result.user;
    } catch (error) {
      logger.error('Error getting user info', error);
      return null;
    }
  }

  /**
   * Start the Slack bot
   */
  async start() {
    try {
      await this.app.start();
      this.isConnected = true;
      logger.info('⚡️ AI Slack Assistant is running!');
    } catch (error) {
      logger.error('Failed to start Slack bot', error);
      throw error;
    }
  }

  /**
   * Stop the Slack bot
   */
  async stop() {
    try {
      await this.app.stop();
      this.isConnected = false;
      logger.info('Slack bot stopped');
    } catch (error) {
      logger.error('Error stopping Slack bot', error);
      throw error;
    }
  }

  /**
   * Check if bot is connected
   */
  isConnectedToSlack() {
    return this.isConnected;
  }
}

module.exports = SlackService;