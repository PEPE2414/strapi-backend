@echo off
REM Test RapidAPI endpoints with your key
echo Enter your RapidAPI key:
set /p RAPIDAPI_KEY=
echo.
echo Testing RapidAPI endpoints...
echo.

REM Run the test with the API key
set RAPIDAPI_KEY=%RAPIDAPI_KEY%
npm run jobs:test-endpoints

