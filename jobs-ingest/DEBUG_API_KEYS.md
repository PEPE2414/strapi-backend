# Debugging API Keys - Quick Guide

## 🔍 How to Check if Your API Keys Are Set Correctly

### Step 1: Check GitHub Actions Logs

Go to your failed workflow run and look for these messages **early in the logs**:

#### ✅ **If API Keys Are Working:**
You should see:
```
🔄 Fetching Adzuna page 1 for "graduate"...
📊 Found 50 jobs for "graduate" (page 1)
🔄 Fetching Adzuna page 2 for "graduate"...
...
✅ Adzuna API: Found 350 jobs

🔄 Fetching Reed API: "graduate" (skip 0)...
📊 Found 100 jobs for "graduate" (total available: 1500)
...
✅ Reed API: Found 480 jobs
```

#### ❌ **If API Keys Are NOT Working:**
You'll see:
```
⚠️  Adzuna API credentials not set. Set ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables.
📝 Get free API keys from: https://developer.adzuna.com/

⚠️  Reed API key not set. Set REED_API_KEY environment variable.
📝 Get free API key from: https://www.reed.co.uk/developers
```

### Step 2: Based on Your Results

You got **207 jobs from api-job-boards**. This suggests:

- ✅ **The Muse API is working** (50-100 jobs, no key needed)
- ❓ **Adzuna might be working** (should add 300-500 jobs)
- ❓ **Reed might be working** (should add 400-600 jobs)
- ❌ **Jobs.ac.uk probably failed** (expected 20-50 jobs)

**Expected total: 770-1250 jobs**
**Your actual: 207 jobs**

This means either:
1. Adzuna and Reed API keys are not set correctly, OR
2. The APIs are rate limiting you, OR
3. There's an error in the API calls

---

## 🔧 How to Fix This

### Option 1: Check Your GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Verify you have **exactly** these three secrets:
   - `ADZUNA_APP_ID`
   - `ADZUNA_APP_KEY`
   - `REED_API_KEY`

**Common mistakes:**
- ❌ Typo in secret name (e.g., `ADZUNA_API_ID` instead of `ADZUNA_APP_ID`)
- ❌ Added to wrong repository
- ❌ Extra spaces before/after the values
- ❌ Using Variables instead of Secrets

### Option 2: Check Your API Keys Are Valid

#### For Adzuna:
1. Go to https://developer.adzuna.com/
2. Log in to your account
3. Go to your dashboard
4. Verify your App ID and App Key
5. Copy them **exactly** (no extra spaces)

Test your Adzuna key manually:
```bash
# Replace YOUR_APP_ID and YOUR_APP_KEY with actual values
curl "https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=YOUR_APP_ID&app_key=YOUR_APP_KEY&results_per_page=1&what=graduate"
```

If this returns JSON with jobs, your key works!

#### For Reed:
1. Check your email for the API key from Reed
2. It should look like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (UUID format)
3. Copy it **exactly**

Test your Reed key manually:
```bash
# Replace YOUR_API_KEY with actual value
curl -u "YOUR_API_KEY:" "https://www.reed.co.uk/api/1.0/search?keywords=graduate&resultsToTake=1"
```

If this returns JSON with jobs, your key works!

---

## 📝 Step-by-Step: Re-Adding Secrets

If you're not sure the secrets are correct, delete and re-add them:

### 1. Delete Old Secrets
- Go to GitHub → Settings → Secrets and variables → Actions
- Click the ⋮ menu next to each secret
- Click "Remove"

### 2. Add Fresh Secrets

Click "New repository secret" for each:

**Secret 1:**
- Name: `ADZUNA_APP_ID`
- Secret: (paste your Adzuna App ID - should be alphanumeric)

**Secret 2:**
- Name: `ADZUNA_APP_KEY`
- Secret: (paste your Adzuna App Key - should be long string)

**Secret 3:**
- Name: `REED_API_KEY`
- Secret: (paste your Reed API key - should be UUID format)

**Secret 4 (if you already have it):**
- Name: `STRAPI_INGEST_SECRET`
- Secret: (your existing Strapi secret)

### 3. Verify the Workflow File

Make sure your `.github/workflows/jobs-ingest.yml` has these lines in the `env:` section:

```yaml
env:
  ADZUNA_APP_ID: ${{ secrets.ADZUNA_APP_ID }}
  ADZUNA_APP_KEY: ${{ secrets.ADZUNA_APP_KEY }}
  REED_API_KEY: ${{ secrets.REED_API_KEY }}
```

(We already did this, so it should be correct)

---

## 🐛 Finding the Exact Error

To see exactly what's happening, look in the GitHub Actions logs for:

### Search for "Adzuna"
Look for lines like:
```
📦 Scraping Adzuna API...
⚠️  Adzuna API credentials not set.    <-- Keys not found
```
OR
```
📦 Scraping Adzuna API...
🔄 Fetching Adzuna page 1 for "graduate"...    <-- Keys working!
```

### Search for "Reed"
Look for lines like:
```
📦 Scraping Reed API...
⚠️  Reed API key not set.    <-- Key not found
```
OR
```
📦 Scraping Reed API...
🔄 Fetching Reed API: "graduate" (skip 0)...    <-- Key working!
```

### Search for "The Muse"
Look for:
```
📦 Scraping The Muse API...
🔄 Fetching The Muse API page 0...    <-- Should always work (no key needed)
```

---

## 🎯 What You Should Do Next

1. **Check the full GitHub Actions log** for the warning messages about missing API keys
2. **If you see warnings:** Your secrets are not set correctly - re-add them
3. **If you don't see warnings:** The APIs might be rate limiting you - check the error messages
4. **Share the relevant log sections** with me so I can help debug

---

## 📊 Expected vs Actual Results

### What You Should Get:

| Source | Expected Jobs | Your Result | Status |
|--------|--------------|-------------|--------|
| Adzuna API | 300-500 | ??? | Check logs |
| Reed API | 400-600 | ??? | Check logs |
| The Muse | 50-100 | ~100-207? | Probably ✅ |
| Jobs.ac.uk | 20-50 | ??? | Check logs |
| **Total** | **770-1250** | **207** | ❌ Too low |

### After APIs:
| Source | Expected | Your Result | Status |
|--------|----------|-------------|--------|
| Graduate Boards | 100-200 | 0 | ⚠️ All failed |
| Greenhouse | 50-100 | 53 | ✅ Good |
| Lever | 10-50 | 0 | ⚠️ Failed |
| Companies | 50-150 | 0 | ⚠️ Failed |

---

## 🚨 The Graduate Job Boards Issue

You also got **0 results from all graduate job boards**:
- gradcracker
- targetjobs
- prospects
- milkround
- brightnetwork
- ratemyplacement

This is concerning. These might be:
1. Blocking GitHub Actions IPs
2. Timing out (45 minutes might not be enough)
3. Changed their website structure

**Quick fix:** Since you got 53 jobs from Greenhouse (Stripe + Monzo), the scraper is partially working. The main issue is the API keys.

---

## ✅ Once Fixed, You Should See:

```
📦 Scraping API Job Boards (Highest Priority)
📦 Scraping Adzuna API...
✅ Adzuna API: Found 420 jobs
📦 Scraping Reed API...
✅ Reed API: Found 580 jobs
✅ The Muse API: Found 85 jobs
✅ Jobs.ac.uk API: Found 35 jobs

📊 Total from API boards: 1120 jobs
📊 Total valid jobs found: 1250+
✅ SUCCESS: Target of 1000+ jobs met!
```

Let me know what you find in the logs! 🔍

