const MessageClassifier = require('../src/services/messageClassifier');
const config = require('../src/config');

// Mock OpenAI for testing
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn()
  }))
}));

jest.mock('@langchain/core/prompts', () => ({
  PromptTemplate: {
    fromTemplate: jest.fn().mockReturnValue({
      pipe: jest.fn().mockReturnValue({
        pipe: jest.fn().mockReturnValue({
          invoke: jest.fn()
        })
      })
    })
  }
}));

jest.mock('@langchain/core/output_parsers', () => ({
  StringOutputParser: jest.fn()
}));

describe('MessageClassifier', () => {
  let classifier;

  beforeEach(() => {
    classifier = new MessageClassifier();
  });

  describe('getFallbackClassification', () => {
    test('should classify urgent messages correctly', () => {
      const urgentMessage = 'URGENT: System is down, need help immediately';
      const result = classifier.getFallbackClassification(urgentMessage);
      
      expect(result.category).toBe('URGENT');
      expect(result.priority).toBe('HIGH');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should classify questions correctly', () => {
      const questionMessage = 'How do I fix this API issue?'; // Removed "error" keyword
      const result = classifier.getFallbackClassification(questionMessage);
      
      expect(result.category).toBe('QUESTION');
      expect(result.priority).toBe('MEDIUM');
    });

    test('should classify meeting requests correctly', () => {
      const meetingMessage = 'Can we schedule a meeting to discuss the project?';
      const result = classifier.getFallbackClassification(meetingMessage);
      
      expect(result.category).toBe('MEETING');
      expect(result.priority).toBe('MEDIUM');
    });

    test('should default to INFO for unclear messages', () => {
      const genericMessage = 'Just sharing some information here';
      const result = classifier.getFallbackClassification(genericMessage);
      
      expect(result.category).toBe('INFO');
      expect(result.priority).toBe('LOW');
    });
  });

  describe('validateClassification', () => {
    test('should validate and fix invalid categories', () => {
      const invalidClassification = {
        category: 'INVALID_CATEGORY',
        priority: 'HIGH',
        confidence: 0.8,
        reason: 'Test'
      };
      
      const result = classifier.validateClassification(invalidClassification);
      expect(result.category).toBe('INFO'); // Default fallback
    });

    test('should validate and fix invalid priorities', () => {
      const invalidClassification = {
        category: 'URGENT',
        priority: 'INVALID_PRIORITY',
        confidence: 0.8,
        reason: 'Test'
      };
      
      const result = classifier.validateClassification(invalidClassification);
      expect(result.priority).toBe('MEDIUM'); // Default fallback
    });

    test('should clamp confidence values', () => {
      const invalidClassification = {
        category: 'URGENT',
        priority: 'HIGH',
        confidence: 1.5, // Over 1.0
        reason: 'Test'
      };
      
      const result = classifier.validateClassification(invalidClassification);
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('isBotMentioned', () => {
    test('should detect bot mentions when botUserId is set', () => {
      // Set environment variable for the test
      process.env.BOT_USER_ID = 'U123456789';
      
      // Create a new classifier instance to pick up the env var
      const testClassifier = new MessageClassifier();
      
      const message = {
        text: 'Hey <@U123456789> can you help with this?'
      };
      
      const result = testClassifier.isBotMentioned(message);
      expect(result).toBe(true);
      
      // Clean up
      delete process.env.BOT_USER_ID;
    });

    test('should detect username mentions', () => {
      const message = {
        text: 'Hey @khanhtq0811 can you help with this?'
      };
      
      const result = classifier.isBotMentioned(message);
      expect(result).toBe(true);
    });

    test('should return false for no mentions', () => {
      const message = {
        text: 'This is just a regular message'
      };
      
      const result = classifier.isBotMentioned(message);
      expect(result).toBe(false);
    });

    test('should return false when no botUserId is configured', () => {
      const message = {
        text: 'Hey <@U123456789> can you help with this?'
      };
      
      // Since BOT_USER_ID is not set and this doesn't contain @khanhtq0811, should be false
      const result = classifier.isBotMentioned(message);
      expect(result).toBe(false);
    });
  });

  describe('extractActionItems', () => {
    test('should extract action items from text', () => {
      const messageText = 'We need to fix the bug. The deadline is tomorrow. John should review the code.';
      const actionItems = classifier.extractActionItems(messageText);
      
      expect(actionItems.length).toBeGreaterThan(0);
      expect(actionItems.some(item => item.includes('need to'))).toBe(true);
      expect(actionItems.some(item => item.includes('should'))).toBe(true);
    });

    test('should return empty array for no action items', () => {
      const messageText = 'Just sharing some information about the project status.';
      const actionItems = classifier.extractActionItems(messageText);
      
      expect(actionItems).toEqual([]);
    });
  });
});