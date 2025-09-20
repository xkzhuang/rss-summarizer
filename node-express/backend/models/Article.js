import { DataTypes } from 'sequelize';
import BaseModel from './BaseModel.js';

class Article extends BaseModel {
  /**
   * Find article by link
   */
  static async findByLink(link) {
    return await this.findOne({
      where: { link },
    });
  }

  /**
   * Get articles for a feed with pagination
   */
  static async getByFeed(feedId, limit = 20, offset = 0) {
    const { Feed, Summary } = await import('./index.js');
    return await this.findAndCountAll({
      where: { feedId },
      include: [
        {
          model: Feed,
          as: 'feed',
          attributes: ['id', 'title', 'url'],
        },
        {
          model: Summary,
          as: 'summaries',
          required: false,
        },
      ],
      order: [['pubDate', 'DESC']],
      limit,
      offset,
    });
  }

  /**
   * Get recent articles across all feeds
   */
  static async getRecent(limit = 50, offset = 0) {
    const { Feed } = await import('./index.js');
    return await this.findAndCountAll({
      include: [
        {
          model: Feed,
          as: 'feed',
          attributes: ['id', 'title', 'url'],
        },
      ],
      order: [['pubDate', 'DESC']],
      limit,
      offset,
    });
  }

  /**
   * Get articles with summaries
   */
  async getSummaries() {
    const { Summary } = await import('./index.js');
    return await Summary.findAll({
      where: { articleId: this.id },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Get the latest summary for this article
   */
  async getLatestSummary() {
    const { Summary } = await import('./index.js');
    return await Summary.findOne({
      where: { articleId: this.id },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Check if article has been summarized
   */
  async hasSummary() {
    const { Summary } = await import('./index.js');
    const count = await Summary.count({
      where: { articleId: this.id },
    });
    return count > 0;
  }

  /**
   * Search articles by title or content
   */
  static async searchArticles(query, limit = 20, offset = 0, feedId = null, userId = null) {
    const { Op } = await import('sequelize');
    const { Feed, Subscription, Summary } = await import('./index.js');
    
    const whereClause = {
      [Op.or]: [
        { title: { [Op.like]: `%${query}%` } },
        { rawContent: { [Op.like]: `%${query}%` } },
      ],
    };
    
    if (feedId) {
      whereClause.feedId = feedId;
    }
    
    const includeClause = [
      {
        model: Feed,
        as: 'feed',
        attributes: ['id', 'title', 'url'],
      },
      {
        model: Summary,
        as: 'summaries',
        required: false,
      },
    ];
    
    // If userId is provided, filter by user's subscriptions
    if (userId) {
      includeClause[0].include = [
        {
          model: Subscription,
          as: 'subscriptions',
          where: { userId },
          attributes: [],
        },
      ];
    }
    
    return await this.findAndCountAll({
      where: whereClause,
      include: includeClause,
      order: [['pubDate', 'DESC']],
      limit,
      offset,
    });
  }

  /**
   * Get articles for user's subscriptions
   */
  static async getUserFeedArticles(userId, limit = 50, offset = 0) {
    const { Subscription, Feed } = await import('./index.js');
    
    return await this.findAndCountAll({
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
      order: [['pubDate', 'DESC']],
      limit,
      offset,
    });
  }

  /**
   * Get articles with summaries for user's subscriptions
   */
  static async getUserFeedArticlesWithSummaries(userId, limit = 20, offset = 0) {
    const { Subscription, Feed, Summary } = await import('./index.js');
    
    return await this.findAndCountAll({
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
        {
          model: Summary,
          as: 'summaries',
          required: false,
        },
      ],
      order: [['pubDate', 'DESC']],
      limit,
      offset,
    });
  }

  /**
   * Bulk create articles with comprehensive duplicate checking
   */
  static async bulkCreateSafeWithDupeCheck(articles, feedId) {
    if (!articles || articles.length === 0) {
      return [];
    }

    const { Op } = await import('sequelize');
    const newArticles = [];
    
    try {
      // Get all existing articles for this feed to check against
      const existingArticles = await this.findAll({
        where: { feedId },
        attributes: ['id', 'link', 'guid', 'title'],
        raw: true
      });
      
      // Create lookup sets for efficient duplicate detection
      const existingLinks = new Set(existingArticles.map(a => a.link).filter(Boolean));
      const existingGuids = new Set(existingArticles.map(a => a.guid).filter(Boolean));
      const existingTitles = new Set(existingArticles.map(a => a.title).filter(Boolean));
      
      console.log(`Checking ${articles.length} articles against ${existingArticles.length} existing articles for feed ${feedId}`);
      
      // Filter out duplicates using multiple criteria
      for (const articleData of articles) {
        let isDuplicate = false;
        let duplicateReason = '';
        
        // Check for duplicate by link (primary check)
        if (articleData.link && existingLinks.has(articleData.link)) {
          isDuplicate = true;
          duplicateReason = 'duplicate link';
        }
        // Check for duplicate by GUID (secondary check)
        else if (articleData.guid && existingGuids.has(articleData.guid)) {
          isDuplicate = true;
          duplicateReason = 'duplicate guid';
        }
        // Check for duplicate by title (fallback check for feeds with poor GUID/link management)
        else if (articleData.title && existingTitles.has(articleData.title)) {
          isDuplicate = true;
          duplicateReason = 'duplicate title';
        }
        
        if (!isDuplicate) {
          try {
            // Create the article with feedId
            const article = await this.create({
              ...articleData,
              feedId: feedId,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            
            newArticles.push(article);
            
            // Add to our lookup sets to prevent duplicates within this batch
            if (articleData.link) existingLinks.add(articleData.link);
            if (articleData.guid) existingGuids.add(articleData.guid);
            if (articleData.title) existingTitles.add(articleData.title);
            
          } catch (error) {
            // Handle potential race conditions or unique constraint violations
            if (error.name === 'SequelizeUniqueConstraintError' || 
                error.message.includes('duplicate') || 
                error.message.includes('unique constraint')) {
              console.log(`Skipped duplicate article (DB constraint): "${articleData.title}"`);
            } else {
              console.error(`Error creating article "${articleData.title}":`, error.message);
            }
          }
        } else {
          console.log(`Skipped duplicate article (${duplicateReason}): "${articleData.title}"`);
        }
      }
      
      console.log(`Created ${newArticles.length} new articles out of ${articles.length} processed for feed ${feedId}`);
      return newArticles;
      
    } catch (error) {
      console.error('Error in bulkCreateSafeWithDupeCheck:', error);
      throw error;
    }
  }

  /**
   * Clean old articles (keep only recent ones per feed)
   */
  static async cleanOldArticles(daysToKeep = 30, articlesPerFeedToKeep = 100) {
    const { Op } = await import('sequelize');
    const sequelize = (await import('../config/database.js')).default;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // Get articles to delete based on age
    const oldArticles = await this.findAll({
      where: {
        pubDate: {
          [Op.lt]: cutoffDate,
        },
      },
      attributes: ['id', 'feedId'],
    });
    
    // Also get excess articles per feed (keep only most recent ones)
    const excessArticles = await sequelize.query(`
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY "feedId" ORDER BY "pubDate" DESC) as rn
        FROM articles
      ) ranked
      WHERE rn > :articlesPerFeedToKeep
    `, {
      replacements: { articlesPerFeedToKeep },
      type: sequelize.QueryTypes.SELECT,
    });
    
    const allArticleIds = [
      ...oldArticles.map(a => a.id),
      ...excessArticles.map(a => a.id),
    ];
    
    if (allArticleIds.length > 0) {
      return await this.destroy({
        where: {
          id: allArticleIds,
        },
      });
    }
    
    return 0;
  }

  /**
   * Get content preview (truncated)
   */
  getContentPreview(maxLength = 200) {
    if (!this.rawContent) return '';
    
    const cleanContent = this.rawContent.replace(/<[^>]*>/g, '').trim();
    if (cleanContent.length <= maxLength) return cleanContent;
    
    return cleanContent.substring(0, maxLength).trim() + '...';
  }
}

// Initialize the Article model
Article.initModel('Article', {
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
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      len: [1, 500],
    },
  },
  link: {
    type: DataTypes.STRING(1000),
    allowNull: false,
    unique: true,
    validate: {
      isUrl: true,
    },
  },
  pubDate: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: true,
    },
  },
  rawContent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  author: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  guid: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: [1, 500],
    },
  },
  categories: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
}, {
  indexes: [
    {
      unique: true,
      fields: ['link'],
      name: 'articles_link_unique'
    },
    {
      unique: true,
      fields: ['feedId', 'guid'],
      name: 'articles_feed_guid_unique'
    },
    {
      fields: ['feedId'],
      name: 'articles_feed_id_idx'
    },
    {
      fields: ['feedId', 'pubDate'],
      name: 'articles_feed_pubdate_idx'
    },
    {
      fields: ['pubDate'],
      name: 'articles_pubdate_idx'
    },
    {
      fields: ['feedId', 'title'],
      name: 'articles_feed_title_idx'
    }
  ],
});

export default Article;