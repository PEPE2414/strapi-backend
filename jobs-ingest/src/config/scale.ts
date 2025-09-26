// Configuration for scaling to 25k+ pages
export const SCALE_CONFIG = {
  // Batch processing
  URL_BATCH_SIZE: 10,        // URLs per batch for generic scraping
  INGEST_BATCH_SIZE: 100,    // Jobs per batch for Strapi ingestion
  LLM_BATCH_SIZE: 50,        // Jobs per batch for LLM processing
  
  // Rate limiting
  MAX_CONCURRENT: 6,         // Max concurrent requests
  MIN_TIME_BETWEEN: 1000,    // 1 second between requests
  RESERVOIR_SIZE: 1000,      // Request reservoir size
  RESERVOIR_REFILL: 60,      // Refill every 60 seconds
  
  // Memory management
  MAX_JOBS_IN_MEMORY: 5000,  // Max jobs to keep in memory at once
  CLEANUP_INTERVAL: 1000,    // Cleanup every 1000 jobs
  
  // Error handling
  MAX_RETRIES: 3,            // Max retries for failed requests
  RETRY_DELAY: 5000,         // 5 seconds between retries
  SKIP_FAILED_AFTER: 3,      // Skip URL after 3 failures
  
  // Progress tracking
  PROGRESS_INTERVAL: 100,    // Log progress every 100 jobs
  STATS_INTERVAL: 1000,      // Log stats every 1000 jobs
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
