# Test Jobs Pipeline

## After Railway Deployment

1. **Test Connection:**
```bash
cd jobs-ingest
npm run test-connection
```

2. **Test Full Pipeline:**
```bash
cd jobs-ingest
npm run dev
```

3. **Test Individual Components:**
```bash
cd jobs-ingest
npm run test
```

## Expected Results

- Connection test should show successful API communication
- Full pipeline should scrape jobs and ingest them to Strapi
- Check Strapi admin panel for new jobs

## Troubleshooting

- If 405 error: Ingest endpoint not deployed yet
- If 401 error: Check STRAPI_INGEST_SECRET matches Railway
- If connection error: Check STRAPI_API_URL is correct
