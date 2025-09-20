#!/usr/bin/env node

/**
 * Database Migration Script
 * Adds duplicate prevention constraints to the articles table
 */

import { connectDatabase } from '../models/index.js';
import { logger } from '../middlewares/errorHandler.js';

async function runMigration() {
  let sequelize = null;
  
  try {
    console.log('🔄 Starting database migration for duplicate prevention...');
    
    // Connect to database
    sequelize = await connectDatabase();
    
    // Get the query interface
    const queryInterface = sequelize.getQueryInterface();
    
    console.log('📋 Checking existing table structure...');
    
    // Check if indexes already exist
    const indexes = await queryInterface.showIndex('articles');
    const existingIndexNames = indexes.map(idx => idx.name);
    
    console.log('📊 Existing indexes:', existingIndexNames);
    
    // 1. Add composite unique index for feedId + guid (where guid is not null)
    const feedGuidIndexName = 'articles_feed_guid_unique';
    if (!existingIndexNames.includes(feedGuidIndexName)) {
      console.log('➕ Adding unique constraint for feedId + guid...');
      try {
        await sequelize.query(`
          CREATE UNIQUE INDEX CONCURRENTLY "${feedGuidIndexName}" 
          ON articles ("feedId", "guid") 
          WHERE "guid" IS NOT NULL AND "guid" != '';
        `);
        console.log('✅ Added unique constraint for feedId + guid');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️  Index already exists:', feedGuidIndexName);
        } else {
          console.error('❌ Error adding feedId + guid constraint:', error.message);
        }
      }
    } else {
      console.log('ℹ️  Unique constraint for feedId + guid already exists');
    }
    
    // 2. Add index for feedId + title (for faster duplicate checking by title)
    const feedTitleIndexName = 'articles_feed_title_idx';
    if (!existingIndexNames.includes(feedTitleIndexName)) {
      console.log('➕ Adding index for feedId + title...');
      try {
        await sequelize.query(`
          CREATE INDEX CONCURRENTLY "${feedTitleIndexName}" 
          ON articles ("feedId", "title");
        `);
        console.log('✅ Added index for feedId + title');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️  Index already exists:', feedTitleIndexName);
        } else {
          console.error('❌ Error adding feedId + title index:', error.message);
        }
      }
    } else {
      console.log('ℹ️  Index for feedId + title already exists');
    }
    
    // 3. Add index for pubDate (for faster cleanup queries)
    const pubDateIndexName = 'articles_pubdate_idx';
    if (!existingIndexNames.includes(pubDateIndexName)) {
      console.log('➕ Adding index for pubDate...');
      try {
        await sequelize.query(`
          CREATE INDEX CONCURRENTLY "${pubDateIndexName}" 
          ON articles ("pubDate");
        `);
        console.log('✅ Added index for pubDate');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('ℹ️  Index already exists:', pubDateIndexName);
        } else {
          console.error('❌ Error adding pubDate index:', error.message);
        }
      }
    } else {
      console.log('ℹ️  Index for pubDate already exists');
    }
    
    // 4. Clean up any existing duplicates (optional - run with caution)
    if (process.argv.includes('--clean-duplicates')) {
      console.log('🧹 Cleaning up existing duplicates...');
      
      // Find duplicate articles by feedId + link
      const duplicatesByLink = await sequelize.query(`
        SELECT "feedId", "link", COUNT(*) as count, 
               STRING_AGG(id::text, ',') as ids
        FROM articles 
        WHERE "link" IS NOT NULL 
        GROUP BY "feedId", "link" 
        HAVING COUNT(*) > 1;
      `, { type: sequelize.QueryTypes.SELECT });
      
      console.log(`Found ${duplicatesByLink.length} groups of duplicate articles by link`);
      
      // Remove duplicates, keeping the newest one
      for (const duplicate of duplicatesByLink) {
        const ids = duplicate.ids.split(',').map(id => parseInt(id));
        const idsToDelete = ids.slice(0, -1); // Keep the last (newest) one
        
        if (idsToDelete.length > 0) {
          await sequelize.query(`
            DELETE FROM articles WHERE id IN (${idsToDelete.join(',')});
          `);
          console.log(`🗑️  Removed ${idsToDelete.length} duplicate articles for link: ${duplicate.link}`);
        }
      }
      
      // Find duplicate articles by feedId + guid
      const duplicatesByGuid = await sequelize.query(`
        SELECT "feedId", "guid", COUNT(*) as count, 
               STRING_AGG(id::text, ',') as ids
        FROM articles 
        WHERE "guid" IS NOT NULL AND "guid" != ''
        GROUP BY "feedId", "guid" 
        HAVING COUNT(*) > 1;
      `, { type: sequelize.QueryTypes.SELECT });
      
      console.log(`Found ${duplicatesByGuid.length} groups of duplicate articles by guid`);
      
      // Remove duplicates by GUID
      for (const duplicate of duplicatesByGuid) {
        const ids = duplicate.ids.split(',').map(id => parseInt(id));
        const idsToDelete = ids.slice(0, -1); // Keep the last (newest) one
        
        if (idsToDelete.length > 0) {
          await sequelize.query(`
            DELETE FROM articles WHERE id IN (${idsToDelete.join(',')});
          `);
          console.log(`🗑️  Removed ${idsToDelete.length} duplicate articles for guid: ${duplicate.guid}`);
        }
      }
    }
    
    // 5. Get final statistics
    const stats = await sequelize.query(`
      SELECT 
        COUNT(*) as total_articles,
        COUNT(DISTINCT "feedId") as unique_feeds,
        COUNT(DISTINCT "link") as unique_links,
        COUNT("guid") as articles_with_guid,
        COUNT(DISTINCT "guid") as unique_guids
      FROM articles;
    `, { type: sequelize.QueryTypes.SELECT });
    
    console.log('\n📈 Article Statistics:');
    console.log(`  Total Articles: ${stats[0].total_articles}`);
    console.log(`  Unique Feeds: ${stats[0].unique_feeds}`);
    console.log(`  Unique Links: ${stats[0].unique_links}`);
    console.log(`  Articles with GUID: ${stats[0].articles_with_guid}`);
    console.log(`  Unique GUIDs: ${stats[0].unique_guids}`);
    
    console.log('\n✅ Database migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    logger.error('Database migration failed:', error);
    process.exit(1);
    
  } finally {
    if (sequelize) {
      await sequelize.close();
    }
  }
}

// Show usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
📚 Database Migration Script - Duplicate Prevention

Usage:
  node backend/scripts/migrate-duplicate-prevention.js [options]

Options:
  --clean-duplicates  Clean up existing duplicate articles (CAUTION: This will delete data)
  --help, -h          Show this help message

Examples:
  # Run migration only (recommended)
  node backend/scripts/migrate-duplicate-prevention.js
  
  # Run migration and clean existing duplicates (use with caution)
  node backend/scripts/migrate-duplicate-prevention.js --clean-duplicates

⚠️  WARNING: Always backup your database before running migrations!
  `);
  process.exit(0);
}

// Run the migration
runMigration();