#!/bin/bash
# Test API keys directly with Railway environment
# This script will be run on Railway, not locally

echo "🔍 Testing API Keys on Railway..."
echo "📋 Environment Variables:"
echo "  RAPIDAPI_KEY: ${RAPIDAPI_KEY:0:10}..."
echo ""

# Test endpoint connectivity
echo "🧪 Testing RapidAPI Endpoints..."

# Test Active Jobs DB endpoint
echo "Testing Active Jobs DB..."
curl -X POST 'https://active-jobs-db.p.rapidapi.com/search' \
  -H 'X-RapidAPI-Key: ${RAPIDAPI_KEY}' \
  -H 'X-RapidAPI-Host: active-jobs-db.p.rapidapi.com' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "graduate",
    "location": "United Kingdom",
    "limit": 5
  }' || echo "Failed"

echo ""
echo "Testing LinkedIn Jobs API..."
curl -X POST 'https://linkedin-job-search-api.p.rapidapi.com/search' \
  -H 'X-RapidAPI-Key: ${RAPIDAPI_KEY}' \
  -H 'X-RapidAPI-Host: linkedin-job-search-api.p.rapidapi.com' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "graduate",
    "location": "United Kingdom",
    "limit": 5
  }' || echo "Failed"

echo ""
echo "✅ Railway API Key Test Complete"

