import { DataTypes } from 'sequelize';
import BaseModel from './BaseModel.js';

class Summary extends BaseModel {
  /**
   * Get summary by article ID
   */
  static async getByArticle(articleId, aiModel = null) {
    const whereClause = { articleId };
    if (aiModel) {
      whereClause.aiModel = aiModel;
    }
    
    return await this.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Get latest summary for article
   */
  static async getLatestByArticle(articleId, aiModel = null) {
    const whereClause = { articleId };
    if (aiModel) {
      whereClause.aiModel = aiModel;
    }
    
    return await this.findOne({
      where: whereClause,
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Create or update summary for article
   */
  static async createOrUpdate(articleId, summaryText, aiModel, metadata = {}) {
    const existing = await this.findOne({
      where: { articleId, aiModel },
    });
    
    if (existing) {
      return await existing.updateSafe({
        summaryText,
        metadata,
        updatedAt: new Date(),
      });
    }
    
    return await this.create({
      articleId,
      summaryText,
      aiModel,
      metadata,
    });
  }

  /**
   * Get summaries with article details
   */
  static async getSummariesWithArticles(limit = 50, offset = 0, aiModel = null) {
    const { Article, Feed } = await import('./index.js');
    
    const whereClause = {};
    if (aiModel) {
      whereClause.aiModel = aiModel;
    }
    
    return await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Article,
          as: 'article',
          include: [
            {
              model: Feed,
              as: 'feed',
              attributes: ['id', 'title', 'url'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  }

  /**
   * Get summaries for user's subscribed feeds
   */
  static async getUserFeedSummaries(userId, limit = 30, offset = 0, aiModel = null) {
    const { Article, Feed, Subscription } = await import('./index.js');
    
    const whereClause = {};
    if (aiModel) {
      whereClause.aiModel = aiModel;
    }
    
    return await this.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Article,
          as: 'article',
          include: [
            {
              model: Feed,
              as: 'feed',
              attributes: ['id', 'title', 'url'],
              include: [
                {
                  model: Subscription,
                  as: 'subscriptions',
                  where: { userId },
                  attributes: [],
                },
              ],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  }

  /**
   * Get summary statistics by AI model
   */
  static async getStatsByModel() {
    const sequelize = (await import('../config/database.js')).default;
    
    return await this.findAll({
      attributes: [
        'aiModel',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.fn('LENGTH', sequelize.col('summaryText'))), 'avgLength'],
      ],
      group: ['aiModel'],
      order: [['count', 'DESC']],
    });
  }

  /**
   * Search summaries by content
   */
  static async searchSummaries(query, limit = 20, aiModel = null) {
    const { Op } = await import('sequelize');
    const { Article, Feed } = await import('./index.js');
    
    const whereClause = {
      summaryText: { [Op.iLike]: `%${query}%` },
    };
    
    if (aiModel) {
      whereClause.aiModel = aiModel;
    }
    
    return await this.findAll({
      where: whereClause,
      include: [
        {
          model: Article,
          as: 'article',
          attributes: ['id', 'title', 'link', 'pubDate'],
          include: [
            {
              model: Feed,
              as: 'feed',
              attributes: ['id', 'title', 'url'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  /**
   * Get recent summaries for anonymous users
   */
  static async getRecentSummaries(limit = 20, offset = 0) {
    const { Article, Feed } = await import('./index.js');
    
    return await this.findAndCountAll({
      include: [
        {
          model: Article,
          as: 'article',
          attributes: ['id', 'title', 'link', 'pubDate'],
          include: [
            {
              model: Feed,
              as: 'feed',
              attributes: ['id', 'title', 'url'],
              where: { isActive: true },
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  }

  /**
   * Clean old summaries (keep only recent ones)
   */
  static async cleanOldSummaries(daysToKeep = 90) {
    const { Op } = await import('sequelize');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    return await this.destroy({
      where: {
        createdAt: {
          [Op.lt]: cutoffDate,
        },
      },
    });
  }

  /**
   * Get quality metrics for summaries
   */
  getQualityMetrics() {
    const wordCount = this.summaryText.split(/\s+/).length;
    const sentenceCount = this.summaryText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    
    return {
      wordCount,
      sentenceCount,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
      characterCount: this.summaryText.length,
    };
  }

  /**
   * Get estimated reading time in minutes
   */
  getEstimatedReadingTime() {
    const wordsPerMinute = 200;
    const wordCount = this.summaryText.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  /**
   * Check if summary is recent
   */
  isRecent(hours = 24) {
    const now = new Date();
    const diffHours = (now - this.createdAt) / (1000 * 60 * 60);
    return diffHours <= hours;
  }
}

// Initialize the Summary model
Summary.initModel('Summary', {
  articleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'articles',
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  summaryText: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [10, 5000], // Minimum 10 characters, maximum 5000
    },
  },
  aiModel: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'gpt-3.5-turbo',
    validate: {
      isIn: [['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview', 'gpt-4o', 'gpt-4o-mini']],
    },
  },
  tokenCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of tokens used for this summary',
  },
  cost: {
    type: DataTypes.DECIMAL(10, 6),
    allowNull: true,
    comment: 'Cost in USD for generating this summary',
  },
  processingTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Processing time in milliseconds',
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Additional metadata about the summarization process',
  },
}, {
  indexes: [
    {
      fields: ['articleId'],
    },
    {
      fields: ['articleId', 'aiModel'],
      unique: true,
    },
  ],
});

export default Summary;