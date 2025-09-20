import winston from 'winston';

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'rss-summarization-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Global Error Handler Middleware
 * Catches and handles all unhandled errors
 */
export const errorHandler = (error, req, res, next) => {
  // Log the error
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
  });

  // Determine error type and response
  let status = 500;
  let message = 'Internal server error';
  let errorCode = 'INTERNAL_ERROR';
  let details = null;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    errorCode = 'VALIDATION_ERROR';
    details = error.errors || error.details;
  } else if (error.name === 'SequelizeValidationError') {
    status = 400;
    message = 'Database validation error';
    errorCode = 'DATABASE_VALIDATION_ERROR';
    details = error.errors?.map(e => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
  } else if (error.name === 'SequelizeUniqueConstraintError') {
    status = 409;
    message = 'Resource already exists';
    errorCode = 'DUPLICATE_RESOURCE';
    details = error.errors?.map(e => ({
      field: e.path,
      message: e.message,
    }));
  } else if (error.name === 'SequelizeForeignKeyConstraintError') {
    status = 400;
    message = 'Invalid reference to related resource';
    errorCode = 'FOREIGN_KEY_ERROR';
  } else if (error.name === 'SequelizeDatabaseError') {
    status = 500;
    message = 'Database error';
    errorCode = 'DATABASE_ERROR';
  } else if (error.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
    errorCode = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
  } else if (error.name === 'MulterError') {
    status = 400;
    message = 'File upload error';
    errorCode = 'UPLOAD_ERROR';
    details = { code: error.code, field: error.field };
  } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    status = 503;
    message = 'External service unavailable';
    errorCode = 'SERVICE_UNAVAILABLE';
  } else if (error.status && error.status < 500) {
    status = error.status;
    message = error.message;
    errorCode = error.code || 'CLIENT_ERROR';
  }

  // Prepare response
  const response = {
    success: false,
    message,
    error: errorCode,
    ...(details && { details }),
  };

  // Add error ID for tracking
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  response.errorId = errorId;

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
    response.originalError = error.message;
  }

  // Log error with ID for tracking
  logger.error('Error response sent:', { errorId, status, errorCode, message });

  res.status(status).json(response);
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
};

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch rejected promises
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Request Logging Middleware
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    requestId: req.id,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed:', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.id,
      requestId: req.id,
    });

    originalEnd.apply(this, args);
  };

  next();
};

/**
 * Request ID Middleware
 * Adds unique ID to each request
 */
export const addRequestId = (req, res, next) => {
  req.id = req.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
};

/**
 * CORS Error Handler
 */
export const corsErrorHandler = (req, res, next) => {
  const origin = req.get('Origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  
  if (origin && !allowedOrigins.includes(origin)) {
    const error = new Error('CORS policy violation');
    error.status = 403;
    error.code = 'CORS_ERROR';
    return next(error);
  }
  
  next();
};

/**
 * Rate Limit Error Handler
 */
export const rateLimitErrorHandler = (req, res, next) => {
  if (req.rateLimit && req.rateLimit.remaining === 0) {
    const error = new Error('Rate limit exceeded');
    error.status = 429;
    error.code = 'RATE_LIMIT_EXCEEDED';
    error.retryAfter = req.rateLimit.resetTime;
    return next(error);
  }
  
  next();
};

/**
 * Validation Error Handler
 */
export const validationErrorHandler = async (req, res, next) => {
  // This middleware can be used with express-validator
  try {
    const { validationResult } = await import('express-validator');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.status = 400;
      error.details = errors.array();
      return next(error);
    }
    
    next();
  } catch (importError) {
    // express-validator not installed, skip validation
    next();
  }
};

/**
 * Database Connection Error Handler
 */
export const databaseErrorHandler = async (req, res, next) => {
  // Check database connection before processing request
  try {
    const { healthCheck } = await import('../models/index.js');
    
    const health = await healthCheck();
    if (health.database !== 'healthy') {
      const error = new Error('Database unavailable');
      error.status = 503;
      error.code = 'DATABASE_UNAVAILABLE';
      return next(error);
    }
    next();
  } catch (error) {
    error.status = 503;
    error.code = 'DATABASE_CONNECTION_ERROR';
    next(error);
  }
};

/**
 * Memory Usage Monitor
 */
export const memoryMonitor = (req, res, next) => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  // Log memory usage if it's high
  if (heapUsedMB > 500) { // 500MB threshold
    logger.warn('High memory usage detected:', {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      url: req.originalUrl,
    });
  }
  
  // Add memory info to response headers in development
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('X-Memory-Usage', `${heapUsedMB}MB`);
  }
  
  next();
};

/**
 * Graceful Shutdown Handler
 */
export const setupGracefulShutdown = (app, server) => {
  const shutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown:', err);
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };
  
  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
};

export { logger };

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  requestLogger,
  addRequestId,
  corsErrorHandler,
  rateLimitErrorHandler,
  validationErrorHandler,
  databaseErrorHandler,
  memoryMonitor,
  setupGracefulShutdown,
  logger,
};