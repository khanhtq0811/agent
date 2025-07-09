const MessageClassifier = require('./messageClassifier');
const VectorStorageService = require('./vectorStorage');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Message Processor
 * Main processing pipeline for Slack messages
 * Coordinates classification, storage, and response generation
 */
class MessageProcessor {
  constructor() {
    this.classifier = new MessageClassifier();
    this.vectorStorage = new VectorStorageService();
    this.isInitialized = false;
    this.processingQueue = [];
    this.isProcessing = false;
  }

  /**
   * Initialize the message processor
   */
  async initialize() {
    try {
      await this.vectorStorage.initialize();
      this.isInitialized = true;
      logger.info('Message processor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize message processor', error);
      throw error;
    }
  }

  /**
   * Process a Slack message through the full pipeline
   * @param {Object} messageData - Slack message data
   * @param {Object} slackClient - Slack client for responses
   */
  async processMessage(messageData, slackClient) {
    const messageId = messageData.ts;
    
    try {
      logger.logMessageProcessing('pipeline_start', messageId, {
        user: messageData.user,
        channel: messageData.channel,
        is_mention: messageData.isMention
      });

      // Step 1: Classify the message
      const classification = await this.classifier.classifyMessage(
        messageData, 
        messageData.threadContext
      );

      // Step 2: Store in vector database
      if (this.isInitialized) {
        await this.vectorStorage.storeMessage(messageData, classification);
      }

      // Step 3: Check if response is needed
      const responseNeeded = this.shouldGenerateResponse(messageData, classification);
      
      if (responseNeeded) {
        await this.handleResponseGeneration(messageData, classification, slackClient);
      }

      // Step 4: Handle urgent messages
      if (classification.priority === 'HIGH' || classification.category === 'URGENT') {
        await this.handleUrgentMessage(messageData, classification, slackClient);
      }

      // Step 5: Extract and log action items
      const actionItems = this.classifier.extractActionItems(messageData.text || '');
      if (actionItems.length > 0) {
        logger.info('Action items detected', {
          message_id: messageId,
          action_items: actionItems,
          user: messageData.user
        });
      }

      logger.logMessageProcessing('pipeline_complete', messageId, {
        category: classification.category,
        priority: classification.priority,
        response_generated: responseNeeded,
        action_items_count: actionItems.length
      });

      return {
        classification,
        actionItems,
        responseGenerated: responseNeeded
      };

    } catch (error) {
      logger.error('Error processing message', error);
      
      // Send error acknowledgment for mentions
      if (messageData.isMention) {
        try {
          await slackClient.chat.postMessage({
            channel: messageData.channel,
            thread_ts: messageData.ts,
            text: '⚠️ Xin lỗi, có lỗi khi xử lý tin nhắn của bạn. Tôi sẽ thử lại sau.'
          });
        } catch (replyError) {
          logger.error('Failed to send error message', replyError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Determine if a response should be generated
   * @param {Object} messageData 
   * @param {Object} classification 
   * @returns {boolean}
   */
  shouldGenerateResponse(messageData, classification) {
    // Always respond to direct mentions
    if (messageData.isMention) return true;
    
    // Respond to direct messages
    if (messageData.channel_type === 'im') return true;
    
    // Respond to urgent messages if auto-response is enabled
    if (config.slack.enableAutoResponse && classification.category === 'URGENT') {
      return true;
    }
    
    // Respond to questions with high confidence if auto-response is enabled
    if (config.slack.enableAutoResponse && 
        classification.category === 'QUESTION' && 
        classification.confidence >= config.slack.responseConfidenceThreshold) {
      return true;
    }
    
    return false;
  }

  /**
   * Handle response generation for messages
   * @param {Object} messageData 
   * @param {Object} classification 
   * @param {Object} slackClient 
   */
  async handleResponseGeneration(messageData, classification, slackClient) {
    try {
      logger.logMessageProcessing('response_generation_start', messageData.ts);

      let response = '';
      
      switch (classification.category) {
      case 'URGENT':
        response = await this.generateUrgentResponse(messageData, classification);
        break;
      case 'QUESTION':
        response = await this.generateQuestionResponse(messageData, classification);
        break;
      case 'MEETING':
        response = await this.generateMeetingResponse(messageData);
        break;
      default:
        response = await this.generateGenericResponse(messageData, classification);
      }

      if (response) {
        await slackClient.chat.postMessage({
          channel: messageData.channel,
          thread_ts: messageData.ts,
          text: response
        });

        logger.logMessageProcessing('response_sent', messageData.ts, {
          response_length: response.length,
          category: classification.category
        });
      }

    } catch (error) {
      logger.error('Error generating response', error);
    }
  }

  /**
   * Generate response for urgent messages
   * @param {Object} messageData 
   * @param {Object} classification 
   * @returns {Promise<string>}
   */
  async generateUrgentResponse(messageData, classification) {
    // For now, return a simple acknowledgment
    // In Phase 3, this would use the research engine
    return `🚨 Đã nhận được tin nhắn urgent từ <@${messageData.user}>!\n\n` +
           `📋 **Phân loại**: ${classification.category}\n` +
           `⚡ **Độ ưu tiên**: ${classification.priority}\n` +
           `🎯 **Độ tin cậy**: ${(classification.confidence * 100).toFixed(0)}%\n\n` +
           'Tôi đang phân tích và sẽ research giải pháp ngay. Vui lòng đợi một chút...';
  }

  /**
   * Generate response for questions
   * @param {Object} messageData 
   * @param {Object} classification 
   * @returns {Promise<string>}
   */
  async generateQuestionResponse(messageData, classification) {
    // Search for similar questions in the knowledge base
    let similarQuestions = [];
    if (this.isInitialized) {
      similarQuestions = await this.vectorStorage.searchSimilarMessages(
        messageData.text || '', 
        3, 
        { category: 'QUESTION' }
      );
    }

    let response = `🤔 Câu hỏi thú vị từ <@${messageData.user}>!\n\n` +
                   `📋 **Phân loại**: ${classification.category}\n` +
                   `🎯 **Độ tin cậy**: ${(classification.confidence * 100).toFixed(0)}%\n\n`;

    if (similarQuestions.length > 0) {
      response += `🔍 **Tìm thấy ${similarQuestions.length} câu hỏi tương tự đã được thảo luận trước đây.**\n\n`;
      response += 'Tôi đang research thông tin chi tiết và sẽ đưa ra gợi ý giải pháp sớm nhất...';
    } else {
      response += '🔍 **Đây là câu hỏi mới!** Tôi đang research thông tin và sẽ trả lời chi tiết...';
    }

    return response;
  }

  /**
   * Generate response for meeting requests
   * @param {Object} messageData 
   * @returns {Promise<string>}
   */
  async generateMeetingResponse(messageData) {
    return `📅 Meeting request từ <@${messageData.user}>!\n\n` +
           'Tôi đã ghi nhận yêu cầu meeting của bạn. ' +
           'Hiện tại tôi chưa tích hợp với calendar, nhưng sẽ nhắc @khanhtq0811 check và phản hồi sớm nhất.\n\n' +
           '💡 **Gợi ý**: Có thể chia sẻ thêm về agenda hoặc mục tiêu của meeting không?';
  }

  /**
   * Generate generic response
   * @param {Object} messageData 
   * @param {Object} classification 
   * @returns {Promise<string>}
   */
  async generateGenericResponse(messageData, classification) {
    if (messageData.isMention) {
      return `👋 Chào <@${messageData.user}>!\n\n` +
             'Tôi đã nhận được tin nhắn của bạn và đang phân tích:\n' +
             `📋 **Loại**: ${classification.category}\n` +
             `⚡ **Ưu tiên**: ${classification.priority}\n\n` +
             'Có gì cần hỗ trợ cụ thể không? Tôi có thể giúp research thông tin, ' +
             'phân tích vấn đề, hoặc tóm tắt cuộc thảo luận.';
    }

    return ''; // No response for generic messages
  }

  /**
   * Handle urgent messages that need immediate attention
   * @param {Object} messageData 
   * @param {Object} classification 
   * @param {Object} slackClient 
   */
  async handleUrgentMessage(messageData, classification, slackClient) {
    try {
      // Add urgent reaction
      await slackClient.reactions.add({
        channel: messageData.channel,
        timestamp: messageData.ts,
        name: 'warning'
      });

      // Log for monitoring
      logger.info('URGENT MESSAGE DETECTED', {
        message_id: messageData.ts,
        user: messageData.user,
        channel: messageData.channel,
        classification: classification,
        text_preview: (messageData.text || '').substring(0, 100)
      });

      // In Phase 4, this would trigger notifications to relevant team members

    } catch (error) {
      logger.error('Error handling urgent message', error);
    }
  }

  /**
   * Generate daily summary of important messages
   * @param {string} channelId - Channel to summarize (optional)
   * @returns {Promise<Object>} Summary data
   */
  async generateDailySummary(channelId = null) {
    if (!this.isInitialized) {
      logger.warn('Cannot generate summary - vector storage not initialized');
      return null;
    }

    try {
      const hoursBack = 24;
      let recentMessages;
      
      if (channelId) {
        recentMessages = await this.vectorStorage.getRecentChannelMessages(channelId, hoursBack);
      } else {
        // Get recent messages from all monitored channels
        recentMessages = await this.vectorStorage.searchSimilarMessages('', 50, {
          stored_at: { '$gte': new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString() }
        });
      }

      // Group by category
      const summary = {
        date: new Date().toDateString(),
        total_messages: recentMessages.length,
        urgent: recentMessages.filter(m => m.metadata.category === 'URGENT').length,
        questions: recentMessages.filter(m => m.metadata.category === 'QUESTION').length,
        meetings: recentMessages.filter(m => m.metadata.category === 'MEETING').length,
        discussions: recentMessages.filter(m => m.metadata.category === 'DISCUSSION').length,
        channels: [...new Set(recentMessages.map(m => m.metadata.channel))],
        top_contributors: this.getTopContributors(recentMessages)
      };

      logger.info('Daily summary generated', summary);
      return summary;

    } catch (error) {
      logger.error('Error generating daily summary', error);
      return null;
    }
  }

  /**
   * Get top contributors from messages
   * @param {Array} messages 
   * @returns {Array}
   */
  getTopContributors(messages) {
    const userCounts = {};
    messages.forEach(msg => {
      const user = msg.metadata.user;
      userCounts[user] = (userCounts[user] || 0) + 1;
    });

    return Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([user, count]) => ({ user, count }));
  }

  /**
   * Close the message processor
   */
  async close() {
    if (this.vectorStorage) {
      await this.vectorStorage.close();
    }
  }
}

module.exports = MessageProcessor;