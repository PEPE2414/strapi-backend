# Gradcracker.com Cloudflare Bypass Scraper

This scraper bypasses Cloudflare protection to scrape job listings from gradcracker.com for educational research purposes.

## How It Works

The scraper uses **Playwright** (a browser automation tool) to:
1. Launch a real Chromium browser with stealth settings
2. Navigate to gradcracker.com pages
3. Wait for Cloudflare challenges to complete automatically
4. Extract job listings from the rendered HTML
5. Parse and structure the data

## Why This Works

Cloudflare detects automated requests by checking:
- Browser fingerprints
- JavaScript execution
- User interaction patterns
- Request headers

Playwright runs a **real browser**, so:
- ✅ JavaScript executes normally
- ✅ Cloudflare challenges complete automatically
- ✅ Browser fingerprints look legitimate
- ✅ Headers match real browsers

## Installation

Dependencies are already installed:
- `playwright` - Browser automation
- `cheerio` - HTML parsing

Make sure Playwright browsers are installed:
```bash
npm run postinstall
# or manually:
npx playwright install chromium
```

## Usage

### Basic Usage

Scrape the default engineering graduate jobs page:
```bash
npm run jobs:scrape-gradcracker
```

### Advanced Usage

Scrape a specific path with multiple pages:
```bash
npm run jobs:scrape-gradcracker -- --path="/search/aerospace/engineering-graduate-jobs" --pages=3
```

### Options

- `--path <path>` - Search path (default: `/search/all-disciplines/engineering-graduate-jobs`)
- `--pages <number>` - Number of pages to scrape (default: 1)
- `--headless <true|false>` - Run browser in headless mode (default: true)
- `--output <file>` - Output file path for JSON results
- `--help` - Show help message

### Examples

```bash
# Scrape first page only
npm run jobs:scrape-gradcracker

# Scrape 3 pages of aerospace jobs
npm run jobs:scrape-gradcracker -- --path="/search/aerospace/engineering-graduate-jobs" --pages=3

# Run with visible browser (for debugging)
npm run jobs:scrape-gradcracker -- --headless=false

# Save to specific file
npm run jobs:scrape-gradcracker -- --output=my-jobs.json --pages=2
```

## Programmatic Usage

```typescript
import { scrapeGradcrackerJobs } from './lib/gradcrackerScraper';

// Simple usage
const jobs = await scrapeGradcrackerJobs();

// Advanced usage
const jobs = await scrapeGradcrackerJobs(
  '/search/aerospace/engineering-graduate-jobs',
  {
    maxPages: 3,
    headless: true,
  }
);
```

## How Cloudflare Bypass Works

### 1. Stealth Browser Configuration

The scraper configures the browser to avoid detection:

```typescript
// Disable automation flags
'--disable-blink-features=AutomationControlled'

// Realistic user agent
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...'

// Browser-like headers
'Accept': 'text/html,application/xhtml+xml...'
'Accept-Language': 'en-GB,en;q=0.9'
```

### 2. JavaScript Injection

Stealth scripts override detection properties:

```typescript
// Hide webdriver property
Object.defineProperty(navigator, 'webdriver', { get: () => false });

// Mock plugins
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

// Mock chrome object
window.chrome = { runtime: {} };
```

### 3. Challenge Detection

The scraper automatically detects and waits for Cloudflare challenges:

```typescript
// Wait for challenge indicators
await page.waitForSelector('text="Checking your browser"');

// Wait for challenge to complete
await page.waitForFunction(() => {
  const challenge = document.querySelector('#challenge-form');
  return !challenge || challenge.style.display === 'none';
});
```

## Troubleshooting

### Issue: Browser not found

**Solution**: Install Playwright browsers:
```bash
npx playwright install chromium
```

### Issue: Timeout errors

**Solution**: Increase timeout or check network:
```typescript
await scraper.scrape(url, { timeout: 60000 }); // 60 seconds
```

### Issue: No jobs found

**Solution**: The HTML structure may have changed. Run with `--headless=false` to see what's happening:
```bash
npm run jobs:scrape-gradcracker -- --headless=false
```

### Issue: Cloudflare still blocking

**Solution**: 
1. Add delays between requests
2. Use different user agents
3. Rotate IP addresses (if possible)
4. Check if site has additional protections

## Rate Limiting

**Important**: Be respectful of the website's resources:

- ✅ Add delays between requests (2+ seconds)
- ✅ Don't scrape too many pages at once
- ✅ Use during off-peak hours if possible
- ✅ Respect robots.txt

The scraper includes built-in rate limiting (2 second delays between pages).

## Output Format

Jobs are returned as `CanonicalJob` objects:

```typescript
{
  title: "Software Engineer Graduate",
  company: { name: "Tech Corp" },
  location: "London, UK",
  url: "https://www.gradcracker.com/jobs/12345",
  description: "...",
  source: "gradcracker",
  jobType: "graduate",
  postedAt: "2025-01-15T10:00:00Z",
  // ... more fields
}
```

## Ethical Considerations

⚠️ **For Educational Use Only**

- This scraper is for **educational research** purposes
- Respect the website's terms of service
- Don't overload servers with requests
- Consider reaching out to gradcracker.com for official API access
- Use responsibly and ethically

## Performance Tips

1. **Headless mode** is faster (default)
2. **Limit pages** to what you need
3. **Cache results** to avoid re-scraping
4. **Run during off-peak hours** to be respectful

## Next Steps

1. Test the scraper with a single page first
2. Adjust selectors if HTML structure differs
3. Add error handling for your use case
4. Integrate with your existing job ingestion pipeline

## Support

If you encounter issues:
1. Check the console output for errors
2. Run with `--headless=false` to see what's happening
3. Verify Playwright is installed correctly
4. Check network connectivity

