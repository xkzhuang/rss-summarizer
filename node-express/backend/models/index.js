import sequelize from '../config/database.js';
import User from './User.js';
import Feed from './Feed.js';
import Subscription from './Subscription.js';
import Article from './Article.js';
import Summary from './Summary.js';

// Define model associations
const defineAssociations = () => {
  // User <-> Subscription (One-to-Many)
  User.hasMany(Subscription, {
    foreignKey: 'userId',
    as: 'subscriptions',
    onDelete: 'CASCADE',
  });
  
  Subscription.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
  });

  // Feed <-> Subscription (One-to-Many)
  Feed.hasMany(Subscription, {
    foreignKey: 'feedId',
    as: 'subscriptions',
    onDelete: 'CASCADE',
  });
  
  Subscription.belongsTo(Feed, {
    foreignKey: 'feedId',
    as: 'feed',
  });

  // Feed <-> Article (One-to-Many)
  Feed.hasMany(Article, {
    foreignKey: 'feedId',
    as: 'articles',
    onDelete: 'CASCADE',
  });
  
  Article.belongsTo(Feed, {
    foreignKey: 'feedId',
    as: 'feed',
  });

  // Article <-> Summary (One-to-Many)
  Article.hasMany(Summary, {
    foreignKey: 'articleId',
    as: 'summaries',
    onDelete: 'CASCADE',
  });
  
  Summary.belongsTo(Article, {
    foreignKey: 'articleId',
    as: 'article',
  });

  // Many-to-Many: User <-> Feed (through Subscription)
  User.belongsToMany(Feed, {
    through: Subscription,
    foreignKey: 'userId',
    otherKey: 'feedId',
    as: 'subscribedFeeds',
  });
  
  Feed.belongsToMany(User, {
    through: Subscription,
    foreignKey: 'feedId',
    otherKey: 'userId',
    as: 'subscribers',
  });
};

// Initialize all associations
defineAssociations();

// Database connection and sync functions
export const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};

export const syncDatabase = async (options = {}) => {
  try {
    const defaultOptions = {
      force: false,
      alter: false,
      logging: console.log,
    };
    
    const syncOptions = { ...defaultOptions, ...options };
    
    await sequelize.sync(syncOptions);
    console.log('Database synchronized successfully.');
    return true;
  } catch (error) {
    console.error('Database synchronization failed:', error);
    throw error;
  }
};

export const closeDatabaseConnection = async () => {
  try {
    await sequelize.close();
    console.log('Database connection closed successfully.');
    return true;
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw error;
  }
};

// Utility functions
export const transaction = async (callback) => {
  const t = await sequelize.transaction();
  try {
    const result = await callback(t);
    await t.commit();
    return result;
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

export const query = async (sql, options = {}) => {
  try {
    return await sequelize.query(sql, {
      type: sequelize.QueryTypes.SELECT,
      ...options,
    });
  } catch (error) {
    console.error('Query execution failed:', error);
    throw error;
  }
};

// Health check function
export const healthCheck = async () => {
  try {
    await sequelize.authenticate();
    const result = await query('SELECT 1 as health');
    return {
      database: 'healthy',
      connection: 'active',
      timestamp: new Date().toISOString(),
      result: result[0],
    };
  } catch (error) {
    return {
      database: 'unhealthy',
      connection: 'failed',
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
};

// Export models and sequelize instance
export {
  sequelize,
  User,
  Feed,
  Subscription,
  Article,
  Summary,
};

export default {
  sequelize,
  User,
  Feed,
  Subscription,
  Article,
  Summary,
  connectDatabase,
  syncDatabase,
  closeDatabaseConnection,
  transaction,
  query,
  healthCheck,
};