#!/usr/bin/env node

import sequelize from '../backend/config/database.js';
import ArticleFetcher from '../backend/services/ArticleFetcher.js';
import { Article } from '../backend/models/index.js';

const commands = {
  'fetch-all': async () => {
    console.log('🔄 Fetching articles from all feeds...');
    const result = await ArticleFetcher.fetchAllFeeds();
    console.log('✅ Completed:', result);
  },
  
  'fetch-feed': async (feedId) => {
    if (!feedId) {
      console.error('❌ Please provide a feed ID: npm run manage fetch-feed 1');
      return;
    }
    console.log(`🔄 Fetching articles for feed ${feedId}...`);
    const count = await ArticleFetcher.fetchFeedById(parseInt(feedId));
    console.log(`✅ Fetched ${count} new articles`);
  },
  
  'count-articles': async () => {
    const total = await Article.count();
    console.log(`📊 Total articles in database: ${total}`);
  },
  
  'recent-articles': async () => {
    const articles = await Article.findAll({
      limit: 10,
      order: [['pubDate', 'DESC']],
      attributes: ['id', 'title', 'feedId', 'pubDate', 'author']
    });
    
    console.log('📰 Most recent articles:');
    articles.forEach((article, i) => {
      const date = new Date(article.pubDate).toLocaleDateString();
      console.log(`${i + 1}. ${article.title}`);
      console.log(`   Feed ${article.feedId} | ${date} | ${article.author || 'Unknown author'}`);
      console.log('');
    });
  },
  
  'help': () => {
    console.log(`
📚 Feed Management Commands:

  fetch-all              Fetch articles from all active feeds
  fetch-feed <id>        Fetch articles for specific feed
  count-articles         Show total article count  
  recent-articles        Show 10 most recent articles
  help                   Show this help message

Usage: node scripts/manage-feeds.js <command> [args]
`);
  }
};

async function main() {
  try {
    await sequelize.authenticate();
    
    const command = process.argv[2];
    const args = process.argv.slice(3);
    
    if (!command || !commands[command]) {
      commands.help();
      process.exit(1);
    }
    
    await commands[command](...args);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();