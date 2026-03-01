#!/usr/bin/env python3
"""
JobSpy scraper — searches LinkedIn, Indeed, and ZipRecruiter
for jobs at watchlist companies, filters by title keywords,
deduplicates against the Supabase jobs table, and inserts new matches.
"""

import os
import sys
import time
import json
import re
from datetime import datetime

from dotenv import load_dotenv
load_dotenv(".env.local")

import requests
from jobspy import scrape_jobs

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

TITLE_KEYWORDS = [
    "GTM", "Account Executive", "Business Development", "Sales",
    "Private Equity", "Customer Success", "Revenue", "Account Director",
    "Accounts", "Client Solutions", "Client", "Partnerships",
]

EXCLUDE_KEYWORDS = [
    "intern", "junior", "entry level", "software engineer",
    "data engineer", "machine learning engineer",
]


def supabase_get(table: str, params: dict | None = None) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    resp = requests.get(url, headers=HEADERS, params=params or {})
    resp.raise_for_status()
    return resp.json()


def supabase_post(table: str, rows: list[dict]) -> int:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    h = {**HEADERS, "Prefer": "return=minimal,resolution=ignore-duplicates"}
    inserted = 0
    # batch 50 at a time
    for i in range(0, len(rows), 50):
        batch = rows[i : i + 50]
        resp = requests.post(url, headers=h, json=batch)
        if resp.status_code in (200, 201):
            inserted += len(batch)
        else:
            print(f"  Insert error (batch {i}): {resp.status_code} {resp.text}")
    return inserted


def matches_keywords(title: str) -> bool:
    lower = title.lower()
    return any(kw.lower() in lower for kw in TITLE_KEYWORDS)


def matches_excludes(title: str) -> bool:
    lower = title.lower()
    return any(kw.lower() in lower for kw in EXCLUDE_KEYWORDS)


def main():
    print("=== JobSpy Scraper ===\n")

    # Load watchlist companies
    companies = supabase_get("watchlist_companies", {"select": "name"})
    company_names = [c["name"] for c in companies if c.get("name")]
    print(f"Loaded {len(company_names)} watchlist companies\n")

    all_jobs = []

    for i, company in enumerate(company_names):
        print(f"[{i+1}/{len(company_names)}] Searching JobSpy for: {company}")
        try:
            df = scrape_jobs(
                site_name=["indeed", "linkedin", "zip_recruiter"],
                search_term=company,
                location="New York, NY",
                results_wanted=25,
                hours_old=72,
                country_indeed="USA",
            )
            print(f"  -> {len(df)} raw results")

            for _, row in df.iterrows():
                title = str(row.get("title", ""))
                job_url = str(row.get("job_url", ""))
                if not title or not job_url or job_url == "nan":
                    continue

                site = str(row.get("site", "")).lower()
                if site == "zip_recruiter":
                    site = "ziprecruiter"

                location = str(row.get("location", "")) if row.get("location") else None
                if location == "nan":
                    location = None

                date_posted = None
                raw_date = row.get("date_posted")
                if raw_date is not None:
                    s = str(raw_date)
                    if s not in ("NaT", "nan", "None", ""):
                        date_posted = s

                raw_remote = row.get("is_remote")
                is_remote = bool(raw_remote) if raw_remote is not None and str(raw_remote) != "nan" else False

                company_name = str(row.get("company", company))
                if company_name in ("nan", "None", ""):
                    company_name = company

                raw_desc = row.get("description")
                description = None
                if raw_desc is not None:
                    s = str(raw_desc)
                    if s not in ("nan", "None", ""):
                        description = s

                all_jobs.append({
                    "company": company_name,
                    "title": title,
                    "url": job_url,
                    "location": location,
                    "date_posted": date_posted,
                    "source": site,
                    "is_remote": is_remote,
                    "description": description,
                })

        except Exception as e:
            print(f"  Error: {e}")

        # Rate-limit delay between companies
        if i < len(company_names) - 1:
            time.sleep(2)

    print(f"\nTotal raw JobSpy results: {len(all_jobs)}")

    # Filter by keywords
    filtered = [
        j for j in all_jobs
        if matches_keywords(j["title"]) and not matches_excludes(j["title"])
    ]
    print(f"After keyword filtering: {len(filtered)}")

    if not filtered:
        print("No matching jobs found.")
        return 0

    # Deduplicate against existing jobs by URL
    urls = [j["url"] for j in filtered]
    existing_urls = set()
    # Query in batches of 50 (Supabase URL param limit)
    for i in range(0, len(urls), 50):
        batch = urls[i : i + 50]
        url_filter = ",".join(f'"{u}"' for u in batch)
        try:
            existing = supabase_get("jobs", {
                "select": "url",
                "url": f"in.({url_filter})",
            })
            existing_urls.update(r["url"] for r in existing)
        except Exception as e:
            print(f"  Dedup query error: {e}")

    # Deduplicate within batch by URL
    seen_urls: set[str] = set()
    deduped: list[dict] = []
    for j in filtered:
        if j["url"] not in seen_urls and j["url"] not in existing_urls:
            seen_urls.add(j["url"])
            deduped.append(j)
    new_jobs = deduped
    print(f"Already in DB: {len(filtered) - len(deduped)}")
    print(f"New jobs to insert: {len(new_jobs)}\n")

    if not new_jobs:
        print("No new jobs to insert.")
        return 0

    # Insert
    rows = [
        {
            "company": j["company"],
            "title": j["title"],
            "url": j["url"],
            "location": j["location"],
            "date_posted": j["date_posted"],
            "source": j["source"],
            "is_remote": j["is_remote"],
            "description": j["description"],
            "is_dismissed": False,
        }
        for j in new_jobs
    ]
    inserted = supabase_post("jobs", rows)
    print(f"Successfully inserted {inserted} new jobs!")

    # Summary by company
    print("\n--- Summary by Company ---")
    by_company: dict[str, int] = {}
    for j in new_jobs:
        by_company[j["company"]] = by_company.get(j["company"], 0) + 1
    for company, count in sorted(by_company.items(), key=lambda x: -x[1]):
        print(f"  {company}: {count}")

    # Summary by source
    print("\n--- Summary by Source ---")
    by_source: dict[str, int] = {}
    for j in new_jobs:
        by_source[j["source"]] = by_source.get(j["source"], 0) + 1
    for source, count in sorted(by_source.items(), key=lambda x: -x[1]):
        print(f"  {source}: {count}")

    return inserted


if __name__ == "__main__":
    count = main()
    sys.exit(0)
