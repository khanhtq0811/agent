# AI Slack Assistant

Trợ lý AI thông minh cho Slack - Tự động đọc, phân tích, tóm tắt và research solutions cho Slack messages.

## ✨ Tính năng

### 🔍 Phân tích tin nhắn thông minh
- **Phân loại tự động**: Urgent, Question, Info, Meeting, Discussion, Social
- **Xếp hạng ưu tiên**: High, Medium, Low
- **Phát hiện mentions**: Tự động detect khi được tag
- **Hiểu context**: Phân tích thread conversations

### 📊 Tóm tắt và báo cáo
- **Daily digest**: Tóm tắt tin nhắn quan trọng hàng ngày
- **Thread summary**: Tóm tắt các cuộc thảo luận dài
- **Action items**: Trích xuất tasks cần làm
- **Statistics**: Thống kê hoạt động và contribution

### 🤖 Phản hồi thông minh
- **Auto response**: Trả lời tự động cho mentions và DMs
- **Context aware**: Hiểu được ngữ cảnh cuộc trò chuyện
- **Professional tone**: Giữ tone chuyên nghiệp phù hợp
- **Template responses**: Câu trả lời mẫu cho các tình huống thường gặp

### 🗄️ Knowledge Base
- **Vector storage**: Lưu trữ conversations trong vector database
- **Similar search**: Tìm kiếm các vấn đề tương tự đã giải quyết
- **Learning**: Học hỏi từ conversations cũ

## 🛠️ Tech Stack

- **Node.js** + **Express** - Backend framework
- **@slack/bolt** - Slack Bot development
- **LangChain** - LLM integration và NLP
- **OpenAI GPT** - AI classification và response generation
- **ChromaDB** - Vector database cho knowledge storage
- **LangSmith** - Monitoring và optimization (optional)

## ⚡ Quick Start

### 1. Clone repository

```bash
git clone https://github.com/khanhtq0811/agent.git
cd agent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment

```bash
cp .env.example .env
```

Điền các thông tin cần thiết trong `.env`:

```env
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Bot Configuration
CHANNELS_TO_MONITOR=general,random,dev-team
ENABLE_AUTO_RESPONSE=false
```

### 4. Setup Slack App

1. Tạo Slack App tại [api.slack.com](https://api.slack.com/apps)
2. Enable **Socket Mode** và tạo App Token
3. Add **Bot Token Scopes**:
   - `app_mentions:read`
   - `channels:read`
   - `chat:write`
   - `im:read`
   - `im:write`
   - `reactions:write`
   - `users:read`
4. Install app vào workspace
5. Copy tokens vào `.env` file

### 5. Start the application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📖 Usage

### Basic Commands

Bot sẽ tự động monitor các channels được cấu hình và phản hồi khi:

- **Được mention**: `@ai-assistant help me with this issue`
- **Nhận DM**: Tin nhắn trực tiếp đến bot
- **Urgent messages**: Tin nhắn có keywords urgent (nếu auto-response enabled)

### Message Categories

Bot phân loại tin nhắn thành 6 categories:

- 🚨 **URGENT**: Cần response ngay (outage, critical bugs)
- ❓ **QUESTION**: Technical/business questions
- 📋 **INFO**: Thông tin sharing, updates
- 📅 **MEETING**: Meeting requests, scheduling
- 💭 **DISCUSSION**: Thảo luận chung
- 😊 **SOCIAL**: Casual conversations

### Priority Levels

- 🔴 **HIGH**: Cần attention ngay lập tức
- 🟡 **MEDIUM**: Quan trọng nhưng không gấp
- 🟢 **LOW**: Thông tin tham khảo

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token | Required |
| `SLACK_APP_TOKEN` | Slack App-Level Token | Required |
| `SLACK_SIGNING_SECRET` | Slack Signing Secret | Required |
| `OPENAI_API_KEY` | OpenAI API Key | Required |
| `CHANNELS_TO_MONITOR` | Comma-separated channel names | `general` |
| `ENABLE_AUTO_RESPONSE` | Auto respond to messages | `false` |
| `RESPONSE_CONFIDENCE_THRESHOLD` | Min confidence for auto response | `0.8` |
| `NODE_ENV` | Environment mode | `development` |
| `LOG_LEVEL` | Logging level | `info` |

### Monitored Channels

Để monitor thêm channels, update `CHANNELS_TO_MONITOR`:

```env
CHANNELS_TO_MONITOR=general,random,dev-team,support
```

### Auto Response

Enable auto response cho các tin nhắn có confidence cao:

```env
ENABLE_AUTO_RESPONSE=true
RESPONSE_CONFIDENCE_THRESHOLD=0.8
```

## 📊 Monitoring & Logs

### Structured Logging

Bot sử dụng structured logging với các levels:

- `error`: Lỗi hệ thống
- `warn`: Cảnh báo
- `info`: Thông tin chính
- `debug`: Chi tiết debug

### Message Processing Pipeline

Mỗi message đi qua pipeline:

1. **Classification**: AI phân loại message
2. **Storage**: Lưu vào vector database
3. **Response Check**: Quyết định có cần respond không
4. **Response Generation**: Tạo response phù hợp
5. **Action Items**: Trích xuất tasks cần làm

## 🧪 Development

### Project Structure

```
src/
├── config/           # Configuration management
├── services/         # Core business logic
│   ├── slackService.js
│   ├── messageClassifier.js
│   ├── messageProcessor.js
│   └── vectorStorage.js
├── utils/            # Utility functions
│   └── logger.js
└── index.js          # Main application
```

### Development Commands

```bash
# Start with auto-reload
npm run dev

# Run linting
npm run lint

# Fix lint issues
npm run lint:fix

# Run tests
npm test
```

### Adding New Features

1. **Message Handlers**: Add to `MessageProcessor`
2. **Slack Events**: Extend `SlackService`
3. **AI Features**: Enhance `MessageClassifier`
4. **Storage**: Modify `VectorStorageService`

## 🚀 Deployment

### Production Setup

1. **Environment**: Set `NODE_ENV=production`
2. **Vector Database**: Setup ChromaDB instance
3. **Monitoring**: Enable LangSmith integration
4. **Process Manager**: Use PM2 or similar

```bash
# Using PM2
npm install -g pm2
pm2 start src/index.js --name "ai-slack-assistant"
pm2 save
pm2 startup
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["npm", "start"]
```

### Health Checks

Bot exposes health endpoint:

```bash
curl http://localhost:3000/health
```

## 📈 Roadmap

### Phase 2: Research Engine (Coming Soon)
- [ ] Integration với Google Search API
- [ ] Stack Overflow integration
- [ ] Knowledge base expansion
- [ ] Advanced solution suggestions

### Phase 3: Advanced Features
- [ ] Multi-language support
- [ ] Voice message transcription
- [ ] Sentiment analysis
- [ ] Predictive issue detection

### Phase 4: Integrations
- [ ] JIRA/GitHub Issues integration
- [ ] Calendar integration
- [ ] Email notifications
- [ ] Dashboard & analytics

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/khanhtq0811/agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/khanhtq0811/agent/discussions)
- **Email**: khanhtq0811@gmail.com

---

Made with ❤️ by [@khanhtq0811](https://github.com/khanhtq0811)