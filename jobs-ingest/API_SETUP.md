# Job Scraper API Setup Guide

This guide explains how to set up API keys for the job scraper to achieve 1000+ valid jobs per run.

## Overview

The improved job scraper now prioritizes **API-based job boards** over web scraping to avoid blocking and get significantly more jobs. With API keys properly configured, you can expect:

- **Adzuna API**: 300-500 jobs per run
- **Reed API**: 400-600 jobs per run  
- **The Muse API**: 50-100 jobs per run (no key required)
- **Graduate job boards**: 100-200 jobs per run
- **ATS platforms (Greenhouse/Lever)**: 50-100 jobs per run
- **Company career pages**: 50-150 jobs per run

**Total expected**: 1000-1500+ valid jobs per run

## Required API Keys

### 1. Adzuna API (Free - Highly Recommended)

Adzuna is a UK-based job aggregator with excellent coverage of graduate and entry-level positions.

**How to get API keys:**
1. Visit: https://developer.adzuna.com/
2. Click "Sign up" and create a free account
3. After signing in, go to your dashboard
4. Copy your **App ID** and **App Key**

**Set environment variables:**
```bash
# Linux/Mac
export ADZUNA_APP_ID="your_app_id_here"
export ADZUNA_APP_KEY="your_app_key_here"

# Windows PowerShell
$env:ADZUNA_APP_ID="your_app_id_here"
$env:ADZUNA_APP_KEY="your_app_key_here"
```

**For GitHub Actions:**
1. Go to your repository settings
2. Navigate to "Secrets and variables" → "Actions"
3. Add two new repository secrets:
   - `ADZUNA_APP_ID`: Your App ID
   - `ADZUNA_APP_KEY`: Your App Key

**Free tier limits**: 250 calls per month (sufficient for daily scraping)

---

### 2. Reed API (Free - Highly Recommended)

Reed is one of the UK's largest job boards with an official API that provides access to thousands of jobs.

**How to get API key:**
1. Visit: https://www.reed.co.uk/developers
2. Fill out the registration form
3. You'll receive your API key via email (usually within 1-2 business days)

**Set environment variable:**
```bash
# Linux/Mac
export REED_API_KEY="your_api_key_here"

# Windows PowerShell
$env:REED_API_KEY="your_api_key_here"
```

**For GitHub Actions:**
1. Go to your repository settings
2. Add a new repository secret:
   - `REED_API_KEY`: Your API key

**Free tier limits**: Generous limits suitable for daily scraping

---

### 3. The Muse API (No Key Required)

The Muse API is free and doesn't require an API key. It's already configured and will work automatically.

**Coverage**: International jobs including UK positions, filtered automatically by the scraper.

---

## Optional: Additional Job Boards

### Jobs.ac.uk

While Jobs.ac.uk has an API, it's currently configured to work without authentication for basic searches. If you want enhanced access:

1. Visit: https://www.jobs.ac.uk/
2. Contact their team for API access

---

## GitHub Actions Setup

If you're running the scraper via GitHub Actions, update your workflow file (`.github/workflows/job-ingestion.yml`):

```yaml
env:
  STRAPI_INGEST_SECRET: ${{ secrets.STRAPI_INGEST_SECRET }}
  ADZUNA_APP_ID: ${{ secrets.ADZUNA_APP_ID }}
  ADZUNA_APP_KEY: ${{ secrets.ADZUNA_APP_KEY }}
  REED_API_KEY: ${{ secrets.REED_API_KEY }}
```

---

## Local Development Setup

Create a `.env` file in the `jobs-ingest` directory:

```env
# Strapi authentication
STRAPI_INGEST_SECRET=your_strapi_secret

# Adzuna API
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key

# Reed API
REED_API_KEY=your_reed_api_key
```

Then load it before running:
```bash
cd jobs-ingest
source .env  # Linux/Mac
# Or for Windows: use a .env loader

npm run start
```

---

## Verification

After setting up API keys, you can verify they're working:

1. **Check the scraper output** - You should see:
   ```
   📦 Scraping Adzuna API...
   🔄 Fetching Adzuna page 1 for "graduate"...
   📊 Found 50 jobs for "graduate" (page 1)
   ✅ Adzuna API: Found 350 jobs
   ```

2. **Check for API errors** - If you see:
   ```
   ⚠️  Adzuna API credentials not set.
   ```
   Your environment variables aren't configured correctly.

3. **Monitor job counts** - With proper API setup, you should see:
   ```
   ✅ SUCCESS: Target of 1000+ jobs met! (1247 jobs ingested)
   ```

---

## Troubleshooting

### "API credentials not set" warnings

**Problem**: Environment variables aren't being read.

**Solutions**:
- Verify the variable names are exactly correct (case-sensitive)
- In GitHub Actions, ensure secrets are added to repository settings
- For local development, make sure to restart your terminal after setting env vars

### API rate limiting

**Problem**: Getting rate limit errors from APIs.

**Solutions**:
- Adzuna: Free tier allows 250 calls/month (should be sufficient)
- Reed: Contact them if you need higher limits
- The scraper includes delays between requests to respect rate limits

### Low job counts despite API keys

**Problem**: Getting fewer than 1000 jobs even with APIs configured.

**Solutions**:
- Check that all three APIs are working (Adzuna, Reed, The Muse)
- Verify your filters aren't too restrictive in `lib/normalize.ts`
- Ensure the scraper is running long enough (60 minute timeout)
- Check the source performance report at the end of the run

---

## Architecture Changes

### New Priority System

The scraper now prioritizes sources in this order:

1. **API Job Boards** (Highest Priority)
   - Adzuna API
   - Reed API
   - The Muse API
   - Jobs.ac.uk API

2. **Graduate Job Boards** (High Priority)
   - Gradcracker
   - TARGETjobs
   - Prospects
   - Milkround
   - BrightNetwork
   - RateMyPlacement

3. **ATS Platforms** (Medium Priority)
   - Greenhouse (verified companies only)
   - Lever (verified companies only)

4. **Company Career Pages** (Low Priority - Rotated)
   - Engineering companies (Week 1)
   - Technology companies (Week 2)
   - Finance companies (Week 3)
   - Consulting companies (Week 4)
   - Manufacturing companies (Week 5)

### What Changed

- **Removed**: Direct scraping of Indeed, TotalJobs, CV Library (constant 403 blocks)
- **Added**: API-based scrapers with no blocking issues
- **Improved**: Better error handling for Greenhouse/Lever APIs
- **Reduced**: Number of company career pages (focused on verified sources)
- **Increased**: Runtime limit to 60 minutes to allow APIs to complete

---

## Cost

All the APIs used in this setup are **completely free**:

- ✅ Adzuna: Free tier (250 calls/month)
- ✅ Reed: Free with registration
- ✅ The Muse: Completely free, no key required
- ✅ Jobs.ac.uk: Free for basic access

**Total cost: £0 / $0**

---

## Support

If you encounter issues:

1. Check the scraper logs for specific error messages
2. Verify API keys are correctly set in your environment
3. Review the "Source Performance Report" at the end of each run
4. Ensure you're not hitting rate limits (reduce frequency if needed)

For API-specific issues:
- Adzuna: https://developer.adzuna.com/docs
- Reed: Contact via their developer portal
- The Muse: Check their API documentation


