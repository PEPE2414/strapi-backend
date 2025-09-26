# Jobs Ingest Pipeline - Deployment Guide

## Overview

This guide covers deploying the jobs ingestion pipeline to production, including environment setup, monitoring, and maintenance.

## Prerequisites

- Node.js 20+ 
- Strapi v5 backend running
- GitHub repository with Actions enabled
- OpenAI API key (optional, for LLM features)

## Environment Setup

### 1. Strapi Backend Configuration

Ensure your Strapi backend has the following environment variables:

```bash
# In your Strapi .env file
STRAPI_INGEST_SECRET=your-secure-secret-here
SEED_SECRET=your-secure-secret-here  # Alternative secret name
```

### 2. GitHub Secrets

Add these secrets to your GitHub repository:

- `STRAPI_API_URL`: Your Strapi API endpoint (e.g., `https://api.effort-free.co.uk/api`)
- `STRAPI_INGEST_SECRET`: The same secret used in Strapi
- `OPENAI_API_KEY`: Your OpenAI API key (optional)

### 3. Database Migration

Run the database migration to create indexes:

```bash
cd strapi-backend
npm run strapi db:migrate
```

## Deployment Steps

### 1. Install Dependencies

```bash
# In the jobs-ingest directory
npm install
```

### 2. Configure Job Sources

Edit `src/config/sources.ts` to add your target companies:

```typescript
export const GREENHOUSE_BOARDS = [
  'your-company-board',
  'another-company-board'
];

export const LEVER_COMPANIES = [
  'your-company',
  'another-company'
];

export const MANUAL_URLS = [
  'https://company.com/careers/job/123',
  'https://another-company.com/positions/456'
];
```

### 3. Test Locally

```bash
# Test individual components
npm run test

# Test full pipeline (requires environment variables)
npm run dev
```

### 4. Deploy to GitHub Actions

The pipeline is configured to run automatically every 2 hours via GitHub Actions. The workflow file is already created at `.github/workflows/jobs-ingest.yml`.

To trigger manually:
1. Go to your GitHub repository
2. Navigate to Actions tab
3. Select "Jobs Ingest" workflow
4. Click "Run workflow"

## Monitoring & Maintenance

### 1. Log Monitoring

Monitor the GitHub Actions logs for:
- Successful job ingestion counts
- Failed source scraping attempts
- LLM processing statistics
- Strapi API errors

### 2. Database Monitoring

Monitor your Strapi database for:
- Job count growth
- Duplicate job detection (via hash field)
- Performance of recommendation queries

### 3. Rate Limiting

The pipeline includes built-in rate limiting:
- Respects robots.txt files
- Uses Bottleneck for request throttling
- Random jitter between requests
- Configurable concurrency limits

### 4. Error Handling

The pipeline includes comprehensive error handling:
- Individual source failures don't stop the entire pipeline
- LLM processing failures are logged but don't block ingestion
- Strapi API errors are caught and reported
- Invalid job data is skipped with warnings

## Scaling Considerations

### 1. Source Management

As you add more sources:
- Monitor total execution time in GitHub Actions
- Consider splitting into multiple workflows for different source types
- Implement source-specific rate limiting

### 2. Database Performance

For high-volume ingestion:
- Monitor database connection limits
- Consider batch processing for large job sets
- Implement database connection pooling

### 3. LLM Usage

To control OpenAI costs:
- Monitor token usage in logs
- Adjust `maxOut` parameters in LLM calls
- Consider disabling LLM features for non-critical sources

## Troubleshooting

### Common Issues

1. **Strapi API Authentication Errors**
   - Verify `STRAPI_INGEST_SECRET` matches between pipeline and Strapi
   - Check Strapi API endpoint URL

2. **Source Scraping Failures**
   - Check if target websites have changed their structure
   - Verify robots.txt compliance
   - Monitor for rate limiting responses

3. **Database Performance Issues**
   - Ensure indexes are created (run migration)
   - Monitor query performance in Strapi admin
   - Consider archiving old jobs

4. **GitHub Actions Timeout**
   - Increase timeout in workflow file if needed
   - Consider reducing source batch sizes
   - Implement parallel processing for independent sources

### Debug Mode

To run in debug mode locally:

```bash
# Set debug environment variable
export DEBUG=jobs-ingest:*

# Run with verbose logging
npm run dev
```

## Security Considerations

1. **API Secrets**: Never commit secrets to version control
2. **Rate Limiting**: Respect target website terms of service
3. **Data Privacy**: Ensure compliance with data protection regulations
4. **Access Control**: Limit Strapi ingest endpoint access

## Performance Optimization

1. **Concurrent Processing**: Adjust `MAX_CONCURRENCY` based on target site capacity
2. **Caching**: Implement Redis caching for frequently accessed data
3. **Database Indexes**: Monitor and optimize database queries
4. **Source Prioritization**: Focus on high-quality, high-volume sources first

## Maintenance Schedule

- **Weekly**: Review ingestion logs and success rates
- **Monthly**: Update source configurations and add new companies
- **Quarterly**: Review and optimize database performance
- **As Needed**: Update dependencies and security patches
