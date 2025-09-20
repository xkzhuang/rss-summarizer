import FeedService from '../services/FeedService.js';
import ArticleFetcher from '../services/ArticleFetcher.js';

class FeedController {
  /**
   * Create a new feed and subscribe user to it
   */
  static async createFeed(req, res, next) {
    try {
      const { url, title, description, fetchInterval } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'Feed URL is required',
          error: 'VALIDATION_ERROR'
        });
      }

      const result = await FeedService.createFeed({
        url,
        title,
        description,
        fetchInterval
      }, userId);

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          feed: result.feed.toSafeJSON(),
          subscription: result.subscription
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all feeds (public endpoint)
   */
  static async getAllFeeds(req, res, next) {
    try {
      const { page, limit, search, isActive } = req.query;
      
      const result = await FeedService.getAllFeeds({
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        search: search || '',
        isActive: isActive !== undefined ? isActive === 'true' : null
      });

      res.json({
        success: true,
        message: 'Feeds retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's subscribed feeds
   */
  static async getUserFeeds(req, res, next) {
    try {
      const userId = req.user.id;
      const { page, limit, search } = req.query;

      const result = await FeedService.getUserFeeds(userId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        search: search || ''
      });

      res.json({
        success: true,
        message: 'User feeds retrieved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get feed by ID
   */
  static async getFeedById(req, res, next) {
    try {
      const { feedId } = req.params;

      const feed = await FeedService.getFeedById(feedId);

      res.json({
        success: true,
        message: 'Feed retrieved successfully',
        data: { feed: feed.toSafeJSON() }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update feed (admin only)
   */
  static async updateFeed(req, res, next) {
    try {
      const { feedId } = req.params;
      const updateData = req.body;

      // Only allow admins to update feeds
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
          error: 'FORBIDDEN'
        });
      }

      const feed = await FeedService.updateFeed(feedId, updateData);

      res.json({
        success: true,
        message: 'Feed updated successfully',
        data: { feed: feed.toSafeJSON() }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete feed (admin only)
   */
  static async deleteFeed(req, res, next) {
    try {
      const { feedId } = req.params;

      // Only allow admins to delete feeds
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
          error: 'FORBIDDEN'
        });
      }

      const result = await FeedService.deleteFeed(feedId);

      res.json({
        success: true,
        message: result.message,
        data: null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Subscribe to a feed
   */
  static async subscribeFeed(req, res, next) {
    try {
      const { feedId } = req.params;
      const userId = req.user.id;

      const result = await FeedService.subscribeFeed(userId, feedId);

      res.json({
        success: true,
        message: result.message,
        data: { subscription: result.subscription }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Unsubscribe from a feed
   */
  static async unsubscribeFeed(req, res, next) {
    try {
      const { feedId } = req.params;
      const userId = req.user.id;

      const result = await FeedService.unsubscribeFeed(userId, feedId);

      res.json({
        success: true,
        message: result.message,
        data: null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate feed URL
   */
  static async validateFeedUrl(req, res, next) {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'URL is required',
          error: 'VALIDATION_ERROR'
        });
      }

      const validation = await FeedService.validateFeedUrl(url);

      res.json({
        success: true,
        message: validation.valid ? 'Feed URL is valid' : 'Feed URL is invalid',
        data: validation
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manually fetch articles for a specific feed
   */
  static async fetchFeedArticles(req, res, next) {
    try {
      const { feedId } = req.params;

      const articleCount = await ArticleFetcher.fetchFeedById(feedId);

      res.json({
        success: true,
        message: `Successfully fetched ${articleCount} new articles`,
        data: { articleCount }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Manually fetch articles for all active feeds (admin only)
   */
  static async fetchAllFeedArticles(req, res, next) {
    try {
      // Only allow admins to trigger bulk fetch
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
          error: 'FORBIDDEN'
        });
      }

      const result = await ArticleFetcher.fetchAllFeeds();

      res.json({
        success: true,
        message: 'Feed fetch completed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

export default FeedController;