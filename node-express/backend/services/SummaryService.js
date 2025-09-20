import OpenAI from 'openai';
import { Summary, Article, User, transaction } from '../models/index.js';
import { logger } from '../middlewares/errorHandler.js';

class SummaryService {
  /**
   * Initialize OpenAI client
   */
  static getOpenAIClient(apiKey = null) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    
    if (!key) {
      throw new Error('OpenAI API key not provided');
    }

    return new OpenAI({
      apiKey: key,
    });
  }

  /**
   * Generate summary for an article
   */
  static async generateSummary(articleId, options = {}) {
    const {
      userId = null,
      aiModel = 'gpt-3.5-turbo',
      maxTokens = 150,
      temperature = 0.3,
      dbTransaction = null,
      customPrompt = null,
    } = options;

    try {
      const operation = async (t) => {
        // Get article
        const article = await Article.findByPk(articleId, {
          include: [
            {
              model: (await import('../models/index.js')).Feed,
              as: 'feed',
              attributes: ['title', 'url'],
            },
          ],
          transaction: t,
        });

        if (!article) {
          throw new Error('Article not found');
        }

        // Check if summary already exists
        const existingSummary = await Summary.findOne({
          where: { articleId, aiModel },
          transaction: t,
        });

        if (existingSummary) {
          logger.info('Summary already exists:', { articleId, aiModel });
          return existingSummary;
        }

        // Get OpenAI API key
        let apiKey = null;
        if (userId) {
          const user = await User.findByPk(userId, { transaction: t });
          if (!user) {
            throw new Error('User not found');
          }
          
          const userApiKey = await user.getDecryptedOpenAIKey();
          if (userApiKey) {
            apiKey = userApiKey;
          } else {
            // User doesn't have an API key configured
            const error = new Error('OpenAI API key required. Please configure your API key.');
            error.code = 'OPENAI_API_KEY_REQUIRED';
            error.userId = userId;
            throw error;
          }
        } else {
          // Fall back to system API key if no user is specified
          apiKey = process.env.OPENAI_API_KEY;
          if (!apiKey) {
            throw new Error('OpenAI API key not configured');
          }
        }

        // Generate summary
        const summaryText = await this.callOpenAI({
          content: article.rawContent,
          title: article.title,
          feedTitle: article.feed?.title,
          aiModel,
          apiKey,
          maxTokens,
          temperature,
          customPrompt,
        });

        // Calculate cost estimate
        const tokenCount = this.estimateTokenCount(article.rawContent + summaryText);
        const cost = this.calculateCost(tokenCount, aiModel);

        // Create summary record
        const summary = await Summary.create({
          articleId,
          summaryText,
          aiModel,
          tokenCount,
          cost,
          metadata: {
            userId,
            generatedAt: new Date().toISOString(),
            settings: { maxTokens, temperature },
          },
        }, { transaction: t });

        logger.info('Summary generated successfully:', {
          articleId,
          aiModel,
          tokenCount,
          cost: `$${cost}`,
        });

        return summary;
      };

      if (dbTransaction) {
        return await operation(dbTransaction);
      } else {
        return await transaction(operation);
      }
    } catch (error) {
      logger.error('Summary generation failed:', { articleId, error: error.message });
      throw error;
    }
  }

  /**
   * Call OpenAI API to generate summary
   */
  static async callOpenAI(params) {
    const {
      content,
      title,
      feedTitle,
      aiModel,
      apiKey,
      maxTokens,
      temperature,
      customPrompt,
    } = params;

    const client = this.getOpenAIClient(apiKey);

    const systemPrompt = customPrompt || `You are a professional article summarizer. Create a concise, informative summary that captures the key points and main insights of the article. Focus on the most important information while maintaining readability.`;

    const userPrompt = `Please summarize the following article:

Title: ${title}
Source: ${feedTitle || 'Unknown'}

Content: ${content}

Please provide a clear, concise summary that highlights the main points and key insights.`;

    try {
      const startTime = Date.now();
      
      const response = await client.chat.completions.create({
        model: aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      const processingTime = Date.now() - startTime;

      const summaryText = response.choices[0]?.message?.content?.trim();
      
      if (!summaryText) {
        throw new Error('No summary generated by OpenAI');
      }

      logger.info('OpenAI API call successful:', {
        model: aiModel,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
        processingTime: `${processingTime}ms`,
      });

      return summaryText;
    } catch (error) {
      if (error.code === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded');
      } else if (error.code === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key');
      } else if (error.code === 'model_not_found') {
        throw new Error(`AI model ${aiModel} not found`);
      }
      
      logger.error('OpenAI API call failed:', { error: error.message });
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Bulk generate summaries for multiple articles
   */
  static async bulkGenerateSummaries(articleIds, options = {}) {
    const {
      userId = null,
      aiModel = 'gpt-3.5-turbo',
      batchSize = 5,
      delayBetweenRequests = 1000,
    } = options;

    const results = [];
    const errors = [];

    try {
      // Check API key availability upfront for user-based requests
      if (userId) {
        const user = await User.findByPk(userId);
        if (!user) {
          throw new Error('User not found');
        }
        
        const userApiKey = await user.getDecryptedOpenAIKey();
        if (!userApiKey) {
          const error = new Error('OpenAI API key required. Please configure your API key.');
          error.code = 'OPENAI_API_KEY_REQUIRED';
          error.userId = userId;
          throw error;
        }
      }

      // Process articles in batches to avoid rate limiting
      for (let i = 0; i < articleIds.length; i += batchSize) {
        const batch = articleIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (articleId) => {
          try {
            const summary = await this.generateSummary(articleId, {
              userId,
              aiModel,
              ...options,
            });
            return { articleId, summary, success: true };
          } catch (error) {
            errors.push({ articleId, error: error.message, code: error.code });
            return { articleId, error: error.message, code: error.code, success: false };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults.map(r => r.value || r.reason));

        // Delay between batches
        if (i + batchSize < articleIds.length && delayBetweenRequests > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        }
      }

      logger.info('Bulk summary generation completed:', {
        total: articleIds.length,
        successful: results.filter(r => r.success).length,
        failed: errors.length,
      });

      return {
        results,
        summary: {
          total: articleIds.length,
          successful: results.filter(r => r.success).length,
          failed: errors.length,
        },
        errors,
      };
    } catch (error) {
      logger.error('Bulk summary generation failed:', { error: error.message });
      throw error;
    }
  }

  /**
   * Regenerate summary with different parameters
   */
  static async regenerateSummary(summaryId, options = {}) {
    try {
      return await transaction(async (t) => {
        const existingSummary = await Summary.findByPk(summaryId, {
          include: [
            {
              model: Article,
              as: 'article',
            },
          ],
          transaction: t,
        });

        if (!existingSummary) {
          throw new Error('Summary not found');
        }

        // Delete existing summary
        await existingSummary.destroy({ transaction: t });

        // Generate new summary
        return await this.generateSummary(
          existingSummary.article.id,
          { ...options, dbTransaction: t }
        );
      });
    } catch (error) {
      logger.error('Summary regeneration failed:', { summaryId, error: error.message });
      throw error;
    }
  }

  /**
   * Get summaries with pagination and filtering
   */
  static async getSummaries(options = {}) {
    const {
      userId = null,
      aiModel = null,
      limit = 20,
      offset = 0,
      includeArticle = true,
    } = options;

    try {
      let summaries;

      if (userId) {
        summaries = await Summary.getUserFeedSummaries(userId, limit, offset, aiModel);
      } else {
        summaries = includeArticle 
          ? await Summary.getSummariesWithArticles(limit, offset, aiModel)
          : await Summary.findAndCountAll({
              where: aiModel ? { aiModel } : {},
              limit,
              offset,
              order: [['createdAt', 'DESC']],
            });
      }

      return {
        summaries: summaries.rows,
        total: summaries.count,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < summaries.count,
        },
      };
    } catch (error) {
      logger.error('Get summaries failed:', { error: error.message });
      throw error;
    }
  }

  /**
   * Search summaries by content
   */
  static async searchSummaries(query, options = {}) {
    const {
      aiModel = null,
      limit = 20,
    } = options;

    try {
      const summaries = await Summary.searchSummaries(query, limit, aiModel);

      return {
        summaries,
        query,
        count: summaries.length,
      };
    } catch (error) {
      logger.error('Summary search failed:', { query, error: error.message });
      throw error;
    }
  }

  /**
   * Get summary statistics
   */
  static async getSummaryStats() {
    try {
      const { Op } = await import('sequelize');
      const stats = await Summary.getStatsByModel();
      const totalSummaries = await Summary.count();
      
      const recentSummaries = await Summary.count({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      return {
        total: totalSummaries,
        recent24h: recentSummaries,
        byModel: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Get summary stats failed:', { error: error.message });
      throw error;
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  static estimateTokenCount(text) {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost based on model and token count
   */
  static calculateCost(tokenCount, model) {
    const pricing = {
      'gpt-3.5-turbo': 0.001 / 1000, // $0.001 per 1K tokens
      'gpt-4': 0.03 / 1000, // $0.03 per 1K tokens
      'gpt-4-turbo-preview': 0.01 / 1000, // $0.01 per 1K tokens
      'gpt-4o': 0.005 / 1000, // $0.005 per 1K tokens
      'gpt-4o-mini': 0.00015 / 1000, // $0.00015 per 1K tokens
    };

    const rate = pricing[model] || pricing['gpt-3.5-turbo'];
    return (tokenCount * rate).toFixed(6);
  }

  /**
   * Clean old summaries
   */
  static async cleanupOldSummaries(daysToKeep = 90) {
    try {
      const deletedCount = await Summary.cleanOldSummaries(daysToKeep);
      
      logger.info('Old summaries cleanup completed:', { deletedCount, daysToKeep });
      
      return { deletedCount, daysToKeep };
    } catch (error) {
      logger.error('Summary cleanup failed:', { error: error.message });
      throw error;
    }
  }
}

export default SummaryService;