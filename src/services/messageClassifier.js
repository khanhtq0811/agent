const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Message Classification Service
 * Uses LangChain and OpenAI to classify Slack messages into categories
 */
class MessageClassifier {
  constructor() {
    this.llm = new ChatOpenAI({
      apiKey: config.openai.apiKey,
      modelName: config.openai.model,
      temperature: 0.3, // Lower temperature for more consistent classification
      maxTokens: 200
    });

    this.classificationPrompt = PromptTemplate.fromTemplate(`
Phân loại tin nhắn Slack theo các categories sau:

Categories:
- URGENT: Cần response ngay lập tức (outage, critical bugs, system down)
- QUESTION: Technical hoặc business questions cần research và trả lời
- INFO: Thông tin sharing, updates, announcements
- MEETING: Meeting requests, scheduling, calendar events
- DISCUSSION: Thảo luận chung, brainstorming, ideas
- SOCIAL: Casual conversations, greetings, non-work related

Message: "{message}"
Channel: {channel}
User: {user}
Time: {timestamp}
Thread Context: {threadContext}

Hãy phân tích message và trả về:
1. Category (một trong các loại trên)
2. Priority (HIGH/MEDIUM/LOW)
3. Confidence (0.0-1.0)
4. Reason (lý do phân loại ngắn gọn)

Format response as JSON:
{{
  "category": "CATEGORY_NAME",
  "priority": "PRIORITY_LEVEL",
  "confidence": 0.X,
  "reason": "explanation in Vietnamese"
}}
    `);

    this.chain = this.classificationPrompt.pipe(this.llm).pipe(new StringOutputParser());
  }

  /**
   * Classify a Slack message
   * @param {Object} message - Slack message object
   * @param {string} threadContext - Additional context from thread
   * @returns {Promise<Object>} Classification result
   */
  async classifyMessage(message, threadContext = '') {
    try {
      logger.logMessageProcessing('classification_start', message.ts, {
        user: message.user,
        channel: message.channel
      });

      const input = {
        message: message.text || '',
        channel: message.channel || 'unknown',
        user: message.user || 'unknown',
        timestamp: new Date(parseFloat(message.ts) * 1000).toISOString(),
        threadContext: threadContext
      };

      const result = await this.chain.invoke(input);
      
      // Parse the JSON response
      let classification;
      try {
        classification = JSON.parse(result);
      } catch {
        // Ignore parse error as it's only for error handling
        logger.warn('Failed to parse classification JSON, using fallback', { result });
        classification = this.getFallbackClassification(message.text);
      }

      // Validate classification
      classification = this.validateClassification(classification);

      logger.logMessageProcessing('classification_complete', message.ts, {
        category: classification.category,
        priority: classification.priority,
        confidence: classification.confidence
      });

      return classification;

    } catch (error) {
      logger.error('Error classifying message', error);
      return this.getFallbackClassification(message.text);
    }
  }

  /**
   * Validate classification result and apply defaults
   * @param {Object} classification 
   * @returns {Object} Validated classification
   */
  validateClassification(classification) {
    const validCategories = Object.values(config.messageCategories);
    const validPriorities = Object.values(config.priorityLevels);

    return {
      category: validCategories.includes(classification.category?.toLowerCase()) 
        ? classification.category.toUpperCase() 
        : 'INFO',
      priority: validPriorities.includes(classification.priority?.toLowerCase())
        ? classification.priority.toUpperCase()
        : 'MEDIUM',
      confidence: typeof classification.confidence === 'number' 
        ? Math.max(0, Math.min(1, classification.confidence))
        : 0.5,
      reason: classification.reason || 'Automatic classification'
    };
  }

  /**
   * Provide fallback classification when AI fails
   * @param {string} messageText 
   * @returns {Object} Fallback classification
   */
  getFallbackClassification(messageText = '') {
    const text = messageText.toLowerCase();
    
    // Simple keyword-based fallback - order matters!
    
    // Check for urgent first (highest priority)
    if (text.includes('urgent') || text.includes('critical') || text.includes('down') || 
        text.includes('error') || text.includes('emergency') || text.includes('immediately')) {
      return {
        category: 'URGENT',
        priority: 'HIGH',
        confidence: 0.6,
        reason: 'Fallback: Urgent keywords detected'
      };
    }
    
    // Check for meeting keywords
    if (text.includes('meeting') || text.includes('schedule') || text.includes('calendar') ||
        text.includes('discuss') || text.includes('call')) {
      return {
        category: 'MEETING',
        priority: 'MEDIUM',
        confidence: 0.5,
        reason: 'Fallback: Meeting keywords detected'
      };
    }
    
    // Check for questions (after urgent and meeting checks)
    if (text.includes('?') || text.includes('how') || text.includes('why') || 
        text.includes('help') || text.includes('what') || text.includes('when') ||
        text.includes('where') || text.includes('can you')) {
      return {
        category: 'QUESTION',
        priority: 'MEDIUM',
        confidence: 0.5,
        reason: 'Fallback: Question pattern detected'
      };
    }

    return {
      category: 'INFO',
      priority: 'LOW',
      confidence: 0.3,
      reason: 'Fallback: Default classification'
    };
  }

  /**
   * Check if message mentions the bot
   * @param {Object} message 
   * @returns {boolean}
   */
  isBotMentioned(message) {
    const text = message.text || '';
    
    // Check for username mention
    if (text.includes('@khanhtq0811')) {
      return true;
    }
    
    // Check for bot user ID mention
    const botUserId = config.slack.botUserId;
    if (botUserId && text.includes(`<@${botUserId}>`)) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract action items from message
   * @param {string} messageText 
   * @returns {Array<string>} List of action items
   */
  extractActionItems(messageText) {
    const actionKeywords = ['todo', 'task', 'action', 'need to', 'should', 'must', 'deadline'];
    
    const actionItems = [];
    const sentences = messageText.split(/[.!?]+/);
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      if (actionKeywords.some(keyword => lowerSentence.includes(keyword))) {
        actionItems.push(sentence.trim());
      }
    });
    
    return actionItems;
  }
}

module.exports = MessageClassifier;