import sequelize from '../config/database.js';

/**
 * Transaction Middleware
 * Automatically wraps selected routes in database transactions
 */
export const withTransaction = (options = {}) => {
  const defaultOptions = {
    isolationLevel: 'READ_COMMITTED',
    autocommit: true,
    logging: process.env.NODE_ENV === 'development',
  };

  const transactionOptions = { ...defaultOptions, ...options };

  return async (req, res, next) => {
    try {
      // Start transaction
      const result = await sequelize.transaction(async (t) => {
        // Attach transaction to request object
        req.transaction = t;
        req.dbTransaction = t; // Alternative property name
        
        // Continue with the request
        await new Promise((resolve, reject) => {
          const originalSend = res.send;
          const originalJson = res.json;
          const originalEnd = res.end;
          
          // Override response methods to capture completion
          res.send = function(data) {
            res.transactionResult = { type: 'send', data };
            resolve();
            return originalSend.call(this, data);
          };
          
          res.json = function(data) {
            res.transactionResult = { type: 'json', data };
            resolve();
            return originalJson.call(this, data);
          };
          
          res.end = function(data) {
            res.transactionResult = { type: 'end', data };
            resolve();
            return originalEnd.call(this, data);
          };

          // Handle next() call
          const originalNext = next;
          next = (error) => {
            if (error) {
              reject(error);
            } else {
              // If next() is called without error, continue middleware chain
              originalNext();
            }
          };

          next();
        });

        // Check if response indicates error
        if (res.statusCode >= 400) {
          throw new Error(`Transaction rolled back due to error status: ${res.statusCode}`);
        }

        return res.transactionResult;
      });

      // Transaction completed successfully
      req.transactionCompleted = true;
      
    } catch (error) {
      console.error('Transaction middleware error:', error);
      
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: 'Transaction failed',
          error: process.env.NODE_ENV === 'development' ? error.message : 'TRANSACTION_FAILED',
        });
      }
    }
  };
};

/**
 * Conditional Transaction Middleware
 * Only creates transaction for specific HTTP methods
 */
export const withConditionalTransaction = (methods = ['POST', 'PUT', 'PATCH', 'DELETE'], options = {}) => {
  return (req, res, next) => {
    if (methods.includes(req.method)) {
      return withTransaction(options)(req, res, next);
    }
    next();
  };
};

/**
 * Bulk Operation Transaction Middleware
 * Optimized for bulk operations
 */
export const withBulkTransaction = (options = {}) => {
  const bulkOptions = {
    isolationLevel: 'REPEATABLE_READ',
    autocommit: false,
    logging: false,
    ...options,
  };

  return withTransaction(bulkOptions);
};

/**
 * Read-only Transaction Middleware
 * For complex read operations that need consistent snapshots
 */
export const withReadTransaction = (options = {}) => {
  const readOptions = {
    isolationLevel: 'READ_COMMITTED',
    readOnly: true,
    deferrable: true,
    ...options,
  };

  return withTransaction(readOptions);
};

/**
 * Rollback-only Transaction Middleware
 * For testing purposes - always rolls back
 */
export const withRollbackTransaction = (options = {}) => {
  return async (req, res, next) => {
    try {
      await sequelize.transaction(async (t) => {
        req.transaction = t;
        
        await new Promise((resolve, reject) => {
          const originalNext = next;
          next = (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          };
          originalNext();
        });

        // Always rollback for testing
        throw new Error('Intentional rollback for testing');
      });
    } catch (error) {
      if (error.message !== 'Intentional rollback for testing') {
        console.error('Rollback transaction error:', error);
      }
      
      // Continue normally even after rollback
      next();
    }
  };
};

/**
 * Transaction Status Middleware
 * Adds transaction status to response headers
 */
export const addTransactionStatus = (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function(data) {
    if (req.transaction) {
      res.setHeader('X-Transaction-Status', req.transactionCompleted ? 'committed' : 'pending');
      res.setHeader('X-Transaction-ID', req.transaction.id || 'unknown');
    }
    return originalSend.call(this, data);
  };

  res.json = function(data) {
    if (req.transaction) {
      res.setHeader('X-Transaction-Status', req.transactionCompleted ? 'committed' : 'pending');
      res.setHeader('X-Transaction-ID', req.transaction.id || 'unknown');
    }
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Transaction Error Recovery Middleware
 * Provides automatic retry logic for failed transactions
 */
export const withTransactionRetry = (maxRetries = 3, retryDelay = 1000) => {
  return (req, res, next) => {
    const executeWithRetry = async (attempt = 1) => {
      try {
        return await withTransaction()(req, res, next);
      } catch (error) {
        if (attempt <= maxRetries && isRetryableError(error)) {
          console.warn(`Transaction attempt ${attempt} failed, retrying...`, error.message);
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          
          return executeWithRetry(attempt + 1);
        }
        
        throw error;
      }
    };

    return executeWithRetry();
  };
};

/**
 * Check if error is retryable
 */
const isRetryableError = (error) => {
  const retryableErrors = [
    'SequelizeConnectionTimedOutError',
    'SequelizeConnectionRefusedError',
    'SequelizeHostNotReachableError',
    'SequelizeConnectionError',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ];

  return retryableErrors.some(errorType => 
    error.name === errorType || 
    error.code === errorType ||
    error.message.includes(errorType)
  );
};

/**
 * Transaction Pool Middleware
 * Manages transaction pool for high-concurrency scenarios
 */
export class TransactionPool {
  constructor(maxPoolSize = 10) {
    this.maxPoolSize = maxPoolSize;
    this.activeTransactions = new Map();
    this.waitingQueue = [];
  }

  middleware() {
    return async (req, res, next) => {
      if (this.activeTransactions.size >= this.maxPoolSize) {
        // Add to waiting queue
        await new Promise((resolve) => {
          this.waitingQueue.push(resolve);
        });
      }

      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        await sequelize.transaction(async (t) => {
          this.activeTransactions.set(transactionId, t);
          req.transaction = t;
          req.transactionId = transactionId;
          
          await new Promise((resolve, reject) => {
            const originalNext = next;
            next = (error) => {
              if (error) reject(error);
              else resolve();
            };
            originalNext();
          });
        });
      } finally {
        this.activeTransactions.delete(transactionId);
        
        // Process waiting queue
        if (this.waitingQueue.length > 0) {
          const nextResolve = this.waitingQueue.shift();
          nextResolve();
        }
      }
    };
  }

  getStats() {
    return {
      active: this.activeTransactions.size,
      waiting: this.waitingQueue.length,
      maxPoolSize: this.maxPoolSize,
    };
  }
}

export default {
  withTransaction,
  withConditionalTransaction,
  withBulkTransaction,
  withReadTransaction,
  withRollbackTransaction,
  addTransactionStatus,
  withTransactionRetry,
  TransactionPool,
};