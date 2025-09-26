# Jobs Ingest Pipeline

A production-ready job scraping pipeline that normalizes job data from multiple sources and pushes to Strapi v5.

## Features

- **Hybrid scraping approach**: JSON-LD → HTML → Playwright fallback
- **Multiple source adapters**: Greenhouse, Lever, and generic sitemap scraping
- **Normalized schema**: All jobs converted to canonical format
- **Secure upsert**: Idempotent job ingestion via Strapi API
- **LLM assistance**: Optional OpenAI integration for text cleanup
- **Rate limiting**: Built-in politeness controls and robots.txt respect

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp env.example .env
```

3. Configure environment variables:
- `STRAPI_API_URL`: Your Strapi API endpoint
- `STRAPI_INGEST_SECRET`: Secret for secure ingestion
- `OPENAI_API_KEY`: Optional, for LLM text cleanup
- `USER_AGENT`: Bot user agent string
- `MAX_CONCURRENCY`: Concurrent request limit

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Source Configuration

Edit `src/index.ts` to configure your job sources:

```typescript
// ATS sources
batches.push(scrapeGreenhouse('company-board'));
batches.push(scrapeLever('company-name'));

// Manual URLs
batches.push(scrapeFromUrls([
  'https://example.com/job/123',
  'https://company.com/careers/position'
], 'site:manual'));
```

## Job Schema

All jobs are normalized to this canonical format:

```typescript
{
  source: string;           // Source identifier
  sourceUrl: string;        // Original job URL
  title: string;            // Job title
  company: {                // Company info
    name: string;
    website?: string;
    logoUrl?: string;
  };
  location?: string;        // Location
  descriptionHtml?: string; // Raw HTML description
  descriptionText?: string; // Cleaned text description
  applyUrl: string;         // Final apply URL
  deadline?: string;        // ISO8601 deadline
  jobType: 'internship'|'placement'|'graduate'|'other';
  salary?: {               // Normalized salary
    min?: number;
    max?: number;
    currency?: string;
    period?: string;
  };
  startDate?: string;      // ISO8601 start date
  endDate?: string;        // ISO8601 end date
  duration?: string;       // Duration description
  experience?: string;     // Experience requirements
  companyPage?: string;    // Company careers page
  relatedDegree?: string[]; // Related degree fields
  degreeLevel?: string[];  // Required degree levels
  postedAt?: string;       // ISO8601 posted date
  slug: string;            // Unique slug
  hash: string;            // Idempotency hash
}
```

## Deployment

The pipeline is designed to run via GitHub Actions every 2 hours. See `.github/workflows/jobs-ingest.yml` for the configuration.

## Rate Limiting & Compliance

- Respects robots.txt files
- Built-in rate limiting with Bottleneck
- Random jitter between requests
- Proper User-Agent headers
- HEAD requests for URL resolution

## LLM Integration

Optional OpenAI integration for text cleanup:
- Converts HTML descriptions to clean text
- Only used when rules-based parsing fails
- Temperature set to 0 for consistency
- Token limits to control costs
