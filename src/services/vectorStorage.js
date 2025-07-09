const { ChromaApi, OpenAIEmbeddingFunction } = require('chromadb');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Vector Storage Service
 * Manages conversation storage and retrieval using ChromaDB
 */
class VectorStorageService {
  constructor() {
    this.client = null;
    this.collection = null;
    this.embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: config.openai.apiKey
    });
    this.isInitialized = false;
  }

  /**
   * Initialize the vector database connection
   */
  async initialize() {
    try {
      // For development, we'll use in-memory storage
      // In production, you would connect to a running ChromaDB instance
      this.client = new ChromaApi({
        path: config.vectorDb.host === 'localhost' ? undefined : `http://${config.vectorDb.host}:${config.vectorDb.port}`
      });

      // Get or create collection
      try {
        this.collection = await this.client.getCollection({
          name: config.vectorDb.collectionName,
          embeddingFunction: this.embeddingFunction
        });
        logger.info('Connected to existing collection', { 
          name: config.vectorDb.collectionName 
        });
      } catch {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: config.vectorDb.collectionName,
          embeddingFunction: this.embeddingFunction,
          metadata: {
            description: 'Slack conversations for AI assistant',
            created_at: new Date().toISOString()
          }
        });
        logger.info('Created new collection', { 
          name: config.vectorDb.collectionName 
        });
      }

      this.isInitialized = true;
      logger.info('Vector storage initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize vector storage', error);
      // For development, continue without vector storage
      logger.warn('Continuing without vector storage - conversations will not be persisted');
      this.isInitialized = false;
    }
  }

  /**
   * Store a conversation message
   * @param {Object} message - Message data
   * @param {Object} classification - Message classification
   */
  async storeMessage(message, classification) {
    if (!this.isInitialized) {
      logger.debug('Vector storage not initialized, skipping message storage');
      return;
    }

    try {
      const messageId = `${message.channel}_${message.ts}`;
      const messageText = message.text || '';
      
      // Prepare metadata
      const metadata = {
        channel: message.channel,
        user: message.user,
        timestamp: message.ts,
        category: classification.category,
        priority: classification.priority,
        confidence: classification.confidence,
        is_mention: message.isMention || false,
        thread_ts: message.thread_ts || null,
        stored_at: new Date().toISOString()
      };

      // Add to collection
      await this.collection.add({
        ids: [messageId],
        documents: [messageText],
        metadatas: [metadata]
      });

      logger.debug('Message stored in vector database', { 
        messageId, 
        category: classification.category 
      });

    } catch (error) {
      logger.error('Error storing message in vector database', error);
    }
  }

  /**
   * Search for similar messages
   * @param {string} query - Search query
   * @param {number} limit - Number of results to return
   * @param {Object} filters - Metadata filters
   * @returns {Promise<Array>} Similar messages
   */
  async searchSimilarMessages(query, limit = 5, filters = {}) {
    if (!this.isInitialized) {
      logger.debug('Vector storage not initialized, returning empty results');
      return [];
    }

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
        where: filters
      });

      if (results.documents && results.documents[0]) {
        return results.documents[0].map((doc, index) => ({
          document: doc,
          metadata: results.metadatas[0][index],
          distance: results.distances[0][index],
          id: results.ids[0][index]
        }));
      }

      return [];

    } catch (error) {
      logger.error('Error searching similar messages', error);
      return [];
    }
  }

  /**
   * Get messages by category
   * @param {string} category - Message category
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Messages in category
   */
  async getMessagesByCategory(category, limit = 10) {
    return this.searchSimilarMessages('', limit, { category: category });
  }

  /**
   * Get recent messages from a channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Array>} Recent messages
   */
  async getRecentChannelMessages(channelId) {
    const hoursBack = 24;
    const hoursAgo = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
    
    return this.searchSimilarMessages('', 20, {
      channel: channelId,
      stored_at: { '$gte': hoursAgo }
    });
  }

  /**
   * Get urgent messages that need attention
   * @returns {Promise<Array>} Urgent messages
   */
  async getUrgentMessages() {
    return this.getMessagesByCategory('URGENT', 10);
  }

  /**
   * Get unanswered questions
   * @returns {Promise<Array>} Unanswered questions
   */
  async getUnansweredQuestions() {
    // This is a simplified version - in a real implementation,
    // you'd track which questions have been answered
    return this.getMessagesByCategory('QUESTION', 15);
  }

  /**
   * Get collection statistics
   * @returns {Promise<Object>} Collection stats
   */
  async getStats() {
    if (!this.isInitialized) {
      return { total_messages: 0, initialized: false };
    }

    try {
      const count = await this.collection.count();
      return {
        total_messages: count,
        initialized: true,
        collection_name: config.vectorDb.collectionName
      };
    } catch (error) {
      logger.error('Error getting collection stats', error);
      return { total_messages: 0, initialized: false, error: error.message };
    }
  }

  /**
   * Clear old messages (data cleanup)
   * @param {number} days - Days to keep
   */
  async cleanupOldMessages(days = 30) {
    if (!this.isInitialized) return;

    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      // Get old messages
      const oldMessages = await this.searchSimilarMessages('', 1000, {
        stored_at: { '$lt': cutoffDate }
      });

      if (oldMessages.length > 0) {
        const idsToDelete = oldMessages.map(msg => msg.id);
        await this.collection.delete({ ids: idsToDelete });
        
        logger.info('Cleaned up old messages', { 
          deleted_count: idsToDelete.length,
          cutoff_date: cutoffDate 
        });
      }

    } catch (error) {
      logger.error('Error cleaning up old messages', error);
    }
  }

  /**
   * Close the database connection
   */
  async close() {
    if (this.client) {
      // ChromaDB doesn't require explicit closing in most cases
      this.isInitialized = false;
      logger.info('Vector storage connection closed');
    }
  }
}

module.exports = VectorStorageService;