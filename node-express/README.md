# RSS Feed Summarization Platform

A professional-level Node.js + Express.js application for multi-user RSS/Atom feed summarization using OpenAI GPT models.

## Features

- **Multi-user Authentication**: JWT-based authentication with user registration and login
- **RSS/Atom Feed Processing**: Automatic fetching and parsing of RSS/Atom feeds
- **AI-Powered Summaries**: Generate article summaries using OpenAI GPT models
- **Flexible API Key Management**: Support system-wide or per-user OpenAI API keys
- **Modular Architecture**: Clean separation of concerns with controllers, services, models
- **Transaction Support**: Database transactions for data consistency
- **Comprehensive Error Handling**: Centralized error handling with proper logging
- **Rate Limiting**: Protection against abuse
- **Security**: Helmet.js, CORS, input validation, and secure password handling

## Architecture

```
backend/
├── app.js                 # Main application entry point
├── config/
│   └── database.js        # Database configuration
├── controllers/           # Route handlers
│   └── AuthController.js  # Authentication endpoints
├── middlewares/           # Express middleware
│   ├── auth.js           # JWT authentication
│   ├── transaction.js    # Database transactions
│   └── errorHandler.js   # Error handling & logging
├── models/               # Sequelize models
│   ├── BaseModel.js     # Base model with common functionality
│   ├── User.js          # User model
│   ├── Feed.js          # RSS feed model
│   ├── Subscription.js  # User-feed subscriptions
│   ├── Article.js       # Article model
│   ├── Summary.js       # AI-generated summaries
│   └── index.js         # Model associations
├── services/            # Business logic
│   ├── AuthService.js   # Authentication logic
│   └── SummaryService.js # AI summarization logic
├── jobs/                # Background jobs
├── utils/               # Utility functions
└── frontend/            # Vue.js frontend (to be implemented)
```

## Models

### User
- id, username, email, passwordHash, role, timestamps
- Encrypted OpenAI API key storage
- JWT token generation and verification

### Feed
- id, url, title, description, lastFetched, timestamps
- RSS/Atom feed validation and parsing
- Error tracking and retry logic

### Subscription
- id, userId, feedId, timestamps
- Many-to-many relationship between users and feeds

### Article
- id, feedId, title, link, pubDate, rawContent, timestamps
- Duplicate detection and content management

### Summary
- id, articleId, summaryText, aiModel, timestamps
- Token count and cost tracking
- Multiple AI model support

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Refresh JWT token
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/password` - Change password
- `PUT /api/auth/openai-key` - Set OpenAI API key
- `DELETE /api/auth/account` - Delete user account

### Testing Endpoints
- `GET /api/public/test` - Public test endpoint
- `GET /api/protected/test` - Protected test endpoint
- `GET /health` - Health check

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- MariaDB/MySQL
- OpenAI API key

### Installation

1. **Clone and navigate to project**
   ```bash
   cd /path/to/project/node-express
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database and API credentials
   ```

4. **Set up database**
   - Create a MySQL/MariaDB database
   - Update database credentials in `.env`

5. **Start the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Variables

Key environment variables to configure:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=127.0.0.1
DB_NAME=rss_summarization_dev
DB_USER=root
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Security
ENCRYPTION_KEY=your-32-character-encryption-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

## Development

### Running Tests
```bash
npm test
```

### Database Operations
The application will automatically:
- Connect to the database on startup
- Create/update tables as needed
- Set up model associations

### Adding New Features

1. **Models**: Extend `BaseModel` for new entities
2. **Services**: Business logic goes in service classes
3. **Controllers**: Route handlers that call services
4. **Middleware**: Cross-cutting concerns

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Stateless authentication
- **API Key Encryption**: User OpenAI keys encrypted at rest
- **Rate Limiting**: Protection against brute force
- **Input Validation**: Sanitization and validation
- **CORS Protection**: Configurable origins
- **Helmet.js**: Security headers

## Deployment

### Production Checklist

- [ ] Set strong `JWT_SECRET` and `ENCRYPTION_KEY`
- [ ] Configure proper database credentials
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS origins
- [ ] Set up SSL/TLS
- [ ] Configure reverse proxy (nginx)
- [ ] Set up monitoring and logging
- [ ] Configure backups

### Docker Support
(Docker configuration can be added based on requirements)

## Next Steps

1. **Feed Management**: Add controllers and services for RSS feed management
2. **Background Jobs**: Implement cron jobs for feed polling and summarization
3. **Frontend**: Build Vue.js dashboard and user interface
4. **Advanced Features**: 
   - Email notifications
   - Feed categorization
   - Summary quality metrics
   - Admin dashboard

## API Testing

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "Test123!@#"
  }'
```

### Access Protected Endpoint
```bash
curl -X GET http://localhost:3000/api/protected/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Contributing

1. Follow the established architecture patterns
2. Add tests for new features
3. Update documentation
4. Use the transaction middleware for data operations
5. Handle errors properly with the error handling system

## License

MIT License - see LICENSE file for details.