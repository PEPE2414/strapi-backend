# 🚀 Scaling Guide: 25,000+ Job Pages

This guide explains how to scale the job scraper to handle 25,000+ pages efficiently.

## 📊 **Current Architecture for Scale**

### **Tier 1: Fast API Sources (High Priority)**
- **Greenhouse**: ~50-200 jobs per company
- **Lever**: ~50-200 jobs per company  
- **Performance**: 10-50 jobs/second
- **Memory**: Low (API responses are small)

### **Tier 2: Sitemap Discovery (Medium Priority)**
- **University job boards**: 1,000-5,000 jobs per domain
- **Company career pages**: 100-1,000 jobs per domain
- **Performance**: 2-5 jobs/second
- **Memory**: Medium (HTML parsing)

### **Tier 3: Generic Scraping (Lower Priority)**
- **Individual job pages**: 1 job per page
- **Performance**: 0.5-2 jobs/second
- **Memory**: High (full HTML processing)

## ⚙️ **Configuration for 25k Pages**

### **Environment Variables**
```bash
# Enable large-scale discovery
ENABLE_DISCOVERY=true

# Domains to discover (comma-separated)
DISCOVERY_DOMAINS=bristol.ac.uk,imperial.ac.uk,cambridge.ac.uk,oxford.ac.uk

# Scaling parameters
MAX_CONCURRENCY=6
MIN_TIME_BETWEEN=1000
RESERVOIR_SIZE=1000
RESERVOIR_REFILL=60

# Memory management
MAX_JOBS_IN_MEMORY=5000
CLEANUP_INTERVAL=1000
```

### **Expected Performance**
- **Total Pages**: 25,000
- **Duration**: ~2 hours
- **Rate**: 3.5 pages/second
- **Memory**: <512MB
- **Success Rate**: 95%+

## 🔧 **Scaling Strategies**

### **1. Batch Processing**
```typescript
// Process URLs in batches of 10
const BATCH_SIZE = 10;
for (let i = 0; i < urls.length; i += BATCH_SIZE) {
  const batch = urls.slice(i, i + BATCH_SIZE);
  // Process batch in parallel
}
```

### **2. Rate Limiting**
```typescript
// Respectful scraping with rate limits
const limiter = new Bottleneck({
  maxConcurrent: 6,        // Max 6 concurrent requests
  minTime: 1000,           // 1 second between requests
  reservoir: 1000,         // Start with 1000 requests
  reservoirRefreshAmount: 1000,
  reservoirRefreshInterval: 60000, // Refill every minute
});
```

### **3. Memory Management**
```typescript
// Process jobs in batches to avoid memory issues
const INGEST_BATCH_SIZE = 100;
for (let i = 0; i < results.length; i += INGEST_BATCH_SIZE) {
  const batch = results.slice(i, i + INGEST_BATCH_SIZE);
  await upsertJobs(batch);
}
```

### **4. Progress Monitoring**
```typescript
// Real-time progress tracking
const monitor = new ScrapingMonitor(25000);
monitor.recordSuccess(); // or recordFailure()
monitor.logFinalStats();
```

## 📈 **Performance Optimization**

### **Database Indexes**
```sql
-- Ensure these indexes exist for fast queries
CREATE INDEX idx_jobs_hash ON jobs(hash);
CREATE INDEX idx_jobs_slug ON jobs(slug);
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at);
CREATE INDEX idx_jobs_job_type ON jobs(job_type);
CREATE INDEX idx_jobs_location ON jobs(location);
```

### **Strapi Configuration**
```javascript
// config/database.js
module.exports = {
  connection: {
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    }
  }
};
```

## 🚨 **Error Handling & Recovery**

### **Retry Logic**
```typescript
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

async function scrapeWithRetry(url: string, retries = 0): Promise<CanonicalJob | null> {
  try {
    return await scrapeUrl(url);
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return scrapeWithRetry(url, retries + 1);
    }
    console.warn(`Failed to scrape ${url} after ${MAX_RETRIES} retries`);
    return null;
  }
}
```

### **Graceful Degradation**
- Skip failed URLs after 3 retries
- Continue processing even if some sources fail
- Log errors for manual review
- Maintain success rate above 95%

## 📊 **Monitoring & Alerting**

### **Key Metrics to Track**
- **Success Rate**: Should be >95%
- **Processing Rate**: Target 3.5 pages/second
- **Memory Usage**: Should stay <512MB
- **Error Rate**: Should be <5%
- **Duration**: Should complete in <2 hours

### **Logging**
```typescript
console.log(`📊 Progress: ${processed}/${total} (${successRate}% success)`);
console.log(`⚡ Rate: ${rate.toFixed(2)} jobs/sec`);
console.log(`⏱️  ETA: ${Math.round(eta / 60)} minutes`);
console.log(`💾 Memory: ${memoryUsage}MB`);
```

## 🔄 **Deployment Strategy**

### **GitHub Actions**
```yaml
# Run every 2 hours
schedule:
  - cron: "0 */2 * * *"

# Environment variables
env:
  ENABLE_DISCOVERY: true
  DISCOVERY_DOMAINS: bristol.ac.uk,imperial.ac.uk
  MAX_CONCURRENCY: 6
```

### **Railway Deployment**
- Use `npm run jobs:build` to build the pipeline
- Set environment variables in Railway dashboard
- Monitor logs for performance metrics
- Set up alerts for failures

## 🎯 **Expected Results for 25k Pages**

### **Source Breakdown**
- **Greenhouse/Lever**: 2,000-5,000 jobs (fast)
- **University Sites**: 10,000-15,000 jobs (medium)
- **Company Sites**: 5,000-10,000 jobs (slow)
- **Manual URLs**: 1,000-2,000 jobs (fast)

### **Performance Targets**
- **Total Jobs**: 18,000-32,000 jobs
- **Processing Time**: 1.5-2.5 hours
- **Success Rate**: 95%+
- **Memory Usage**: <512MB
- **Database Size**: ~50-100MB

## 🚀 **Next Steps**

1. **Test with small scale** (1,000 pages)
2. **Monitor performance** and adjust settings
3. **Scale up gradually** (5k → 10k → 25k)
4. **Set up monitoring** and alerting
5. **Optimize based on results**

## 🔧 **Troubleshooting**

### **Common Issues**
- **Memory errors**: Reduce batch sizes
- **Rate limiting**: Increase delays between requests
- **Database timeouts**: Increase connection pool size
- **Failed scrapes**: Check robots.txt compliance

### **Performance Tuning**
- Adjust `MAX_CONCURRENCY` based on target site
- Modify `BATCH_SIZE` for memory constraints
- Tune `MIN_TIME_BETWEEN` for rate limits
- Optimize database queries and indexes
