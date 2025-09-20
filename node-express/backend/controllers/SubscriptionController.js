import { Subscription, Feed, User } from '../models/index.js';

class SubscriptionController {
  /**
   * Get user's subscriptions
   */
  static async getUserSubscriptions(req, res, next) {
    try {
      const userId = req.user.id;

      const subscriptions = await Subscription.getUserSubscriptions(userId, true);

      res.json({
        success: true,
        message: 'Subscriptions retrieved successfully',
        data: subscriptions,
      });
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      next(error);
    }
  }

  /**
   * Subscribe to a feed
   */
  static async subscribeToFeed(req, res, next) {
    try {
      const userId = req.user.id;
      const { feedId } = req.body;

      if (!feedId) {
        return res.status(400).json({
          success: false,
          message: 'Feed ID is required',
          error: 'MISSING_FEED_ID',
        });
      }

      // Check if feed exists and is active
      const feed = await Feed.findByPk(feedId);
      if (!feed) {
        return res.status(404).json({
          success: false,
          message: 'Feed not found',
          error: 'FEED_NOT_FOUND',
        });
      }

      if (!feed.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Feed is not active',
          error: 'FEED_INACTIVE',
        });
      }

      // Subscribe user to feed
      const subscription = await Subscription.subscribeUserToFeed(userId, feedId, req.transaction);

      // Return subscription with feed details
      const subscriptionWithFeed = await Subscription.findByPk(subscription.id, {
        include: [
          {
            model: Feed,
            as: 'feed',
          },
        ],
      });

      res.status(201).json({
        success: true,
        message: 'Successfully subscribed to feed',
        data: subscriptionWithFeed,
      });
    } catch (error) {
      if (error.message === 'User is already subscribed to this feed') {
        return res.status(409).json({
          success: false,
          message: 'Already subscribed to this feed',
          error: 'ALREADY_SUBSCRIBED',
        });
      }

      console.error('Error subscribing to feed:', error);
      next(error);
    }
  }

  /**
   * Unsubscribe from a feed
   */
  static async unsubscribeFromFeed(req, res, next) {
    try {
      const userId = req.user.id;
      const feedId = parseInt(req.params.feedId);

      if (!feedId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid feed ID',
          error: 'INVALID_FEED_ID',
        });
      }

      await Subscription.unsubscribeUserFromFeed(userId, feedId, req.transaction);

      res.json({
        success: true,
        message: 'Successfully unsubscribed from feed',
      });
    } catch (error) {
      if (error.message === 'User is not subscribed to this feed') {
        return res.status(404).json({
          success: false,
          message: 'Not subscribed to this feed',
          error: 'NOT_SUBSCRIBED',
        });
      }

      console.error('Error unsubscribing from feed:', error);
      next(error);
    }
  }

  /**
   * Get a specific subscription
   */
  static async getSubscription(req, res, next) {
    try {
      const userId = req.user.id;
      const feedId = parseInt(req.params.feedId);

      if (!feedId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid feed ID',
          error: 'INVALID_FEED_ID',
        });
      }

      const subscription = await Subscription.findOne({
        where: { userId, feedId },
        include: [
          {
            model: Feed,
            as: 'feed',
          },
        ],
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found',
          error: 'SUBSCRIPTION_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        message: 'Subscription retrieved successfully',
        data: subscription,
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
      next(error);
    }
  }

  /**
   * Update subscription settings
   */
  static async updateSubscription(req, res, next) {
    try {
      const userId = req.user.id;
      const feedId = parseInt(req.params.feedId);
      const { notificationsEnabled, isActive } = req.body;

      if (!feedId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid feed ID',
          error: 'INVALID_FEED_ID',
        });
      }

      const subscription = await Subscription.findOne({
        where: { userId, feedId },
        transaction: req.transaction,
      });

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found',
          error: 'SUBSCRIPTION_NOT_FOUND',
        });
      }

      // Update only provided fields
      const updateData = {};
      if (typeof notificationsEnabled === 'boolean') {
        updateData.notificationsEnabled = notificationsEnabled;
      }
      if (typeof isActive === 'boolean') {
        updateData.isActive = isActive;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields to update',
          error: 'NO_UPDATE_DATA',
        });
      }

      await subscription.update(updateData, { transaction: req.transaction });

      // Return updated subscription with feed details
      const updatedSubscription = await Subscription.findByPk(subscription.id, {
        include: [
          {
            model: Feed,
            as: 'feed',
          },
        ],
      });

      res.json({
        success: true,
        message: 'Subscription updated successfully',
        data: updatedSubscription,
      });
    } catch (error) {
      console.error('Error updating subscription:', error);
      next(error);
    }
  }

  /**
   * Get subscription statistics
   */
  static async getSubscriptionStats(req, res, next) {
    try {
      const userId = req.user.id;

      const stats = await Subscription.getUserSubscriptionStats(userId);

      res.json({
        success: true,
        message: 'Subscription statistics retrieved successfully',
        data: stats,
      });
    } catch (error) {
      console.error('Error fetching subscription stats:', error);
      next(error);
    }
  }

  /**
   * Bulk subscribe to multiple feeds
   */
  static async bulkSubscribe(req, res, next) {
    try {
      const userId = req.user.id;
      const { feedIds } = req.body;

      if (!Array.isArray(feedIds) || feedIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid feed IDs array is required',
          error: 'INVALID_FEED_IDS',
        });
      }

      // Validate all feeds exist and are active
      const feeds = await Feed.findAll({
        where: {
          id: feedIds,
          isActive: true,
        },
      });

      if (feeds.length !== feedIds.length) {
        const foundFeedIds = feeds.map(f => f.id);
        const missingFeedIds = feedIds.filter(id => !foundFeedIds.includes(id));
        
        return res.status(400).json({
          success: false,
          message: 'Some feeds not found or inactive',
          error: 'INVALID_FEEDS',
          data: { missingFeedIds },
        });
      }

      const subscriptions = await Subscription.bulkSubscribe(userId, feedIds, req.transaction);

      res.status(201).json({
        success: true,
        message: `Successfully subscribed to ${subscriptions.length} feeds`,
        data: subscriptions,
      });
    } catch (error) {
      console.error('Error bulk subscribing to feeds:', error);
      next(error);
    }
  }
}

export default SubscriptionController;