import { DataTypes } from 'sequelize';
import BaseModel from './BaseModel.js';

class Subscription extends BaseModel {
  /**
   * Check if user is already subscribed to a feed
   */
  static async isUserSubscribed(userId, feedId) {
    const subscription = await this.findOne({
      where: { userId, feedId },
    });
    return !!subscription;
  }

  /**
   * Subscribe user to feed
   */
  static async subscribeUserToFeed(userId, feedId, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    // Check if already subscribed
    const existing = await this.findOne({
      where: { userId, feedId },
      ...options,
    });
    
    if (existing) {
      throw new Error('User is already subscribed to this feed');
    }
    
    return await this.create({ userId, feedId }, options);
  }

  /**
   * Unsubscribe user from feed
   */
  static async unsubscribeUserFromFeed(userId, feedId, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    const subscription = await this.findOne({
      where: { userId, feedId },
      ...options,
    });
    
    if (!subscription) {
      throw new Error('User is not subscribed to this feed');
    }
    
    await subscription.destroy(options);
    return true;
  }

  /**
   * Get user's subscriptions with feed details
   */
  static async getUserSubscriptions(userId, includeFeeds = true) {
    const options = {
      where: { userId },
      order: [['createdAt', 'DESC']],
    };
    
    if (includeFeeds) {
      const { Feed } = await import('./index.js');
      options.include = [
        {
          model: Feed,
          as: 'feed',
          where: { isActive: true },
        },
      ];
    }
    
    return await this.findAll(options);
  }

  /**
   * Get feed subscribers
   */
  static async getFeedSubscribers(feedId) {
    const { User } = await import('./index.js');
    return await this.findAll({
      where: { feedId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email'],
        },
      ],
    });
  }

  /**
   * Get subscription statistics for a user
   */
  static async getUserSubscriptionStats(userId) {
    const sequelize = (await import('../config/database.js')).default;
    const { Feed, Article } = await import('./index.js');
    
    const subscriptions = await this.findAll({
      where: { userId },
      include: [
        {
          model: Feed,
          as: 'feed',
          include: [
            {
              model: Article,
              as: 'articles',
              attributes: [],
            },
          ],
        },
      ],
      attributes: {
        include: [
          [
            sequelize.fn('COUNT', sequelize.col('feed.articles.id')),
            'articleCount'
          ],
        ],
      },
      group: ['Subscription.id', 'feed.id'],
      raw: false,
    });
    
    return {
      totalSubscriptions: subscriptions.length,
      totalArticles: subscriptions.reduce((sum, sub) => sum + (parseInt(sub.get('articleCount')) || 0), 0),
      subscriptions,
    };
  }

  /**
   * Bulk subscribe user to multiple feeds
   */
  static async bulkSubscribe(userId, feedIds, transaction = null) {
    const options = transaction ? { transaction } : {};
    
    // Filter out feeds user is already subscribed to
    const existingSubscriptions = await this.findAll({
      where: {
        userId,
        feedId: feedIds,
      },
      attributes: ['feedId'],
      ...options,
    });
    
    const existingFeedIds = existingSubscriptions.map(sub => sub.feedId);
    const newFeedIds = feedIds.filter(id => !existingFeedIds.includes(id));
    
    if (newFeedIds.length === 0) {
      return [];
    }
    
    const subscriptionData = newFeedIds.map(feedId => ({
      userId,
      feedId,
    }));
    
    return await this.bulkCreate(subscriptionData, options);
  }

  /**
   * Get trending feeds based on recent subscriptions
   */
  static async getTrendingFeeds(limit = 10, days = 7) {
    const { Op } = await import('sequelize');
    const sequelize = (await import('../config/database.js')).default;
    const { Feed } = await import('./index.js');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await Feed.findAll({
      attributes: {
        include: [
          [
            sequelize.fn('COUNT', sequelize.col('subscriptions.id')),
            'recentSubscriptions'
          ],
        ],
      },
      include: [
        {
          model: this,
          as: 'subscriptions',
          where: {
            createdAt: {
              [Op.gte]: startDate,
            },
          },
          attributes: [],
        },
      ],
      group: ['Feed.id'],
      order: [
        [sequelize.fn('COUNT', sequelize.col('subscriptions.id')), 'DESC'],
      ],
      limit,
    });
  }
}

// Initialize the Subscription model
Subscription.initModel('Subscription', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  feedId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'feeds',
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  notificationsEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
}, {
  indexes: [
    {
      unique: true,
      fields: ['userId', 'feedId'],
    },
  ],
});

export default Subscription;