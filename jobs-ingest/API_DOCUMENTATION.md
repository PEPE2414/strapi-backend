# API Documentation - All HTTP Requests and URL Sources

## Folder Structure
All API code is stored in: `strapi-backend/jobs-ingest/src/sources/`

---

## 1. RapidAPI Sources (via RapidAPI Platform)

### 1.1 Jobs API 14 (LinkedIn Enhanced Feed)
**File:** `sources/jobsApi14.ts`
**Base URL:** `https://jobs-api14.p.rapidapi.com/v2/linkedin/search`
**Method:** `GET`
**Headers:**
- `X-RapidAPI-Key`: `process.env.RAPIDAPI_KEY`
- `X-RapidAPI-Host`: `jobs-api14.p.rapidapi.com`

**Query Parameters:**
- `query`: Search term (e.g., "graduate engineering uk")
- `experienceLevels`: Comma-separated (e.g., "entry_level,mid_level")
- `workplaceTypes`: Comma-separated (e.g., "on_site,hybrid,remote")
- `location`: "United Kingdom"
- `datePosted`: "week" or "all"
- `employmentTypes`: Comma-separated (e.g., "contractor,fulltime,parttime")

**Example Request:**
```
GET https://jobs-api14.p.rapidapi.com/v2/linkedin/search?query=graduate%20engineering%20uk&experienceLevels=entry_level&workplaceTypes=on_site&location=United%20Kingdom&datePosted=week&employmentTypes=fulltime
```

---

### 1.2 JSearch API
**File:** `sources/jsearch.ts`
**Base URL:** `https://jsearch.p.rapidapi.com/search`
**Method:** `GET`
**Headers:**
- `X-RapidAPI-Key`: `process.env.RAPIDAPI_KEY`
- `X-RapidAPI-Host`: `jsearch.p.rapidapi.com`

**Query Parameters:**
- `query`: Search term
- `country`: "uk"
- `page`: "1"
- `num_pages`: "10" (10 pages = 100 jobs max)
- `date_posted`: "week" or "all"
- `employment_types`: "FULLTIME,INTERN,CONTRACTOR,PARTTIME"
- `job_requirements`: "no_experience,under_3_years_experience"

**Example Request:**
```
GET https://jsearch.p.rapidapi.com/search?query=graduate%20scheme&country=uk&page=1&num_pages=10&date_posted=week&employment_types=FULLTIME,INTERN,CONTRACTOR,PARTTIME&job_requirements=no_experience,under_3_years_experience
```

---

### 1.3 LinkedIn Jobs API
**File:** `sources/linkedinJobs.ts`
**Base URL:** `https://linkedin-job-search-api.p.rapidapi.com/{endpoint}`
**Method:** `GET`
**Headers:**
- `X-RapidAPI-Key`: `process.env.RAPIDAPI_KEY`
- `X-RapidAPI-Host`: `linkedin-job-search-api.p.rapidapi.com`

**Endpoints:**
- `/search` (backlog mode)
- `/active-jb-24h` (recent jobs)

**Query Parameters:**
- `title_filter`: Encoded search term (e.g., `"graduate scheme"`)
- `location_filter`: `"United Kingdom"`
- `description_type`: "text"
- `date_posted`: "week" or "all"
- `limit`: "100"
- `offset`: "0", "100", "200", etc.

**Example Request:**
```
GET https://linkedin-job-search-api.p.rapidapi.com/active-jb-24h?title_filter=%22graduate%20scheme%22&location_filter=%22United%20Kingdom%22&description_type=text&date_posted=week&limit=100&offset=0
```

---

### 1.4 Active Jobs DB (RapidAPI)
**File:** `sources/rapidapiActiveJobs.ts`
**Base URL:** `https://active-jobs-db.p.rapidapi.com/active-ats-24h`
**Method:** `GET`
**Headers:**
- `X-RapidAPI-Key`: `process.env.RAPIDAPI_KEY`
- `X-RapidAPI-Host`: `active-jobs-db.p.rapidapi.com`

**Query Parameters:**
- `title_filter`: Encoded search term (e.g., `"graduate"`)
- `location_filter`: `"United Kingdom"`
- `limit`: "100"
- `offset`: "0", "100", "200", etc.

**Example Request:**
```
GET https://active-jobs-db.p.rapidapi.com/active-ats-24h?title_filter=%22graduate%22&location_filter=%22United%20Kingdom%22&limit=100&offset=0
```

