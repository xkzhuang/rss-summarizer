import { Feed, Subscription, User } from '../models/index.js';
import Parser from 'rss-parser';
import FeedParser from 'feedparser';
import axios from 'axios';
import ArticleFetcher from './ArticleFetcher.js';

class FeedService {
  constructor() {
    this.parser = new Parser({
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
  }

  /**
   * Parse RSS/Atom feed using fallback feedparser when rss-parser fails
   */
  async parseWithFeedParser(url) {
    return new Promise((resolve, reject) => {
      const feedparser = new FeedParser({
        normalize: true,
        addmeta: false
      });
      
      const items = [];
      let feedMeta = {};

      // Handle errors
      feedparser.on('error', reject);

      // Handle feed metadata
      feedparser.on('meta', (meta) => {
        feedMeta = {
          title: meta.title,
          description: meta.description,
          link: meta.link,
          language: meta.language
        };
      });

      // Handle individual articles
      feedparser.on('readable', function() {
        let item;
        while (item = this.read()) {
          items.push(item);
        }
      });

      // When done, resolve with feed data
      feedparser.on('end', () => {
        resolve({
          ...feedMeta,
          items
        });
      });

      // Try with multiple User-Agent strings for better compatibility
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'RSS Feed Reader Bot/1.0',
        'Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)'
      ];

      let currentAgent = 0;
      
      const tryRequest = () => {
        if (currentAgent >= userAgents.length) {
          reject(new Error('All User-Agent strings failed'));
          return;
        }

        const isNews = url.includes('news') || url.includes('rss') || url.includes('feed');
        const referer = url.includes('politico') ? 'https://www.politico.com/' : 
                       url.includes('bbc') ? 'https://www.bbc.com/' :
                       isNews ? url.split('/').slice(0, 3).join('/') : undefined;

        axios({
          method: 'GET',
          url: url,
          headers: {
            'User-Agent': userAgents[currentAgent],
            'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Referer': referer,
            'DNT': '1'
          },
          timeout: 15000,
          responseType: 'stream'
        }).then(response => {
          response.data.pipe(feedparser);
        }).catch(err => {
          console.log(`  Validation fallback User-Agent ${currentAgent + 1} failed: ${err.message}`);
          currentAgent++;
          if (currentAgent < userAgents.length) {
            setTimeout(tryRequest, 1000); // Wait 1 second between attempts
          } else {
            reject(err);
          }
        });
      };

      tryRequest();
    });
  }

  /**
   * Create a new feed
   */
  async createFeed(feedData, userId) {
    try {
      // Validate feed URL
      const validation = await this.validateFeedUrl(feedData.url);
      if (!validation.valid) {
        //throw new Error(`Invalid feed URL: ${validation.error}`);
      }

      // Check if feed already exists
      const existingFeed = await Feed.findOne({ where: { url: feedData.url } });
      if (existingFeed) {
        // If feed exists, just subscribe the user to it
        const existingSubscription = await Subscription.findOne({
          where: { userId, feedId: existingFeed.id }
        });
        
        if (existingSubscription) {
          return {
            feed: existingFeed,
            subscription: existingSubscription,
            message: 'Already subscribed to this feed'
          };
        }

        const subscription = await Subscription.create({
          userId,
          feedId: existingFeed.id
        });

        return {
          feed: existingFeed,
          subscription,
          message: 'Subscribed to existing feed'
        };
      }

      console.log(`Creating new feed for URL: ${feedData.url}`);
      console.log(feedData);

      // Create new feed
      const feedInfo = validation.feedInfo;
      const feed = await Feed.create({
        url: feedData.url,
        title: feedInfo.title || feedData.title || 'Untitled Feed',
        description: feedInfo.description || feedData.description || '',
        link: feedInfo.link || '',
        language: feedInfo.language || 'en',
        isActive: true,
        lastFetched: new Date(),
        fetchInterval: feedData.fetchInterval || 3600000, // 1 hour default
      });

      console.log(`Feed created in DB with ID: ${feed.id}`);

      // Subscribe user to the new feed
      const subscription = await Subscription.create({
        userId,
        feedId: feed.id
      });

      console.log(`\n\n\nDB Feed created with ID: ${feed.id}`);

      // Try to fetch articles for the new feed immediately
      try {
        const articleCount = await ArticleFetcher.fetchFeedArticles(feed);
        console.log(`Fetched ${articleCount} articles for new feed: ${feed.title}`);
      } catch (fetchError) {
        // Don't fail the feed creation if article fetching fails
        console.warn(`\n\nWarning: Could not fetch articles for new feed: ${fetchError.message}`);
      }

      // Determine the success message
      let message = 'Feed created and subscribed successfully';
      if (validation.warning) {
        message += `. Warning: ${validation.warning}`;
      }

      return {
        feed,
        subscription,
        message
      };
    } catch (error) {
      throw new Error(`Failed to create feed: ${error.message}`);
    }
  }

  /**
   * Get all feeds (paginated)
   */
  async getAllFeeds(options = {}) {
    try {
      const { page = 1, limit = 20, search = '', isActive = null } = options;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (search) {
        whereClause.title = { [sequelize.Op.like]: `%${search}%` };
      }
      if (isActive !== null) {
        whereClause.isActive = isActive;
      }

      const { count, rows } = await Feed.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: Subscription,
            as: 'subscriptions',
            attributes: ['id', 'userId'],
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username']
              }
            ]
          }
        ]
      });

      return {
        feeds: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get feeds: ${error.message}`);
    }
  }

  /**
   * Get user's subscribed feeds
   */
  async getUserFeeds(userId, options = {}) {
    try {
      const { page = 1, limit = 20, search = '' } = options;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (search) {
        whereClause.title = { [sequelize.Op.like]: `%${search}%` };
      }

      const { count, rows } = await Feed.findAndCountAll({
        where: whereClause,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
        include: [
          {
            model: Subscription,
            as: 'subscriptions',
            where: { userId },
            attributes: ['id', 'isActive', 'createdAt']
          }
        ]
      });

      return {
        feeds: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get user feeds: ${error.message}`);
    }
  }

  /**
   * Get feed by ID
   */
  async getFeedById(feedId) {
    try {
      const feed = await Feed.findByPk(feedId, {
        include: [
          {
            model: Subscription,
            as: 'subscriptions',
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username']
              }
            ]
          }
        ]
      });

      if (!feed) {
        throw new Error('Feed not found');
      }

      return feed;
    } catch (error) {
      throw new Error(`Failed to get feed: ${error.message}`);
    }
  }

  /**
   * Update feed
   */
  async updateFeed(feedId, updateData) {
    try {
      const feed = await Feed.findByPk(feedId);
      if (!feed) {
        throw new Error('Feed not found');
      }

      // If URL is being updated, validate it
      if (updateData.url && updateData.url !== feed.url) {
        const validation = await this.validateFeedUrl(updateData.url);
        if (!validation.valid) {
          throw new Error(`Invalid feed URL: ${validation.error}`);
        }
        
        // Update with feed info if available
        if (validation.feedInfo) {
          updateData.title = validation.feedInfo.title || updateData.title;
          updateData.description = validation.feedInfo.description || updateData.description;
          updateData.link = validation.feedInfo.link || updateData.link;
        }
      }

      await feed.update(updateData);
      return feed;
    } catch (error) {
      throw new Error(`Failed to update feed: ${error.message}`);
    }
  }

  /**
   * Delete feed
   */
  async deleteFeed(feedId) {
    try {
      const feed = await Feed.findByPk(feedId);
      if (!feed) {
        throw new Error('Feed not found');
      }

      await feed.destroy();
      return { message: 'Feed deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete feed: ${error.message}`);
    }
  }

  /**
   * Subscribe user to a feed
   */
  async subscribeFeed(userId, feedId) {
    try {
      const feed = await Feed.findByPk(feedId);
      if (!feed) {
        throw new Error('Feed not found');
      }

      const existingSubscription = await Subscription.findOne({
        where: { userId, feedId }
      });

      if (existingSubscription) {
        return {
          subscription: existingSubscription,
          message: 'Already subscribed to this feed'
        };
      }

      const subscription = await Subscription.create({
        userId,
        feedId
      });

      return {
        subscription,
        message: 'Subscribed successfully'
      };
    } catch (error) {
      throw new Error(`Failed to subscribe to feed: ${error.message}`);
    }
  }

  /**
   * Unsubscribe user from a feed
   */
  async unsubscribeFeed(userId, feedId) {
    try {
      const subscription = await Subscription.findOne({
        where: { userId, feedId }
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      await subscription.destroy();
      return { message: 'Unsubscribed successfully' };
    } catch (error) {
      throw new Error(`Failed to unsubscribe from feed: ${error.message}`);
    }
  }

  /**
   * Validate feed URL
   */
  async validateFeedUrl(url) {
    let usingFallbackParser = false;
    let feed;

    try {
      // Try primary rss-parser first
      const parser = new Parser({
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
          'DNT': '1',
        },
        timeout: 10000, // 10 second timeout
        maxRedirects: 5
      });

      console.log(`Validating feed URL with rss-parser: ${url}`);
      feed = await parser.parseURL(url);
      console.log(`✓ Feed validation successful with rss-parser: ${url}`);

    } catch (primaryError) {
      console.log(`⚠ rss-parser validation failed for ${url}, trying fallback parser...`);
      console.log(`Primary parser error: ${primaryError.message}`);

      try {
        // Try fallback feedparser
        feed = await this.parseWithFeedParser(url);
        usingFallbackParser = true;
        console.log(`✓ Feed validation successful with feedparser (fallback): ${url}`);
      } catch (fallbackError) {
        console.warn(`✗ Both parsers failed for ${url}`);
        console.warn(`Primary error: ${primaryError.message}`);
        console.warn(`Fallback error: ${fallbackError.message}`);
        
        // Check if this is a type of error we should allow through with a warning
        const allowableErrors = [
          'Response code 403', // Forbidden (old format)
          'Status code 403', // Forbidden (new format)
          'Response code 429', // Too Many Requests
          'Status code 429', // Too Many Requests (new format)
          'Response code 503', // Service Unavailable
          'Status code 503', // Service Unavailable (new format)
          'ETIMEDOUT', // Connection timeout
          'ENOTFOUND', // DNS resolution failed
          'ECONNREFUSED', // Connection refused
          'socket hang up', // Connection issues
          'timeout', // General timeout
          'Request timeout', // Request timeout
          'getaddrinfo ENOTFOUND', // DNS lookup failed
          'Non-whitespace before first tag', // XML parsing issues (often BOM or encoding)
          'Invalid character in entity name', // XML entity issues
          'Unexpected end of input' // Incomplete XML
        ];

        const isPrimaryAllowableError = allowableErrors.some(allowableError => 
          primaryError.message.includes(allowableError) || primaryError.code === allowableError
        );

        const isFallbackAllowableError = allowableErrors.some(allowableError => 
          fallbackError.message.includes(allowableError) || fallbackError.code === allowableError
        );

        if (isPrimaryAllowableError || isFallbackAllowableError) {
          // Return as valid with a warning - let the user decide
          return {
            valid: true,
            warning: `Feed may not be accessible right now (both parsers failed), but will be created anyway. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`,
            feedInfo: {
              title: 'Feed Title (Unable to fetch)',
              description: 'Description will be updated when feed becomes accessible',
              link: url,
              language: 'en'
            }
          };
        }

        // For other errors, mark as invalid
        return {
          valid: false,
          error: `Both parsers failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`
        };
      }
    }

    // Return successful validation result
    return {
      valid: true,
      warning: usingFallbackParser ? 'Feed parsed successfully using fallback parser (feedparser)' : null,
      feedInfo: {
        title: feed.title,
        description: feed.description,
        link: feed.link,
        language: feed.language || 'en'
      }
    };
  }
}

export default new FeedService();