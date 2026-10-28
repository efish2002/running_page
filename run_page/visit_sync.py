"""Snapshot the visit counter into src/static/visits.json.

The site counts its own visits with a free counter, the browser posts one hit
per page load. This job writes the same numbers into the repository so the
panel keeps a record even when the counter cannot be reached.
"""

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BASE = "https://countapi.mileshilliard.com/api/v1"
KEY = "running_page_visits"
HISTORY_DAYS = 14
TIMEOUT = 20

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "src", "static", "visits.json")


def read_count(key):
    """Read one counter, a key that was never hit has no count."""
    request = urllib.request.Request(
        f"{BASE}/get/{key}",
        headers={"User-Agent": "running_page_visit_sync"},
    )

    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        if error.code == 404:
            print(f"{key} was never hit")
        else:
            print(f"could not read {key}: {error}")
        return None
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        print(f"could not read {key}: {error}")
        return None

    try:
        return max(0, int(payload.get("value")))
    except (TypeError, ValueError):
        return None


def read_previous():
    """The snapshot of the last run, a counter that cannot be read keeps it."""
    try:
        with open(OUTPUT, "r", encoding="utf-8") as handle:
            previous = json.load(handle)
    except (OSError, ValueError):
        return {"total": 0, "days": {}}

    days = {}
    for day in (
        previous.get("days", []) if isinstance(previous.get("days"), list) else []
    ):
        if isinstance(day, dict) and day.get("date"):
            days[day["date"]] = day.get("count", 0)

    return {
        "total": previous.get("total", 0),
        "days": days,
    }


def build_snapshot(now):
    previous = read_previous()
    total = read_count(KEY)
    days = []

    for offset in range(HISTORY_DAYS):
        date = (now - timedelta(days=offset)).strftime("%Y-%m-%d")
        count = read_count(f"{KEY}_{date}")

        if count is None:
            count = previous["days"].get(date, 0)

        days.append({"date": date, "count": count})

    days.reverse()

    return {
        "total": total if total is not None else previous["total"],
        "updatedAt": now.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "days": days,
    }


def main():
    snapshot = build_snapshot(datetime.now(timezone.utc))

    with open(OUTPUT, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(snapshot, handle, indent=2)
        handle.write("\n")

    print(f"visits total: {snapshot['total']}")
    print(f"visits days: {len(snapshot['days'])}")
    print(f"visits written to {OUTPUT}")


if __name__ == "__main__":
    main()
