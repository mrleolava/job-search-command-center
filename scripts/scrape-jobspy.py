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


def parse_salary(text: str | None) -> tuple[int | None, int | None]:
    """Extract salary_min and salary_max from text."""
    if not text:
        return None, None

    # Strip HTML tags
    clean = re.sub(r'<[^>]+>', ' ', text)
    clean = re.sub(r'&[a-z]+;', ' ', clean)

    # 1. $120k - $160k or $120K-$160K
    m = re.search(r'\$\s*(\d+)\s*[kK]\s*[-–—]+\s*\$\s*(\d+)\s*[kK]', clean)
    if m:
        return int(m.group(1)) * 1000, int(m.group(2)) * 1000

    # 2. $120-160k (shorthand range, single $)
    m = re.search(r'\$\s*(\d+)\s*[-–—]+\s*(\d+)\s*[kK]', clean)
    if m:
        v1, v2 = int(m.group(1)), int(m.group(2))
        if v1 < 1000 and v2 < 1000:
            return v1 * 1000, v2 * 1000

    # 3. $120,000 - $160,000 or $120,000 to $160,000 or $172,300--$222,800
    m = re.search(r'\$\s*([\d,]+)\s*(?:[-–—]+|to)\s*\$\s*([\d,]+)', clean, re.IGNORECASE)
    if m:
        v1 = int(m.group(1).replace(",", ""))
        v2 = int(m.group(2).replace(",", ""))
        if v1 >= 20000 and v2 >= 20000:
            return v1, v2

    # 4. $150,000 base or $120,000/yr or $120,000 per year
    m = re.search(
        r'\$\s*([\d,]+)\s*(?:/\s*(?:year|yr|annually)|per\s+(?:year|annum)|base|annually)',
        clean, re.IGNORECASE
    )
    if m:
        v = int(m.group(1).replace(",", ""))
        if v >= 20000:
            return v, None

    # 5. Standalone $120k near salary context words
    if re.search(r'(?:salary|compensation|pay|earning|ote|base|annual|total\s+comp)', clean, re.IGNORECASE):
        m = re.search(r'\$\s*(\d+)\s*[kK]', clean)
        if m:
            v = int(m.group(1)) * 1000
            if v >= 20000:
                return v, None

    return None, None


def safe_int(val) -> int | None:
    """Safely convert a value to int, returning None for NaN/None."""
    if val is None:
        return None
    try:
        s = str(val)
        if s in ("nan", "NaN", "None", ""):
            return None
        return int(float(s))
    except (ValueError, TypeError):
        return None


COMPANY_SUFFIXES = re.compile(
    r'\s*[,.]?\s*\b(inc\.?|llc\.?|ltd\.?|corp\.?|corporation|co\.?|company|technologies|technology|ai)\s*$',
    re.IGNORECASE,
)


def normalize_company(name: str) -> str:
    """Strip suffixes and lowercase for comparison."""
    return COMPANY_SUFFIXES.sub("", name).strip().lower()


def match_watchlist(result_company: str, watchlist_names: list[str]) -> str | None:
    """Return the watchlist name if result_company fuzzy-matches, else None."""
    norm_result = normalize_company(result_company)
    if not norm_result:
        return None
    for wl_name in watchlist_names:
        norm_wl = normalize_company(wl_name)
        if norm_result == norm_wl:
            return wl_name
        if norm_result in norm_wl or norm_wl in norm_result:
            return wl_name
    return None


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

                # Extract salary — JobSpy provides min/max_amount + interval
                salary_min = safe_int(row.get("min_amount"))
                salary_max = safe_int(row.get("max_amount"))
                interval = str(row.get("interval", "")).lower()
                # Convert hourly to annual (assuming 2080 hours/year)
                if interval == "hourly":
                    if salary_min: salary_min = salary_min * 2080
                    if salary_max: salary_max = salary_max * 2080
                # Filter out sub-annual values that are clearly not salaries
                if salary_min and salary_min < 20000: salary_min = None
                if salary_max and salary_max < 20000: salary_max = None
                # Fall back to parsing description
                if salary_min is None and salary_max is None and description:
                    salary_min, salary_max = parse_salary(description)

                # Extract applicant count (LinkedIn provides num_urgent_words or similar)
                application_count = safe_int(row.get("num_urgent_words")) if row.get("num_urgent_words") is not None else None

                all_jobs.append({
                    "company": company_name,
                    "title": title,
                    "url": job_url,
                    "location": location,
                    "date_posted": date_posted,
                    "source": site,
                    "is_remote": is_remote,
                    "description": description,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "application_count": application_count,
                })

        except Exception as e:
            print(f"  Error: {e}")

        # Rate-limit delay between companies
        if i < len(company_names) - 1:
            time.sleep(2)

    print(f"\nTotal raw JobSpy results: {len(all_jobs)}")

    # Filter to watchlist companies only
    watchlist_matched = []
    watchlist_rejected = set()
    for j in all_jobs:
        wl_name = match_watchlist(j["company"], company_names)
        if wl_name:
            j["company"] = wl_name  # normalize to watchlist name
            watchlist_matched.append(j)
        else:
            watchlist_rejected.add(j["company"])
    if watchlist_rejected:
        print(f"Rejected {len(all_jobs) - len(watchlist_matched)} jobs from non-watchlist companies:")
        for name in sorted(watchlist_rejected):
            print(f"  - {name}")
    print(f"After watchlist filter: {len(watchlist_matched)}")

    # Filter by keywords
    filtered = [
        j for j in watchlist_matched
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
            "salary_min": j["salary_min"],
            "salary_max": j["salary_max"],
            "application_count": j["application_count"],
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