---

### 1.5 Glassdoor Real-Time API
**File:** `sources/glassdoorJobs.ts`
**Base URL:** `https://glassdoor-real-time.p.rapidapi.com/jobs/search`
**Method:** `GET`
**Headers:**
- `X-RapidAPI-Key`: `process.env.RAPIDAPI_KEY`
- `X-RapidAPI-Host`: `glassdoor-real-time.p.rapidapi.com`

**Query Parameters:**
- `query`: Search term
- `location`: "United Kingdom"
- `page`: "1", "2", etc.

**Example Request:**
```
GET https://glassdoor-real-time.p.rapidapi.com/jobs/search?query=graduate%20scheme&location=United%20Kingdom&page=1
```

---

### 1.6 EchoJobs API
**File:** `sources/echoJobs.ts`
**Base URL:** `https://jobs-api22.p.rapidapi.com/tags` (fallback: `/v1/search`)
**Method:** `GET`
**Headers:**
- `X-RapidAPI-Key`: `process.env.RAPIDAPI_KEY`
- `X-RapidAPI-Host`: `jobs-api22.p.rapidapi.com`

**Query Parameters:**
- `levels`: Job level (e.g., "entry")
- `locations`: Location filter
- `industry`: Industry filter
- `focuses`: Focus areas
- `remote`: "true" or "false"
- `sort`: "date" (for backlog mode)

**Example Request:**
```
GET https://jobs-api22.p.rapidapi.com/tags?levels=entry&locations=United%20Kingdom&industry=engineering
```

---

### 1.7 Indeed Company API
**File:** `sources/indeedCompany.ts`
**Base URL:** `https://indeed12.p.rapidapi.com/company/{companyId}/jobs`
**Method:** `GET`
**Headers:**
- `X-RapidAPI-Key`: `process.env.RAPIDAPI_KEY`
- `X-RapidAPI-Host`: `indeed12.p.rapidapi.com`

**Query Parameters:**
- `locality`: Location (e.g., "United Kingdom")
- `start`: Page number (1, 2, 3, etc.)

**Example Request:**
```
GET https://indeed12.p.rapidapi.com/company/google/jobs?locality=United%20Kingdom&start=1
```

---

## 2. ATS Platform APIs (Direct)

### 2.1 Greenhouse
**File:** `sources/greenhouse.ts`
**Base URLs:**
- Primary: `https://boards.greenhouse.io/{board}/embed/job_board?content=true`
- Fallback: `https://boards-api.greenhouse.io/v1/boards/{board}/jobs`

**Method:** `GET`
**Headers:**
- `Accept`: `application/json`
- `User-Agent`: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`

**Example Request:**
```
GET https://boards.greenhouse.io/stripe/embed/job_board?content=true
```

---

### 2.2 Lever
**File:** `sources/lever.ts`
**Base URL:** `https://api.lever.co/v0/postings/{company}?mode=json`
**Method:** `GET`
**Headers:**
- `Accept`: `application/json`

**Example Request:**
```
GET https://api.lever.co/v0/postings/netflix?mode=json
```

---

### 2.3 Workable
**File:** `sources/workable.ts`
**Base URLs:**
- Primary: `https://{company}.workable.com/api/v3/jobs?state=published`
- Fallback: `https://{company}.workable.com/api/v2/jobs?state=published`

**Method:** `GET`
**Headers:**
- `Accept`: `application/json`

**Example Request:**
```
GET https://hoare-lea.workable.com/api/v3/jobs?state=published
```

---

### 2.4 Ashby
**File:** `sources/ashby.ts`
**Base URLs:**
- Primary: `https://jobs.ashbyhq.com/api/non_authenticated/job_board?organization_slug={slug}`
- Fallback: `https://jobs.ashbyhq.com/{organizationSlug}`

**Method:** `GET`
**Headers:**
- `Accept`: `application/json`

**Example Request:**
```
GET https://jobs.ashbyhq.com/api/non_authenticated/job_board?organization_slug=monzo
```

---

### 2.5 Teamtailor
**File:** `sources/teamtailor.ts`
**Base URL:** `https://api.teamtailor.com/v1/jobs?host={host}.teamtailor.com`
**Method:** `GET`
**Headers:**
- `Accept`: `application/json`
- `Authorization`: `Token token="public"`

**Example Request:**
```
GET https://api.teamtailor.com/v1/jobs?host=costain.teamtailor.com
```

---

## 3. Internal Strapi API

