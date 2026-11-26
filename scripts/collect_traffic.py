"""Collect GitHub traffic (clones/views) for the tracked repos into data/traffic.json.

GitHub keeps only the last 14 days of traffic, so this runs daily and merges
each day into the stored history (keeping the higher value per day).
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "traffic.json")
TOKEN = os.environ.get("TRAFFIC_TOKEN", "")


def repos():
    with open(os.path.join(ROOT, "config.js"), encoding="utf-8") as f:
        src = f.read()
    block = re.search(r"repos:\s*\[(.*?)\]", src, re.S).group(1)
    return re.findall(r'"([\w.-]+/[\w.-]+)"', block)


def get(url):
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {TOKEN}",
        "User-Agent": "stats-traffic",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    if not TOKEN:
        sys.exit("TRAFFIC_TOKEN secret is not set")
    try:
        with open(DATA, encoding="utf-8") as f:
            store = json.load(f)
    except FileNotFoundError:
        store = {}
    store.setdefault("repos", {})

    for slug in repos():
        entry = store["repos"].setdefault(slug, {})
        for kind in ("clones", "views"):
            data = get(f"https://api.github.com/repos/{slug}/traffic/{kind}?per=day")
            days = entry.setdefault(kind, {})
            for item in data.get(kind, []):
                day = item["timestamp"][:10]
                old = days.get(day, [0, 0])
                days[day] = [max(old[0], item["count"]), max(old[1], item["uniques"])]

    store["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=1, sort_keys=True)
        f.write("\n")


if __name__ == "__main__":
    main()
