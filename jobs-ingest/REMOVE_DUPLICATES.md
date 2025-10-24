# Remove Duplicate Jobs Script

This script removes duplicate jobs from your Strapi job library by calling the Strapi API directly.

## How it works

1. **Fetches all jobs** from your Strapi API
2. **Identifies duplicates** based on job title, company, and location
3. **Shows analysis** of duplicates found
4. **Deletes duplicates** (keeps the first occurrence, removes the rest)

## Setup

### 1. Environment Variables

You need to set these environment variables:

```bash
# Your Strapi API URL (production or local)
STRAPI_URL=https://your-strapi-url.com
# OR for local development:
# STRAPI_URL=http://localhost:1337

# Your Strapi API token (get from Strapi admin panel)
STRAPI_API_TOKEN=your_api_token_here
```

### 2. Get API Token

1. Go to your Strapi admin panel
2. Go to **Settings** → **API Tokens**
3. Create a new token with **Full access** permissions
4. Copy the token and set it as `STRAPI_API_TOKEN`

## Usage

### Option 1: Using npm script (recommended)

```bash
# Set environment variables first
export STRAPI_URL=https://your-strapi-url.com
export STRAPI_API_TOKEN=your_api_token_here

# Run the script
npm run jobs:remove-duplicates
```

### Option 2: Direct execution

```bash
# Set environment variables first
export STRAPI_URL=https://your-strapi-url.com
export STRAPI_API_TOKEN=your_api_token_here

# Run directly
node jobs-ingest/remove-duplicates.js
```

## What the script does

1. **Fetches all jobs** from your Strapi database
2. **Analyzes for duplicates** using title + company + location as the key
3. **Shows you a summary** of what will be deleted
4. **Waits 10 seconds** for you to cancel (Ctrl+C) if needed
5. **Deletes duplicate jobs** one by one
6. **Shows final summary** of what was removed

## Example Output

```
🚀 Starting duplicate removal process...
🔗 Strapi URL: https://your-strapi-url.com
📥 Fetching all jobs from Strapi...
📦 Fetched 100 jobs (page 1, total: 100)
📦 Fetched 100 jobs (page 2, total: 200)
✅ Total jobs fetched: 200

🔍 Analyzing jobs for duplicates...
🔍 Found 15 duplicate pairs

📊 Duplicate Analysis:
   Total jobs: 200
   Duplicate pairs: 15
   Jobs to remove: 15
   Jobs to keep: 185

📋 Example duplicates:
   1. "Software Engineer Graduate" at Google
   2. "Marketing Intern" at Microsoft
   3. "Data Analyst Placement" at Amazon

⚠️  This will delete 15 duplicate jobs.
   Press Ctrl+C to cancel, or wait 10 seconds to continue...

🗑️  Deleting 15 duplicate jobs...
✅ Deleted: "Software Engineer Graduate" at Google
✅ Deleted: "Marketing Intern" at Microsoft
...

📊 Deletion Summary:
   Successfully deleted: 15
   Failed to delete: 0
   Total processed: 15

✅ Duplicate removal completed!
   Removed 15 duplicate jobs
   Database now has 185 unique jobs
```

## Safety Features

- **10-second delay** before deletion starts (you can cancel with Ctrl+C)
- **Shows examples** of what will be deleted
- **Detailed logging** of each deletion
- **Error handling** for failed deletions
- **Summary report** at the end

## Notes

- The script keeps the **first occurrence** of each duplicate and removes the rest
- Duplicates are identified by **title + company + location** (case-insensitive)
- The script includes a small delay between deletions to avoid overwhelming the API
- All operations are logged for transparency
