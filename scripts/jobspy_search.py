#!/usr/bin/env python3
"""JobSpy search script — called from Next.js API route via subprocess.

Usage:
  python3 scripts/jobspy_search.py --keywords "software engineer,backend" \
    --locations "New York,Remote" --include-remote --results 50

Outputs JSON array of job objects to stdout.
"""

import argparse
import json
import sys

from jobspy import scrape_jobs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keywords", required=True, help="Comma-separated search terms")
    parser.add_argument("--locations", default="", help="Comma-separated locations")
    parser.add_argument("--include-remote", action="store_true")
    parser.add_argument("--results", type=int, default=50)
    parser.add_argument("--exclude", default="", help="Comma-separated exclude keywords")
    args = parser.parse_args()

    search_term = args.keywords.replace(",", " OR ")
    location = args.locations.split(",")[0].strip() if args.locations else None

    site_names = ["indeed", "linkedin", "zip_recruiter"]

    try:
        jobs = scrape_jobs(
            site_name=site_names,
            search_term=search_term,
            location=location if location else None,
            is_remote=args.include_remote if args.include_remote else None,
            results_wanted=args.results,
            hours_old=168,  # 1 week
            country_indeed="USA",
        )
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

    exclude_keywords = [k.strip().lower() for k in args.exclude.split(",") if k.strip()]

    results = []
    for _, row in jobs.iterrows():
        title = str(row.get("title", "")) if row.get("title") is not None else ""

        # Apply exclude filter
        if exclude_keywords and any(kw in title.lower() for kw in exclude_keywords):
            continue

        company = str(row.get("company_name", "")) if row.get("company_name") is not None else ""
        description = str(row.get("description", "")) if row.get("description") is not None else None
        location_str = str(row.get("location", "")) if row.get("location") is not None else None

        salary_min = None
        salary_max = None
        if row.get("min_amount") is not None:
            try:
                salary_min = int(float(row["min_amount"]))
            except (ValueError, TypeError):
                pass
        if row.get("max_amount") is not None:
            try:
                salary_max = int(float(row["max_amount"]))
            except (ValueError, TypeError):
                pass

        url = str(row.get("job_url", "")) if row.get("job_url") is not None else ""
        date_posted = str(row.get("date_posted", "")) if row.get("date_posted") is not None else None
        is_remote = bool(row.get("is_remote", False))
        source = str(row.get("site", "jobspy")) if row.get("site") is not None else "jobspy"

        results.append({
            "company": company,
            "title": title,
            "url": url,
            "location": location_str,
            "date_posted": date_posted,
            "source": source,
            "is_remote": is_remote,
            "salary_min": salary_min,
            "salary_max": salary_max,
            "description": description,
        })

    print(json.dumps(results))


if __name__ == "__main__":
    main()