### 3.1 Strapi Jobs API
**File:** `lib/strapi.ts`
**Base URL:** `process.env.STRAPI_API_URL` (default: `https://api.effort-free.co.uk/api`)
**Endpoints:**
- `GET /jobs/test-auth` - Test authentication
- `POST /jobs/bulk-upsert` - Bulk upsert jobs

**Headers:**
- `x-seed-secret`: `process.env.STRAPI_INGEST_SECRET`
- `Content-Type`: `application/json`

**Example Request:**
```
POST https://api.effort-free.co.uk/api/jobs/bulk-upsert
Headers:
  x-seed-secret: {SECRET}
  Content-Type: application/json
Body:
  {
    "jobs": [...]
  }
```

---

## 4. Perplexity API (URL Discovery)

**File:** `lib/perplexityUrlDiscovery.ts`
**Base URL:** `https://api.perplexity.ai/chat/completions`
**Method:** `POST`
**Headers:**
- `Authorization`: `Bearer ${process.env.PERPLEXITY_API_KEY}`
- `Content-Type`: `application/json`

**Request Body:**
```json
{
  "model": "sonar" (or fallback models),
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant that finds job board URLs..."
    },
    {
      "role": "user",
      "content": "What is the current working Greenhouse job board URL for {company}?"
    }
  ],
  "max_tokens": 1000,
  "temperature": 0.1
}
```

---

## 5. SmartProxy (Residential Proxy)

**File:** `lib/cloudflareBypass.ts`
**Base URL:** `http://{username}:{password}@{endpoint}`
**Method:** `GET` (via proxy)
**Configuration:**
- `SMARTPROXY_USERNAME`: Username
- `SMARTPROXY_PASSWORD`: Password
- `SMARTPROXY_ENDPOINT`: Proxy endpoint

**Usage:** Used for fetching URLs that block direct requests (Reed, TotalJobs, etc.)

---

## 6. Web Scraping (Direct HTTP)

### 6.1 Job Boards
**File:** `sources/jobBoards.ts`
**URLs Scraped:**
- TargetJobs: `https://targetjobs.co.uk/*`
- Milkround: `https://www.milkround.com/*`
- Prospects: `https://www.prospects.ac.uk/*`
- Trackr: `https://the-trackr.com/*`
- BrightNetwork: Various URLs
- RateMyPlacement: Various URLs
- And more...

**Method:** `GET` (via `smartFetch` or `fetchWithCloudflareBypass`)

---

### 6.2 Sitemap Scraping
**File:** `sources/sitemapGeneric.ts`
**URLs:** Extracted from sitemaps (e.g., `https://www.reed.co.uk/sitemap.xml`)
**Method:** `GET` (via `get()`, `fetchWithCloudflareBypass()`, or `fetchWithBrowser()`)

---

### 6.3 RSS Feeds
**File:** `sources/rssFeeds.ts`
**URLs:**
- TotalJobs RSS: `https://www.totaljobs.com/jobs/rss`
- Various other RSS/Atom feeds

**Method:** `GET`

---

## 7. Browser Automation (Playwright)

**File:** `lib/browserAutomation.ts`
**Technology:** Playwright (Chromium)
**Usage:** For JavaScript-rendered content
**Proxy Support:** Uses SmartProxy if configured
**Method:** Browser automation (not direct HTTP)

---

## Environment Variables Required

```bash
# RapidAPI
RAPIDAPI_KEY=your_rapidapi_key

# Perplexity
PERPLEXITY_API_KEY=your_perplexity_key

# SmartProxy
SMARTPROXY_USERNAME=your_username
SMARTPROXY_PASSWORD=your_password
SMARTPROXY_ENDPOINT=your_endpoint

# Strapi
STRAPI_API_URL=https://api.effort-free.co.uk/api
STRAPI_INGEST_SECRET=your_secret
```

---

## Rate Limiting

- **RapidAPI**: Varies by plan (JSearch: 200K/month, LinkedIn: 10K/month)
- **Perplexity**: Based on API plan
- **SmartProxy**: Based on subscription
- **Direct Scraping**: 2-3 second delays between requests
- **Browser Automation**: Slower (5-10 seconds per page)

---

## Summary by Folder

| Folder | Files | Purpose |
|--------|-------|---------|
| `sources/` | All API scrapers | External API integrations |
| `lib/` | Utility functions | Strapi API, Perplexity, SmartProxy, Browser automation |

