import { connectDatabase, syncDatabase, closeDatabaseConnection } from '../models/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const resetDatabase = async () => {
  try {
    console.log('🔄 Starting database reset...');
    
    // Connect to database
    await connectDatabase();
    console.log('✅ Connected to database');
    
    // Force sync - this will drop and recreate all tables
    await syncDatabase({
      force: true, // This will drop existing tables and recreate them
      logging: console.log,
    });
    
    console.log('✅ Database reset successfully!');
    console.log('⚠️  All existing data has been removed');
    
    // Close connection
    await closeDatabaseConnection();
    console.log('✅ Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
};

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase();
}

export default resetDatabase;