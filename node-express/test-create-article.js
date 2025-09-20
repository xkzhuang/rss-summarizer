// Quick test script to create a test article
import { Article, Feed, connectDatabase, syncDatabase } from './backend/models/index.js';

async function createTestArticle() {
  try {
    await connectDatabase();
    await syncDatabase();

    // Check if feeds exist
    const feeds = await Feed.findAll();
    console.log('Available feeds:', feeds.length);

    if (feeds.length === 0) {
      console.log('No feeds found, creating a test feed first...');
      const testFeed = await Feed.create({
        url: 'https://example.com/rss.xml',
        title: 'Test Feed',
        description: 'A test RSS feed',
        link: 'https://example.com',
        isActive: true,
        lastFetched: new Date(),
      });
      console.log('Test feed created:', testFeed.id);
    }

    // Get first feed
    const firstFeed = await Feed.findOne();
    console.log('Using feed ID:', firstFeed.id);

    // Create test article
    const testArticle = await Article.create({
      feedId: firstFeed.id,
      title: 'Test Article for Summarization',
      link: 'https://example.com/article/1',
      pubDate: new Date(),
      rawContent: `
        This is a comprehensive test article created for testing the summarization functionality.
        
        The article discusses various topics including technology trends, artificial intelligence,
        and the future of software development. It provides detailed insights into how AI is 
        transforming the way we build and interact with applications.
        
        Key points covered in this article:
        1. The importance of AI in modern software development
        2. How machine learning algorithms are being integrated into applications
        3. Best practices for implementing AI-powered features
        4. The ethical considerations of AI development
        
        This article serves as an excellent example for testing summarization algorithms
        as it contains structured content with clear main points and supporting details.
      `,
      author: 'Test Author',
      guid: 'test-article-1',
      categories: ['Technology', 'AI', 'Development'],
    });

    console.log('✅ Test article created successfully!');
    console.log('Article ID:', testArticle.id);
    console.log('Article Title:', testArticle.title);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test article:', error);
    process.exit(1);
  }
}

createTestArticle();