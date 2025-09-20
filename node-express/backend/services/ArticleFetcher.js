import { Article, Feed } from '../models/index.js';
import Parser from 'rss-parser';
import FeedParser from 'feedparser';
import axios from 'axios';
import { logger } from '../middlewares/errorHandler.js';

class ArticleFetcher {
  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'RSS Feed Summarizer/1.0'
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
          items.push({
            title: item.title,
            link: item.link || item.guid,
            pubDate: item.pubdate || item.date,
            content: item.description || item.summary,
            contentSnippet: item.summary,
            author: item.author,
            guid: item.guid || item.link,
            categories: item.categories || []
          });
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
          console.log(`  Fallback parser User-Agent ${currentAgent + 1} failed: ${err.message}`);
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
   * Fetch articles for all active feeds
   */
  async fetchAllFeeds() {
    try {
      const feeds = await Feed.findAll({
        where: { isActive: true }
      });

      console.log(`Found ${feeds.length} active feeds to process`);

      let totalFetched = 0;
      let totalErrors = 0;

      for (const feed of feeds) {
        try {
          const articleCount = await this.fetchFeedArticles(feed);
          totalFetched += articleCount;
          console.log(`✓ Fetched ${articleCount} new articles from: ${feed.title}`);
        } catch (error) {
          totalErrors++;
          logger.error(`Failed to fetch articles for feed ${feed.id} (${feed.title}):`, error);
          console.error(`✗ Error fetching from: ${feed.title} - ${error.message}`);
        }
      }

      console.log(`\nSummary: ${totalFetched} articles fetched, ${totalErrors} feeds had errors`);
      return {
        totalFetched,
        totalErrors,
        feedsProcessed: feeds.length
      };
    } catch (error) {
      logger.error('Error in fetchAllFeeds:', error);
      throw error;
    }
  }

  /**
   * Fetch articles for a specific feed
   */
  async fetchFeedArticles(feed) {
    try {
      console.log(`Fetching articles from: ${feed.title} (${feed.url})`);
      
      let parsedFeed;
      let usingFallbackParser = false;

      try {
        // Try primary rss-parser first
        parsedFeed = await this.parser.parseURL(feed.url);
        console.log(`✓ Successfully parsed with rss-parser: ${feed.title}`);
      } catch (primaryError) {
        console.log(`⚠ rss-parser failed for ${feed.title}, trying fallback parser...`);
        console.log(`Primary parser error: ${primaryError.message}`);
        
        try {
          // Try fallback feedparser
          parsedFeed = await this.parseWithFeedParser(feed.url);
          usingFallbackParser = true;
          console.log(`✓ Successfully parsed with feedparser (fallback): ${feed.title}`);
        } catch (fallbackError) {
          console.log(`✗ Fallback parser also failed for ${feed.title}`);
          console.log(`Fallback parser error: ${fallbackError.message}`);
          throw new Error(`Both parsers failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
        }
      }

      console.log(`\n${usingFallbackParser ? '[FALLBACK PARSER]' : '[PRIMARY PARSER]'} Parsed Feed for ${feed.title}\n`, {
        title: parsedFeed.title,
        itemCount: parsedFeed.items?.length || 0,
        parser: usingFallbackParser ? 'feedparser' : 'rss-parser'
      });
      
      if (!parsedFeed.items || parsedFeed.items.length === 0) {
        console.log(`No articles found in feed: ${feed.title}`);
        return 0;
      }

      const articles = parsedFeed.items.map(item => ({
        title: item.title || 'Untitled Article',
        link: item.link || item.guid || '',
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        rawContent: item.content || item.contentSnippet || item.summary || item.description || '',
        author: item.creator || item.author || '',
        guid: item.guid || item.link || '',
        categories: item.categories || []
      }));

      // Filter out articles without links (required field) or without description/content
      const validArticles = articles.filter(article => {
        const hasLink = article.link && article.link.trim() !== '';
        const hasDescription = article.rawContent && article.rawContent.trim() !== '';
        
        if (!hasLink) {
          console.log(`  Skipping article "${article.title}" - no link`);
        }
        if (!hasDescription) {
          console.log(`  Skipping article "${article.title}" - no description/content`);
        }
        
        return hasLink && hasDescription;
      });

      console.log(`  Articles after filtering: ${validArticles.length}/${articles.length} (${articles.length - validArticles.length} skipped)`);

      if (validArticles.length === 0) {
        console.log(`No valid articles (with links and descriptions) found in feed: ${feed.title}`);
        return 0;
      }

      // Use the bulkCreateSafeWithDupeCheck method to avoid duplicates
      const newArticles = await Article.bulkCreateSafeWithDupeCheck(validArticles, feed.id);

      // Update feed's lastFetched timestamp and reset error count on success
      await feed.update({ 
        lastFetched: new Date(),
        errorCount: 0 // Reset error count on successful fetch
      });

      console.log(`✓ Successfully saved ${newArticles.length} new articles for: ${feed.title}${usingFallbackParser ? ' (using fallback parser)' : ''}`);

      return newArticles.length;
    } catch (error) {
      // Update feed with error, but don't mark as inactive immediately
      await feed.update({ 
        lastFetched: new Date(),
        errorCount: (feed.errorCount || 0) + 1
      });

      throw new Error(`Failed to fetch articles for feed "${feed.title}": ${error.message}`);
    }
  }

  /**
   * Fetch articles for a specific feed by ID
   */
  async fetchFeedById(feedId) {
    try {
      const feed = await Feed.findByPk(feedId);
      if (!feed) {
        throw new Error('Feed not found');
      }

      return await this.fetchFeedArticles(feed);
    } catch (error) {
      logger.error(`Error fetching articles for feed ${feedId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up old articles to prevent database bloat
   */
  async cleanupOldArticles(daysToKeep = 30) {
    try {
      const deleted = await Article.cleanOldArticles(daysToKeep);
      console.log(`Cleaned up ${deleted} old articles`);
      return deleted;
    } catch (error) {
      logger.error('Error cleaning up old articles:', error);
      throw error;
    }
  }
}

export default new ArticleFetcher();