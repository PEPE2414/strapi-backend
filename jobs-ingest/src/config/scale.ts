// Configuration for scaling to 25k+ pages
export const SCALE_CONFIG = {
  // Batch processing
  URL_BATCH_SIZE: 15,        // URLs per batch for generic scraping (increased from 10)
  INGEST_BATCH_SIZE: 150,    // Jobs per batch for Strapi ingestion (increased from 100)
  LLM_BATCH_SIZE: 75,        // Jobs per batch for LLM processing (increased from 50)
  
  // Rate limiting - more aggressive for faster scraping
  MAX_CONCURRENT: 10,        // Max concurrent requests (increased from 6)
  MIN_TIME_BETWEEN: 800,     // 0.8 seconds between requests (reduced from 1000ms)
  RESERVOIR_SIZE: 1500,      // Request reservoir size (increased from 1000)
  RESERVOIR_REFILL: 60,      // Refill every 60 seconds
  
  // Memory management
  MAX_JOBS_IN_MEMORY: 7500,  // Max jobs to keep in memory at once (increased from 5000)
  CLEANUP_INTERVAL: 1000,    // Cleanup every 1000 jobs
  
  // Error handling
  MAX_RETRIES: 3,            // Max retries for failed requests
  RETRY_DELAY: 5000,         // 5 seconds between retries
  SKIP_FAILED_AFTER: 3,      // Skip URL after 3 failures
  
  // Progress tracking
  PROGRESS_INTERVAL: 50,     // Log progress every 50 jobs (more frequent logging)
  STATS_INTERVAL: 500,       // Log stats every 500 jobs (more frequent)
};

// Source-specific configurations
export const SOURCE_CONFIGS = {
  greenhouse: {
    priority: 1,              // High priority (fast API)
    maxConcurrent: 10,
    timeout: 30000,           // 30 seconds
  },
  lever: {
    priority: 1,              // High priority (fast API)
    maxConcurrent: 10,
    timeout: 30000,           // 30 seconds
  },
  generic: {
    priority: 3,              // Lower priority (slow scraping)
    maxConcurrent: 3,
    timeout: 60000,           // 60 seconds
    respectRobots: true,
  },
  sitemap: {
    priority: 2,              // Medium priority
    maxConcurrent: 5,
    timeout: 45000,           // 45 seconds
  }
};

// Expected performance metrics for 25k pages
export const PERFORMANCE_TARGETS = {
  totalPages: 25000,
  expectedDuration: 7200,     // 2 hours
  targetRate: 3.5,            // 3.5 pages/second
  maxMemoryUsage: 512,        // 512MB
  successRate: 0.95,          // 95% success rate
};
