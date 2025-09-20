import { Article, Summary } from '../models/index.js';
import SummaryService from '../services/SummaryService.js';
import { logger } from '../middlewares/errorHandler.js';
import { validationResult } from 'express-validator';

class ArticleController {
  /**
   * Get article by ID
   */
  static async getArticle(req, res) {
    try {
      const { id } = req.params;
      
      const article = await Article.findByPk(id, {
        include: [
          {
            model: (await import('../models/index.js')).Feed,
            as: 'feed',
            attributes: ['id', 'title', 'url'],
          },
        ],
      });

      if (!article) {
        return res.status(404).json({
          success: false,
          message: 'Article not found',
          error: 'ARTICLE_NOT_FOUND',
        });
      }

      // Add cache-busting headers to prevent unwanted caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.json({
        success: true,
        data: {
          article: {
            id: article.id,
            title: article.title,
            link: article.link,
            pubDate: article.pubDate,
            author: article.author,
            contentPreview: article.getContentPreview(),
            categories: article.categories,
            feed: article.feed,
            createdAt: article.createdAt,
            updatedAt: article.updatedAt,
          },
        },
      });
    } catch (error) {
      logger.error('Get article failed:', { error: error.message, articleId: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch article',
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  /**
   * Get articles with pagination and filtering
   */
  static async getArticles(req, res) {
    try {
      const {
        limit = 20,
        offset = 0,
        feedId = null,
        search = null,
        userId = null,
      } = req.query;

      const parsedLimit = Math.min(parseInt(limit) || 20, 100);
      const parsedOffset = parseInt(offset) || 0;
      const parsedFeedId = feedId ? parseInt(feedId) : null;
      // Always use authenticated user ID if available, don't trust userId param
      const userIdToUse = req.user?.id;

      let articles;

      if (search) {
        // Search articles with optional feed filtering and user subscription filtering
        articles = await Article.searchArticles(
          search, 
          parsedLimit, 
          parsedOffset, 
          parsedFeedId, 
          userIdToUse
        );
      } else if (parsedFeedId) {
        // Get articles for specific feed
        if (userIdToUse) {
          // For authenticated users, ensure they're subscribed to the feed
          const { Subscription } = await import('../models/index.js');
          const subscription = await Subscription.findOne({
            where: { userId: userIdToUse, feedId: parsedFeedId }
          });
          
          if (!subscription) {
            // User is not subscribed to this feed, return empty results
            articles = { rows: [], count: 0 };
          } else {
            articles = await Article.getByFeed(parsedFeedId, parsedLimit, parsedOffset);
          }
        } else {
          // Public access to feed articles
          articles = await Article.getByFeed(parsedFeedId, parsedLimit, parsedOffset);
        }
      } else if (userIdToUse) {
        // Get articles for user's subscriptions with summaries
        articles = await Article.getUserFeedArticlesWithSummaries(userIdToUse, parsedLimit, parsedOffset);
      } else {
        // Get recent articles (public access)
        articles = await Article.getRecent(parsedLimit, parsedOffset);
      }

      const articlesData = await Promise.all(articles.rows.map(async article => {
        const articleData = {
          id: article.id,
          title: article.title,
          link: article.link,
          pubDate: article.pubDate,
          author: article.author,
          contentPreview: article.getContentPreview(),
          categories: article.categories,
          feed: article.feed,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
        };

        // Check if article has summaries and add the latest one
        if (article.summaries && article.summaries.length > 0) {
          const latestSummary = article.summaries[0]; // summaries are ordered by createdAt DESC
          articleData.hasSummary = true;
          articleData.summary = {
            id: latestSummary.id,
            text: latestSummary.summaryText,
            aiModel: latestSummary.aiModel,
            createdAt: latestSummary.createdAt,
          };
        } else {
          // For other cases where summaries aren't included in the query, check manually
          const hasSummary = await article.hasSummary();
          articleData.hasSummary = hasSummary;
          if (hasSummary) {
            const latestSummary = await article.getLatestSummary();
            if (latestSummary) {
              articleData.summary = {
                id: latestSummary.id,
                text: latestSummary.summaryText,
                aiModel: latestSummary.aiModel,
                createdAt: latestSummary.createdAt,
              };
            }
          }
        }

        return articleData;
      }));

      // Add cache-busting headers to prevent unwanted caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.json({
        success: true,
        data: {
          articles: articlesData,
          pagination: {
            total: articles.count,
            limit: parsedLimit,
            offset: parsedOffset,
            hasMore: parsedOffset + parsedLimit < articles.count,
          },
        },
      });
    } catch (error) {
      logger.error('Get articles failed:', { error: error.message, query: req.query });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch articles',
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  /**
   * Generate summary for an article
   */
  static async summarizeArticle(req, res) {
    try {
      const { id } = req.params;
      const {
        aiModel = 'gpt-3.5-turbo',
        maxTokens = 150,
        temperature = 0.3,
        customPrompt = null,
        regenerate = false,
      } = req.body;

      // Validate article exists (check outside of transaction first)
      const article = await Article.findByPk(id);
      if (!article) {
        return res.status(404).json({
          success: false,
          message: 'Article not found',
          error: 'ARTICLE_NOT_FOUND',
        });
      }

      // Check if summary already exists (unless regenerating)
      if (!regenerate) {
        const existingSummary = await Summary.findOne({
          where: { articleId: id, aiModel },
        });

        if (existingSummary) {
          return res.json({
            success: true,
            message: 'Summary already exists',
            data: {
              summary: {
                id: existingSummary.id,
                summaryText: existingSummary.summaryText,
                aiModel: existingSummary.aiModel,
                tokenCount: existingSummary.tokenCount,
                cost: existingSummary.cost,
                createdAt: existingSummary.createdAt,
              },
              fromCache: true,
            },
          });
        }
      }

      // Generate summary (SummaryService will handle its own transaction)
      const summary = await SummaryService.generateSummary(id, {
        userId: req.user?.id,
        aiModel,
        maxTokens: parseInt(maxTokens),
        temperature: parseFloat(temperature),
        customPrompt,
        // Don't pass dbTransaction since we're not in a transaction context
      });

      res.json({
        success: true,
        message: 'Summary generated successfully',
        data: {
          summary: {
            id: summary.id,
            summaryText: summary.summaryText,
            aiModel: summary.aiModel,
            tokenCount: summary.tokenCount,
            cost: summary.cost,
            createdAt: summary.createdAt,
          },
          fromCache: false,
        },
      });
    } catch (error) {
      logger.error('Summarize article failed:', { 
        error: error.message, 
        articleId: req.params.id,
        userId: req.user?.id,
        errorCode: error.code,
      });

      if (error.code === 'OPENAI_API_KEY_REQUIRED') {
        return res.status(400).json({
          success: false,
          message: error.message,
          error: {
            code: 'OPENAI_API_KEY_REQUIRED',
            userId: error.userId,
          },
        });
      }

      if (error.message.includes('OpenAI API key')) {
        return res.status(400).json({
          success: false,
          message: 'OpenAI API key required for summarization',
          error: {
            code: 'OPENAI_KEY_REQUIRED',
          },
        });
      }

      if (error.message.includes('quota exceeded')) {
        return res.status(429).json({
          success: false,
          message: 'OpenAI API quota exceeded',
          error: {
            code: 'QUOTA_EXCEEDED',
          },
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to generate summary',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  }

  /**
   * Get summaries for an article
   */
  static async getArticleSummaries(req, res) {
    try {
      const { id } = req.params;
      const { aiModel = null } = req.query;

      // Validate article exists
      const article = await Article.findByPk(id);
      if (!article) {
        return res.status(404).json({
          success: false,
          message: 'Article not found',
          error: 'ARTICLE_NOT_FOUND',
        });
      }

      // Get summaries
      const where = { articleId: id };
      if (aiModel) {
        where.aiModel = aiModel;
      }

      const summaries = await Summary.findAll({
        where,
        order: [['createdAt', 'DESC']],
      });

      res.json({
        success: true,
        data: {
          summaries: summaries.map(summary => ({
            id: summary.id,
            summaryText: summary.summaryText,
            aiModel: summary.aiModel,
            tokenCount: summary.tokenCount,
            cost: summary.cost,
            createdAt: summary.createdAt,
            updatedAt: summary.updatedAt,
          })),
          articleId: id,
        },
      });
    } catch (error) {
      logger.error('Get article summaries failed:', { 
        error: error.message, 
        articleId: req.params.id,
      });

      res.status(500).json({
        success: false,
        message: 'Failed to fetch article summaries',
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  /**
   * Bulk summarize articles
   */
  static async bulkSummarizeArticles(req, res) {
    try {
      const {
        articleIds = [],
        aiModel = 'gpt-3.5-turbo',
        maxTokens = 150,
        temperature = 0.3,
        batchSize = 5,
        delayBetweenRequests = 1000,
      } = req.body;

      if (!Array.isArray(articleIds) || articleIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Article IDs are required',
          error: 'VALIDATION_ERROR',
        });
      }

      if (articleIds.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Cannot process more than 50 articles at once',
          error: 'BATCH_SIZE_EXCEEDED',
        });
      }

      // Generate summaries in bulk
      const result = await SummaryService.bulkGenerateSummaries(articleIds, {
        userId: req.user?.id,
        aiModel,
        maxTokens: parseInt(maxTokens),
        temperature: parseFloat(temperature),
        batchSize: parseInt(batchSize),
        delayBetweenRequests: parseInt(delayBetweenRequests),
      });

      res.json({
        success: true,
        message: 'Bulk summarization completed',
        data: result,
      });
    } catch (error) {
      logger.error('Bulk summarize articles failed:', { 
        error: error.message, 
        userId: req.user?.id,
        errorCode: error.code,
      });

      if (error.code === 'OPENAI_API_KEY_REQUIRED') {
        return res.status(400).json({
          success: false,
          message: error.message,
          error: {
            code: 'OPENAI_API_KEY_REQUIRED',
            userId: error.userId,
          },
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to bulk summarize articles',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    }
  }

  /**
   * Delete article and its summaries
   */
  static async deleteArticle(req, res) {
    try {
      const { id } = req.params;
      
      // Validate article exists
      const article = await Article.findByPk(id);
      if (!article) {
        return res.status(404).json({
          success: false,
          message: 'Article not found',
          error: 'ARTICLE_NOT_FOUND',
        });
      }

      // Delete associated summaries first
      const { Summary } = await import('../models/index.js');
      await Summary.destroy({
        where: { articleId: id }
      });

      // Delete the article
      await article.destroy();

      res.json({
        success: true,
        message: 'Article and its summaries deleted successfully',
        data: {
          deletedArticleId: parseInt(id),
        },
      });
    } catch (error) {
      logger.error('Delete article failed:', { error: error.message, articleId: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Failed to delete article',
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  /**
   * Get article with full content (for testing/debugging)
   */
  static async getArticleContent(req, res) {
    try {
      const { id } = req.params;
      
      const article = await Article.findByPk(id, {
        include: [
          {
            model: (await import('../models/index.js')).Feed,
            as: 'feed',
            attributes: ['id', 'title', 'url'],
          },
        ],
      });

      if (!article) {
        return res.status(404).json({
          success: false,
          message: 'Article not found',
          error: 'ARTICLE_NOT_FOUND',
        });
      }

      res.json({
        success: true,
        data: {
          article: {
            id: article.id,
            title: article.title,
            link: article.link,
            pubDate: article.pubDate,
            author: article.author,
            rawContent: article.rawContent,
            categories: article.categories,
            feed: article.feed,
            createdAt: article.createdAt,
            updatedAt: article.updatedAt,
          },
        },
      });
    } catch (error) {
      logger.error('Get article content failed:', { error: error.message, articleId: req.params.id });
      res.status(500).json({
        success: false,
        message: 'Failed to fetch article content',
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  }
}

export default ArticleController;