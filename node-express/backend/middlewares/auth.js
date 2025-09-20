import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user to request object
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        error: 'MISSING_TOKEN',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['passwordHash'] },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found',
        error: 'INVALID_TOKEN',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        error: 'INVALID_TOKEN',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        error: 'TOKEN_EXPIRED',
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication',
      error: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user to request if token is provided, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['passwordHash'] },
    });

    req.user = user || null;
    next();
  } catch (error) {
    // For optional auth, we don't return errors - just set user to null
    req.user = null;
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED',
      });
    }

    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_PERMISSIONS',
        required: requiredRoles,
        current: userRoles,
      });
    }

    next();
  };
};

/**
 * Admin-only middleware
 */
export const requireAdmin = requireRole('admin');

/**
 * User ownership verification middleware
 * Ensures user can only access their own resources
 */
export const requireOwnership = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTHENTICATION_REQUIRED',
      });
    }

    const requestedUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];
    
    // Admin can access any user's resources
    if (req.user.role === 'admin') {
      return next();
    }

    // User can only access their own resources
    if (parseInt(requestedUserId) !== parseInt(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own resources',
        error: 'OWNERSHIP_REQUIRED',
      });
    }

    next();
  };
};

/**
 * Rate limiting based on user
 */
export const createUserRateLimit = (windowMs, maxRequests, skipSuccessfulRequests = true) => {
  const userRequests = new Map();

  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create user's request history
    let requests = userRequests.get(userId) || [];
    
    // Filter out old requests
    requests = requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (requests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests',
        error: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000),
      });
    }

    // Add current request
    requests.push(now);
    userRequests.set(userId, requests);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      for (const [key, value] of userRequests) {
        const filteredRequests = value.filter(timestamp => timestamp > windowStart);
        if (filteredRequests.length === 0) {
          userRequests.delete(key);
        } else {
          userRequests.set(key, filteredRequests);
        }
      }
    }

    next();
  };
};

/**
 * Validate API key middleware (for external API access)
 */
export const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required',
      error: 'MISSING_API_KEY',
    });
  }

  // In production, store API keys in database with proper hashing
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key',
      error: 'INVALID_API_KEY',
    });
  }

  req.apiAccess = true;
  next();
};

export default {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireOwnership,
  createUserRateLimit,
  validateApiKey,
};