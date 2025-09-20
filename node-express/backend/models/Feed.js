import { DataTypes } from 'sequelize';
import BaseModel from './BaseModel.js';

class Feed extends BaseModel {
  /**
   * Check if feed needs updating based on last fetch time
   */
  needsUpdate(intervalHours = 1) {
    if (!this.lastFetched) return true;
    
    const now = new Date();
    const lastFetch = new Date(this.lastFetched);
    const diffHours = (now - lastFetch) / (1000 * 60 * 60);
    
    return diffHours >= intervalHours;
  }

  /**
   * Update last fetched timestamp
   */
  async markAsFetched() {
    this.lastFetched = new Date();
    return await this.save();
  }

  /**
   * Get articles for this feed with pagination
   */
  async getArticles(limit = 10, offset = 0) {
    const { Article } = await import('./index.js');
    return await Article.findAndCountAll({
      where: { feedId: this.id },
      order: [['pubDate', 'DESC']],
      limit,
      offset,
    });
  }

  /**
   * Get latest articles with summaries
   */
  async getArticlesWithSummaries(limit = 10) {
    const { Article, Summary } = await import('./index.js');
    return await Article.findAll({
      where: { feedId: this.id },
      include: [
        {
          model: Summary,
          as: 'summaries',
          required: false,
        },
      ],
      order: [['pubDate', 'DESC']],
      limit,
    });
  }

  /**
   * Get subscriber count
   */
  async getSubscriberCount() {
    const { Subscription } = await import('./index.js');
    return await Subscription.count({
      where: { feedId: this.id },
    });
  }

  /**
   * Find feed by URL
   */
  static async findByUrl(url) {
    return await this.findOne({
      where: { url },
    });
  }

  /**
   * Search feeds by title or description
   */
  static async searchFeeds(query, limit = 20) {
    const { Op } = await import('sequelize');
    return await this.findAll({
      where: {
        [Op.or]: [
          { title: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } },
        ],
      },
      limit,
      order: [['updatedAt', 'DESC']],
    });
  }

  /**
   * Get most popular feeds
   */
  static async getPopularFeeds(limit = 10) {
    const sequelize = (await import('../config/database.js')).default;
    return await this.findAll({
      attributes: {
        include: [
          [
            sequelize.fn('COUNT', sequelize.col('subscriptions.id')),
            'subscriberCount'
          ],
        ],
      },
      include: [
        {
          model: (await import('./index.js')).Subscription,
          as: 'subscriptions',
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

  /**
   * Validate RSS/Atom feed URL with fallback parser
   */
  static async validateFeedUrl(url) {
    let usingFallbackParser = false;
    let feed;

    try {
      // Try primary rss-parser first
      const Parser = (await import('rss-parser')).default;
      const parser = new Parser({
        timeout: 10000,
        maxRedirects: 5,
      });
      
      feed = await parser.parseURL(url);
      
    } catch (primaryError) {
      try {
        // Try fallback feedparser
        const FeedParser = (await import('feedparser')).default;
        const axios = (await import('axios')).default;

        feed = await new Promise((resolve, reject) => {
          const feedparser = new FeedParser({
            normalize: true,
            addmeta: false
          });
          
          const items = [];
          let feedMeta = {};

          feedparser.on('error', reject);
          feedparser.on('meta', (meta) => {
            feedMeta = {
              title: meta.title,
              description: meta.description,
              link: meta.link,
              language: meta.language
            };
          });

          feedparser.on('readable', function() {
            let item;
            while (item = this.read()) {
              items.push(item);
            }
          });

          feedparser.on('end', () => {
            resolve({
              ...feedMeta,
              items
            });
          });

          axios({
            method: 'GET',
            url: url,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
            },
            timeout: 10000,
            responseType: 'stream'
          }).then(response => {
            response.data.pipe(feedparser);
          }).catch(reject);
        });

        usingFallbackParser = true;
        
      } catch (fallbackError) {
        return {
          valid: false,
          error: `Both parsers failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`,
        };
      }
    }

    return {
      valid: true,
      title: feed.title,
      description: feed.description,
      link: feed.link,
      usingFallbackParser
    };
  }
}

// Initialize the Feed model
Feed.initModel('Feed', {
  url: {
    type: DataTypes.STRING(500),
    allowNull: false,
    unique: true,
    validate: {
      isUrl: true,
    },
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [1, 255],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  link: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      isUrl: true,
    },
  },
  lastFetched: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  fetchError: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Last error encountered while fetching this feed',
  },
  errorCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    comment: 'Number of consecutive errors encountered',
  },
}, {
  indexes: [
    {
      unique: true,
      fields: ['url'],
    },
    {
      fields: ['isActive'],
    },
  ],
  hooks: {
    beforeCreate: async (feed) => {
      // Try to validate feed URL before creating, but don't fail on temporary errors
      try {
        const validation = await Feed.validateFeedUrl(feed.url);
        if (validation.valid) {
          // Set title and description if not provided and validation succeeded
          if (!feed.title && validation.title) {
            feed.title = validation.title;
          }
          if (!feed.description && validation.description) {
            feed.description = validation.description;
          }
          if (!feed.link && validation.link) {
            feed.link = validation.link;
          }
        } else {
          // Check if this is a temporary error that we should allow through
          const allowableErrors = [
            'Response code 403', // Forbidden
            'Status code 403', // Forbidden
            'Response code 429', // Too Many Requests
            'Status code 429', // Too Many Requests
            'Response code 503', // Service Unavailable
            'Status code 503', // Service Unavailable
            'ETIMEDOUT', // Connection timeout
            'ENOTFOUND', // DNS resolution failed
            'ECONNREFUSED', // Connection refused
            'socket hang up', // Connection issues
            'timeout', // General timeout
            'Request timeout', // Request timeout
            'getaddrinfo ENOTFOUND', // DNS lookup failed
            'Non-whitespace before first tag', // XML parsing issues
            'Invalid character in entity name', // XML entity issues
            'Unexpected end of input' // Incomplete XML
          ];

          const isAllowableError = allowableErrors.some(allowableError => 
            validation.error.includes(allowableError)
          );

          if (!isAllowableError) {
            throw new Error(`Invalid feed URL: ${validation.error}`);
          }
          
          // For allowable errors, set default values if not provided
          if (!feed.title) {
            feed.title = 'Feed Title (Unable to fetch)';
          }
          if (!feed.description) {
            feed.description = 'Description will be updated when feed becomes accessible';
          }
        }
      } catch (error) {
        // If validation itself fails, log warning but allow creation with defaults
        console.warn(`Feed URL validation failed for ${feed.url}: ${error.message}`);
        
        if (!feed.title) {
          feed.title = 'Feed Title (Unable to fetch)';
        }
        if (!feed.description) {
          feed.description = 'Description will be updated when feed becomes accessible';
        }
      }
    },
  },
});

export default Feed;