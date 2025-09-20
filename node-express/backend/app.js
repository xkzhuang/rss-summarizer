import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import middleware
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
  addRequestId,
  setupGracefulShutdown,
} from './middlewares/errorHandler.js';
import { authenticateToken, optionalAuth } from './middlewares/auth.js';
import { withTransaction } from './middlewares/transaction.js';

// Import models and database
import { connectDatabase, syncDatabase } from './models/index.js';

// Import services
import ArticleScheduler from './services/ArticleScheduler.js';

// Import controllers
import AuthController from './controllers/AuthController.js';
import FeedController from './controllers/FeedController.js';
import SubscriptionController from './controllers/SubscriptionController.js';
import ArticleController from './controllers/ArticleController.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8081', 'http://127.0.0.1:8081'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting - only apply if enabled via configuration
const isRateLimitingEnabled = process.env.ENABLE_RATE_LIMITING === 'true';
if (isRateLimitingEnabled) {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      error: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
  console.log('✅ Rate limiting enabled');
} else {
  console.log('⚠️  Rate limiting disabled');
}

// Compression and parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request middleware
app.use(addRequestId);
if (process.env.NODE_ENV === 'development') {
  app.use(requestLogger);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Routes
const apiRouter = express.Router();

// Auth routes
apiRouter.post('/auth/register', withTransaction(), AuthController.register);
apiRouter.post('/auth/login', AuthController.login);
apiRouter.post('/auth/refresh-token', AuthController.refreshToken);
apiRouter.post('/auth/logout', authenticateToken, AuthController.logout);

// Protected auth routes
apiRouter.get('/auth/profile', authenticateToken, AuthController.getProfile);
apiRouter.put('/auth/profile', authenticateToken, withTransaction(), AuthController.updateProfile);
apiRouter.put('/auth/password', authenticateToken, withTransaction(), AuthController.changePassword);
apiRouter.put('/auth/openai-key', authenticateToken, withTransaction(), AuthController.setOpenAIKey);
apiRouter.delete('/auth/account', authenticateToken, withTransaction(), AuthController.deleteAccount);

// Admin routes
apiRouter.get('/auth/users/search', authenticateToken, AuthController.searchUsers);
apiRouter.get('/auth/users/:userId', authenticateToken, AuthController.getUserById);

// Feed routes
apiRouter.post('/feeds', authenticateToken, withTransaction(), FeedController.createFeed);
apiRouter.get('/feeds', optionalAuth, FeedController.getAllFeeds);
apiRouter.get('/feeds/user', authenticateToken, FeedController.getUserFeeds);
apiRouter.get('/feeds/:feedId', optionalAuth, FeedController.getFeedById);
apiRouter.put('/feeds/:feedId', authenticateToken, withTransaction(), FeedController.updateFeed);
apiRouter.delete('/feeds/:feedId', authenticateToken, withTransaction(), FeedController.deleteFeed);
apiRouter.post('/feeds/:feedId/subscribe', authenticateToken, withTransaction(), FeedController.subscribeFeed);
apiRouter.delete('/feeds/:feedId/subscribe', authenticateToken, withTransaction(), FeedController.unsubscribeFeed);
apiRouter.post('/feeds/validate', authenticateToken, FeedController.validateFeedUrl);
apiRouter.post('/feeds/:feedId/fetch', authenticateToken, FeedController.fetchFeedArticles);
apiRouter.post('/feeds/fetch-all', authenticateToken, FeedController.fetchAllFeedArticles);

// Scheduler routes (admin only)
apiRouter.get('/scheduler/status', authenticateToken, (req, res) => {
  try {
    const status = ArticleScheduler.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/scheduler/trigger-fetch', authenticateToken, async (req, res) => {
  try {
    const result = await ArticleScheduler.triggerFetch();
    res.json({ success: true, message: 'Article fetch triggered successfully', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

apiRouter.post('/scheduler/trigger-cleanup', authenticateToken, async (req, res) => {
  try {
    const { daysToKeep } = req.body;
    const result = await ArticleScheduler.triggerCleanup(daysToKeep);
    res.json({ success: true, message: 'Cleanup triggered successfully', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Subscription routes
apiRouter.get('/subscriptions/stats', authenticateToken, SubscriptionController.getSubscriptionStats);
apiRouter.get('/subscriptions', authenticateToken, SubscriptionController.getUserSubscriptions);
apiRouter.post('/subscriptions', authenticateToken, withTransaction(), SubscriptionController.subscribeToFeed);
apiRouter.post('/subscriptions/bulk', authenticateToken, withTransaction(), SubscriptionController.bulkSubscribe);
apiRouter.delete('/subscriptions/:feedId', authenticateToken, withTransaction(), SubscriptionController.unsubscribeFromFeed);
apiRouter.get('/subscriptions/:feedId', authenticateToken, SubscriptionController.getSubscription);
apiRouter.put('/subscriptions/:feedId', authenticateToken, withTransaction(), SubscriptionController.updateSubscription);

// Article routes
apiRouter.get('/articles', optionalAuth, ArticleController.getArticles);
apiRouter.get('/articles/:id', optionalAuth, ArticleController.getArticle);
apiRouter.get('/articles/:id/content', optionalAuth, ArticleController.getArticleContent);
apiRouter.post('/articles/:id/summarize', authenticateToken, ArticleController.summarizeArticle);
apiRouter.get('/articles/:id/summaries', optionalAuth, ArticleController.getArticleSummaries);
apiRouter.delete('/articles/:id', authenticateToken, withTransaction(), ArticleController.deleteArticle);
apiRouter.post('/articles/bulk-summarize', authenticateToken, withTransaction(), ArticleController.bulkSummarizeArticles);

// Public routes for testing
apiRouter.get('/public/test', (req, res) => {
  res.json({
    success: true,
    message: 'Public endpoint working',
    timestamp: new Date().toISOString(),
  });
});

// Protected routes for testing
apiRouter.get('/protected/test', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Protected endpoint working',
    user: req.user.username,
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use('/api', apiRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Sync database (create tables)
    await syncDatabase({
      alter: false, // Disable alter to prevent schema conflicts
      force: false,
    });

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📚 API documentation available at http://localhost:${PORT}/api`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Initialize Article Scheduler
    ArticleScheduler.init();

    // Setup graceful shutdown
    setupGracefulShutdown(app, server);

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export default app;
export { startServer };