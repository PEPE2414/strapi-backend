# Quick Start: Scraping Gradcracker.com

## 🚀 Get Started in 3 Steps

### Step 1: Install Playwright Browser (if not already installed)
```bash
cd strapi-backend
npx playwright install chromium
```

### Step 2: Run the Scraper
```bash
npm run jobs:scrape-gradcracker
```

### Step 3: Check Results
Results are saved to `gradcracker-jobs.json` in the project root.

## 📋 Common Commands

```bash
# Scrape default page (engineering graduate jobs)
npm run jobs:scrape-gradcracker

# Scrape specific category (3 pages)
npm run jobs:scrape-gradcracker -- --path="/search/aerospace/engineering-graduate-jobs" --pages=3

# Run with visible browser (for debugging)
npm run jobs:scrape-gradcracker -- --headless=false

# Save to custom file
npm run jobs:scrape-gradcracker -- --output=my-results.json
```

## 🔍 How It Bypasses Cloudflare

1. **Uses Real Browser**: Playwright runs actual Chromium, not just HTTP requests
2. **Stealth Mode**: Removes automation detection flags
3. **Auto-Waits**: Automatically waits for Cloudflare challenges to complete
4. **Realistic Headers**: Sends browser-like HTTP headers

## ⚠️ Important Notes

- **Rate Limiting**: Built-in 2-second delays between pages
- **Be Respectful**: Don't scrape too aggressively
- **Educational Use**: For university project research only
- **May Need Adjustments**: HTML selectors might need tweaking if site structure changes

## 🐛 Troubleshooting

**Problem**: "Browser not found"
```bash
npx playwright install chromium
```

**Problem**: Timeout errors
- Check your internet connection
- Try with `--headless=false` to see what's happening
- Increase wait times in the code if needed

**Problem**: No jobs found
- Run with `--headless=false` to inspect the page
- The HTML structure may have changed - check selectors in `gradcrackerScraper.ts`

## 📚 More Information

See `README-GRADCRACKER-SCRAPER.md` for detailed documentation.

