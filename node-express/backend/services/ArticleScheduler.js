import cron from 'node-cron';
import ArticleFetcher from './ArticleFetcher.js';
import { logger } from '../middlewares/errorHandler.js';

class ArticleScheduler {
  static scheduledJobs = new Map();

  /**
   * Initialize the article scheduler
   */
  static init() {
    // Only run scheduler if explicitly enabled
    if (process.env.ENABLE_ARTICLE_SCHEDULER !== 'true') {
      logger.info('Article scheduler disabled. Set ENABLE_ARTICLE_SCHEDULER=true to enable.');
      return;
    }

    logger.info('Initializing Article Scheduler...');

    // Schedule article fetching every hour
    const fetchJob = cron.schedule('0 * * * *', async () => {
      logger.info('Starting scheduled article fetch...');
      const startTime = Date.now();
      
      try {
        const result = await ArticleFetcher.fetchAllFeeds();
        const duration = Date.now() - startTime;
        
        logger.info(`Scheduled fetch completed in ${duration}ms:`, {
          totalFetched: result.totalFetched,
          feedsProcessed: result.feedsProcessed,
          errors: result.totalErrors,
          duration: `${duration}ms`
        });
        
        // Log summary
        console.log(`✅ Scheduled fetch: ${result.totalFetched} new articles from ${result.feedsProcessed} feeds (${result.totalErrors} errors)`);
        
      } catch (error) {
        logger.error('Scheduled article fetch failed:', error);
        console.error('❌ Scheduled article fetch failed:', error.message);
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'America/New_York'
    });

    // Schedule cleanup task - run daily at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      logger.info('Starting scheduled article cleanup...');
      const startTime = Date.now();
      
      try {
        const daysToKeep = parseInt(process.env.ARTICLE_RETENTION_DAYS) || 30;
        const deleted = await ArticleFetcher.cleanupOldArticles(daysToKeep);
        const duration = Date.now() - startTime;
        
        logger.info(`Scheduled cleanup completed in ${duration}ms:`, {
          articlesDeleted: deleted,
          retentionDays: daysToKeep,
          duration: `${duration}ms`
        });
        
        console.log(`🧹 Scheduled cleanup: ${deleted} old articles removed (keeping ${daysToKeep} days)`);
        
      } catch (error) {
        logger.error('Scheduled cleanup failed:', error);
        console.error('❌ Scheduled cleanup failed:', error.message);
      }
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'America/New_York'
    });

    // Store jobs for potential future management
    this.scheduledJobs.set('articleFetch', fetchJob);
    this.scheduledJobs.set('articleCleanup', cleanupJob);

    logger.info('Article Scheduler initialized successfully');
    console.log('📅 Article Scheduler started:');
    console.log('  - Article fetching: Every hour');
    console.log('  - Cleanup: Daily at 2 AM');
    console.log(`  - Timezone: ${process.env.TZ || 'America/New_York'}`);
  }

  /**
   * Stop all scheduled jobs
   */
  static stop() {
    logger.info('Stopping Article Scheduler...');
    
    this.scheduledJobs.forEach((job, name) => {
      if (job) {
        job.destroy();
        logger.info(`Stopped scheduled job: ${name}`);
      }
    });
    
    this.scheduledJobs.clear();
    console.log('📅 Article Scheduler stopped');
  }

  /**
   * Get status of all scheduled jobs
   */
  static getStatus() {
    const status = {};
    
    this.scheduledJobs.forEach((job, name) => {
      status[name] = {
        scheduled: job.scheduled,
        running: job.running || false,
        destroyed: job.destroyed || false
      };
    });
    
    return {
      enabled: process.env.ENABLE_ARTICLE_SCHEDULER === 'true',
      jobs: status,
      timezone: process.env.TZ || 'America/New_York',
      retentionDays: parseInt(process.env.ARTICLE_RETENTION_DAYS) || 30
    };
  }

  /**
   * Manually trigger article fetch (for testing/admin purposes)
   */
  static async triggerFetch() {
    logger.info('Manually triggering article fetch...');
    try {
      const result = await ArticleFetcher.fetchAllFeeds();
      logger.info('Manual article fetch completed:', result);
      return result;
    } catch (error) {
      logger.error('Manual article fetch failed:', error);
      throw error;
    }
  }

  /**
   * Manually trigger cleanup (for testing/admin purposes)
   */
  static async triggerCleanup(daysToKeep = null) {
    const days = daysToKeep || parseInt(process.env.ARTICLE_RETENTION_DAYS) || 30;
    logger.info(`Manually triggering article cleanup (${days} days retention)...`);
    
    try {
      const deleted = await ArticleFetcher.cleanupOldArticles(days);
      logger.info(`Manual cleanup completed: ${deleted} articles deleted`);
      return { deleted, daysToKeep: days };
    } catch (error) {
      logger.error('Manual cleanup failed:', error);
      throw error;
    }
  }
}

export default ArticleScheduler;