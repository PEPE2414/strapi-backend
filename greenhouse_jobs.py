"""
Greenhouse Job Board API scraper.

This tool fetches job listings from Greenhouse job boards using their official API
instead of HTML scraping. It supports multiple company slugs and outputs normalized
job data in JSON or CSV format.

Usage examples:

  # Basic usage with default company slug (openai)
  python greenhouse_jobs.py

  # Multiple company slugs
  python greenhouse_jobs.py --company-slugs openai,stripe,datadog

  # Output to JSON file
  python greenhouse_jobs.py --company-slugs openai --out jobs.json --format json

  # Output to CSV file
  python greenhouse_jobs.py --company-slugs openai,stripe --out jobs.csv --format csv

  # Filter by last updated time
  python greenhouse_jobs.py --company-slugs openai --since "2025-01-01T00:00:00Z"

  # Custom timeout and retries
  python greenhouse_jobs.py --company-slugs openai --timeout 15 --max-retries 5

Dependencies:

  pip install requests

API Documentation:
  https://boards-api.greenhouse.io/v1/boards/<company_slug>/jobs?content=true
"""

import argparse
import csv
import json
import logging
import sys
import time
from datetime import datetime
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class HTMLTextExtractor(HTMLParser):
    """Simple HTML parser to extract plain text from HTML content."""

    def __init__(self):
        super().__init__()
        self.text = []

    def handle_data(self, data: str) -> None:
        self.text.append(data.strip())

    def get_text(self) -> str:
        return ' '.join(self.text)


class GreenhouseClient:
    """
    Client for interacting with the Greenhouse Job Board API.

    Handles HTTP requests, retries, rate limiting, and error handling.
    """

    BASE_URL = "https://boards-api.greenhouse.io/v1/boards"

    def __init__(
        self,
        timeout: int = 10,
        max_retries: int = 3,
        backoff_factor: float = 1.0
    ):
        """
        Initialize the Greenhouse API client.

        Args:
            timeout: Request timeout in seconds
            max_retries: Maximum number of retry attempts
            backoff_factor: Multiplier for exponential backoff (seconds)
        """
        self.timeout = timeout
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor
        self.session = requests.Session()

    def _handle_rate_limit(self, response: requests.Response) -> None:
        """
        Handle HTTP 429 rate limiting by respecting Retry-After header.

        Args:
            response: HTTP response with 429 status code
        """
        retry_after = response.headers.get('Retry-After')
        if retry_after:
            try:
                wait_time = int(retry_after)
            except ValueError:
                wait_time = 5
        else:
            wait_time = 5

        logger.warning(f"Rate limited. Waiting {wait_time} seconds before retry...")
        time.sleep(wait_time)

    def _make_request(
        self,
        url: str,
        retry_count: int = 0
    ) -> Optional[requests.Response]:
        """
        Make HTTP request with retry logic and rate limiting handling.

        Args:
            url: URL to request
            retry_count: Current retry attempt number

        Returns:
            Response object or None if all retries exhausted
        """
        try:
            response = self.session.get(url, timeout=self.timeout)
            response.raise_for_status()
            return response

        except requests.exceptions.HTTPError as e:
            if response.status_code == 429:
                if retry_count < self.max_retries:
                    self._handle_rate_limit(response)
                    return self._make_request(url, retry_count + 1)
                else:
                    logger.error(f"Rate limited after {self.max_retries} retries")
                    return None

            elif response.status_code == 404:
                logger.warning(f"Company not found (404): {url}")
                return None

            elif response.status_code >= 500:
                # Server error - retry
                if retry_count < self.max_retries:
                    wait_time = self.backoff_factor * (2 ** retry_count)
                    logger.warning(
                        f"Server error {response.status_code}. "
                        f"Retrying in {wait_time:.1f}s... (attempt {retry_count + 1}/{self.max_retries})"
                    )
                    time.sleep(wait_time)
                    return self._make_request(url, retry_count + 1)
                else:
                    logger.error(f"Server error after {self.max_retries} retries: {response.status_code}")
                    return None

            else:
                logger.error(f"HTTP error {response.status_code}: {e}")
                return None

        except requests.exceptions.RequestException as e:
            if retry_count < self.max_retries:
                wait_time = self.backoff_factor * (2 ** retry_count)
                logger.warning(
                    f"Request failed: {e}. "
                    f"Retrying in {wait_time:.1f}s... (attempt {retry_count + 1}/{self.max_retries})"
                )
                time.sleep(wait_time)
                return self._make_request(url, retry_count + 1)
            else:
                logger.error(f"Request failed after {self.max_retries} retries: {e}")
                return None

    def list_jobs(
        self,
        company_slug: str,
        content: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Fetch job listings for a company from Greenhouse API.

        Args:
            company_slug: Greenhouse company slug (e.g., 'openai', 'stripe')
            content: Whether to include full job content/description

        Returns:
            List of job dictionaries from the API, or empty list on error
        """
        url = f"{self.BASE_URL}/{company_slug}/jobs"
        if content:
            url += "?content=true"

        logger.info(f"Fetching jobs for company: {company_slug}")

        response = self._make_request(url)
        if response is None:
            logger.error(f"Failed to fetch jobs for {company_slug}")
            return []

        try:
            jobs = response.json()
            if not isinstance(jobs, list):
                logger.error(f"Unexpected response format for {company_slug}: expected list, got {type(jobs)}")
                return []

            logger.info(f"Fetched {len(jobs)} jobs for {company_slug}")
            return jobs

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response for {company_slug}: {e}")
            return []

    def normalize_job(
        self,
        job: Dict[str, Any],
        company_slug: str
    ) -> Dict[str, Any]:
        """
        Normalize a raw Greenhouse job object into a standardized schema.

        Args:
            job: Raw job dictionary from Greenhouse API
            company_slug: The company slug used to fetch this job

        Returns:
            Normalized job dictionary
        """
        # Extract location name
        location_name = ""
        if "location" in job:
            location = job["location"]
            if isinstance(location, dict):
                location_name = location.get("name", "")
            elif isinstance(location, str):
                location_name = location

        # Extract title
        title = job.get("title", "")

        # Determine if remote
        remote = False
        location_lower = location_name.lower()
        title_lower = title.lower()
        if "remote" in location_lower or "remote" in title_lower:
            remote = True

        # Extract department name
        department_name = ""
        if "departments" in job and job["departments"]:
            departments = job["departments"]
            if isinstance(departments, list) and len(departments) > 0:
                dept = departments[0]
                if isinstance(dept, dict):
                    department_name = dept.get("name", "")
                elif isinstance(dept, str):
                    department_name = dept

        # Extract office name
        office_name = ""
        if "offices" in job and job["offices"]:
            offices = job["offices"]
            if isinstance(offices, list) and len(offices) > 0:
                office = offices[0]
                if isinstance(office, dict):
                    office_name = office.get("name", "")

        # Extract content HTML
        content_html = ""
        if "content" in job:
            content = job["content"]
            if isinstance(content, str):
                content_html = content
            elif isinstance(content, dict):
                content_html = content.get("html", "") or content.get("text", "")

        # Convert HTML to plain text
        content_text = ""
        if content_html:
            parser = HTMLTextExtractor()
            try:
                parser.feed(content_html)
                content_text = parser.get_text()
            except Exception:
                # Fallback: simple strip of HTML tags if parser fails
                import re
                content_text = re.sub(r'<[^>]+>', '', content_html)
                content_text = ' '.join(content_text.split())

        # Build normalized job
        normalized = {
            "id": job.get("id"),
            "company_slug": company_slug,
            "title": title,
            "absolute_url": job.get("absolute_url", ""),
            "location_name": location_name,
            "updated_at": job.get("updated_at", ""),
            "department_name": department_name,
            "office_name": office_name,
            "remote": remote,
            "content_html": content_html,
            "content_text": content_text,
        }

        # Add any additional useful fields that might exist
        if "internal_job_id" in job:
            normalized["internal_job_id"] = job["internal_job_id"]
        if "metadata" in job:
            normalized["metadata"] = job["metadata"]

        return normalized

    def filter_jobs_by_updated_since(
        self,
        jobs: List[Dict[str, Any]],
        iso_timestamp: str
    ) -> List[Dict[str, Any]]:
        """
        Filter jobs to only include those updated on or after the given timestamp.

        Args:
            jobs: List of normalized job dictionaries
            iso_timestamp: ISO format datetime string (e.g., "2025-01-01T00:00:00Z")

        Returns:
            Filtered list of jobs
        """
        try:
            filter_date = datetime.fromisoformat(iso_timestamp.replace('Z', '+00:00'))
            filtered = []
            for job in jobs:
                updated_at = job.get("updated_at", "")
                if updated_at:
                    try:
                        job_date = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                        if job_date >= filter_date:
                            filtered.append(job)
                    except (ValueError, AttributeError):
                        # If we can't parse the date, include the job
                        filtered.append(job)
                else:
                    # If no updated_at, include the job
                    filtered.append(job)
            return filtered
        except (ValueError, AttributeError) as e:
            logger.warning(f"Invalid timestamp format '{iso_timestamp}': {e}. Returning all jobs.")
            return jobs


def write_json(jobs: List[Dict[str, Any]], output_path: Optional[str] = None) -> None:
    """
    Write jobs to JSON format.

    Args:
        jobs: List of normalized job dictionaries
        output_path: Optional file path. If None, writes to stdout
    """
    json_str = json.dumps(jobs, indent=2, ensure_ascii=False)
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(json_str)
        logger.info(f"Wrote {len(jobs)} jobs to {output_path}")
    else:
        print(json_str)


def write_csv(jobs: List[Dict[str, Any]], output_path: str) -> None:
    """
    Write jobs to CSV format.

    Args:
        jobs: List of normalized job dictionaries
        output_path: File path to write CSV to
    """
    if not jobs:
        logger.warning("No jobs to write to CSV")
        return

    # Get all possible field names
    fieldnames = set()
    for job in jobs:
        fieldnames.update(job.keys())

    # Order fields: put common ones first
    ordered_fields = [
        "id", "company_slug", "title", "absolute_url", "location_name",
        "updated_at", "department_name", "office_name", "remote",
        "content_html", "content_text"
    ]
    # Add any extra fields
    for field in sorted(fieldnames):
        if field not in ordered_fields:
            ordered_fields.append(field)

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=ordered_fields, extrasaction='ignore')
        writer.writeheader()
        for job in jobs:
            # Convert complex fields to strings for CSV
            row = {}
            for key, value in job.items():
                if isinstance(value, (dict, list)):
                    row[key] = json.dumps(value)
                else:
                    row[key] = value
            writer.writerow(row)

    logger.info(f"Wrote {len(jobs)} jobs to {output_path}")


def main() -> None:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Fetch job listings from Greenhouse job boards using their API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python greenhouse_jobs.py
  python greenhouse_jobs.py --company-slugs openai,stripe
  python greenhouse_jobs.py --company-slugs openai --out jobs.json --format json
  python greenhouse_jobs.py --company-slugs openai,stripe --out jobs.csv --format csv
  python greenhouse_jobs.py --company-slugs openai --since "2025-01-01T00:00:00Z"
        """
    )

    parser.add_argument(
        '--company-slugs',
        type=str,
        default='openai',
        help='Comma-separated list of company slugs (default: openai)'
    )
    parser.add_argument(
        '--out',
        type=str,
        default=None,
        help='Output file path (default: stdout for JSON)'
    )
    parser.add_argument(
        '--format',
        type=str,
        choices=['json', 'csv'],
        default='json',
        help='Output format (default: json)'
    )
    parser.add_argument(
        '--since',
        type=str,
        default=None,
        help='Filter jobs updated on or after this ISO timestamp (e.g., "2025-01-01T00:00:00Z")'
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=10,
        help='Request timeout in seconds (default: 10)'
    )
    parser.add_argument(
        '--max-retries',
        type=int,
        default=3,
        help='Maximum number of retry attempts (default: 3)'
    )

    args = parser.parse_args()

    # Parse company slugs
    company_slugs = [slug.strip() for slug in args.company_slugs.split(',') if slug.strip()]
    if not company_slugs:
        logger.error("No valid company slugs provided")
        sys.exit(1)

    # Validate CSV requires output path
    if args.format == 'csv' and not args.out:
        logger.error("CSV format requires --out argument")
        sys.exit(1)

    # Initialize client
    client = GreenhouseClient(timeout=args.timeout, max_retries=args.max_retries)

    # Fetch jobs from all companies
    all_jobs = []
    for slug in company_slugs:
        jobs = client.list_jobs(slug, content=True)
        if jobs:
            normalized = [client.normalize_job(job, slug) for job in jobs]
            all_jobs.extend(normalized)
            logger.info(f"Normalized {len(normalized)} jobs for {slug}")

    # Filter by updated date if requested
    if args.since and all_jobs:
        original_count = len(all_jobs)
        all_jobs = client.filter_jobs_by_updated_since(all_jobs, args.since)
        logger.info(f"Filtered from {original_count} to {len(all_jobs)} jobs updated since {args.since}")

    # Write output
    if all_jobs:
        if args.format == 'json':
            write_json(all_jobs, args.out)
        elif args.format == 'csv':
            write_csv(all_jobs, args.out)
        logger.info(f"Total jobs processed: {len(all_jobs)}")
    else:
        logger.warning("No jobs found")
        # Exit with error only if all slugs failed (no jobs at all)
        if args.out:
            # Write empty output
            if args.format == 'json':
                write_json([], args.out)
            elif args.format == 'csv':
                # CSV needs at least a header, but we'll just write empty file
                with open(args.out, 'w', encoding='utf-8') as f:
                    f.write('')
        sys.exit(1)


if __name__ == "__main__":
    main()

