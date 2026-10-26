"""
Pull the physiological metrics Garmin records for every activity and store
them in a JSON file the site charts.

The activity list only carries a short training summary, the activity detail
carries the values the site shows: VO2 max, elevation, heart rate, cadence and
the training effect. Both are read from the same account the sync scripts use.

The raw activity files are never touched, the metrics land in their own JSON
file next to the activity data.
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone

from config import GARMIN_METRICS_CACHE, GARMIN_METRICS_FILE

# Garmin names the same value differently depending on the endpoint, so every
# metric lists the names it may appear under.
METRIC_SOURCES = {
    "vo2_max": ("vo2MaxValue", "vO2MaxValue"),
    "elevation_gain": ("elevationGain",),
    "elevation_loss": ("elevationLoss",),
    "max_elevation": ("maxElevation",),
    "min_elevation": ("minElevation",),
    "max_hr": ("maxHR",),
    "avg_hr": ("averageHR",),
    "aerobic_te": ("aerobicTrainingEffect",),
    "anaerobic_te": ("anaerobicTrainingEffect",),
    "training_load": ("activityTrainingLoad",),
    "avg_cadence": ("averageRunningCadenceInStepsPerMinute",),
    "max_cadence": ("maxRunningCadenceInStepsPerMinute",),
}

METRIC_KEYS = tuple(METRIC_SOURCES.keys())

# The Garmin API answers a few requests at a time before it starts to complain
CONCURRENCY = 5


def pick(payload, names):
    """Read the first value the payload carries under one of the given names."""
    if not isinstance(payload, dict):
        return None
    for name in names:
        value = payload.get(name)
        if value is not None:
            return value
    for value in payload.values():
        if isinstance(value, dict):
            for name in names:
                if value.get(name) is not None:
                    return value[name]
    return None


def as_float(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return round(number, 2)


def normalise_start(value):
    """Garmin writes the start as "YYYY-MM-DD HH:MM:SS" in UTC."""
    text = str(value or "").strip().replace("T", " ")
    if not text:
        return None
    text = text.split(".")[0].rstrip("Z")[:19]
    try:
        datetime.strptime(text, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None
    return text


# The epoch fields hold the same moment as the text field, they are the
# fallback for the accounts that only answer with milliseconds.
EPOCH_START_FIELDS = ("activityStartTimestampGMT", "beginTimestamp")
TEXT_START_FIELDS = ("startTimeGMT",)


def resolve_start(activity, detail):
    """The UTC start of an activity, no matter which field the API answers."""
    for source in (activity, detail):
        if not isinstance(source, dict):
            continue
        for name in EPOCH_START_FIELDS:
            value = source.get(name)
            if value is None:
                continue
            try:
                seconds = float(value) / 1000
            except (TypeError, ValueError):
                continue
            try:
                return datetime.fromtimestamp(seconds, timezone.utc).strftime(
                    "%Y-%m-%d %H:%M:%S"
                )
            except (OverflowError, OSError, ValueError):
                continue
        for name in TEXT_START_FIELDS:
            text = normalise_start(source.get(name))
            if text:
                return text
    return None


def activity_name(activity):
    name = activity.get("activityName") or activity.get("name") or ""
    return str(name).strip()


def build_record(activity, detail):
    """Turn an activity list entry and its detail into one metrics record."""
    record = {
        "id": str(activity.get("activityId", "")),
        "name": activity_name(activity),
        "start_date": resolve_start(activity, detail),
        "distance": as_float(activity.get("distance")),
        "duration": as_float(activity.get("duration")),
    }
    for key in METRIC_KEYS:
        value = as_float(pick(detail, METRIC_SOURCES[key]))
        if value is None:
            value = as_float(pick(activity, METRIC_SOURCES[key]))
        if value is not None:
            record[key] = value
    return record


def load_cache():
    if not os.path.exists(GARMIN_METRICS_CACHE):
        return {}
    try:
        with open(GARMIN_METRICS_CACHE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as err:
        print(f"could not read the metrics cache: {err}")
        return {}


def save_cache(cache):
    with open(GARMIN_METRICS_CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)


def write_output(records):
    payload = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "activities": sorted(
            records, key=lambda record: record.get("start_date") or ""
        ),
    }
    with open(GARMIN_METRICS_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    return payload


async def fetch_json(client, url, attempts=4):
    """Read one json document, the Garmin API rate limits bursts."""
    for attempt in range(attempts):
        try:
            response = await client.req.get(url, headers=client.headers)
            if response.status_code == 429:
                wait = 5 * (attempt + 1)
                print(f"  rate limited, waiting {wait}s")
                await asyncio.sleep(wait)
                continue
            if response.status_code == 404:
                # the activity is gone, asking again does not help
                return None
            response.raise_for_status()
            return response.json()
        except Exception as err:
            print(f"  request failed: {err}")
            await asyncio.sleep(2 * (attempt + 1))
    return None


async def list_activities(client):
    """Read every activity the account holds."""
    activities = []
    start = 0
    while True:
        url = (
            f"{client.modern_url}/activitylist-service/activities/search/activities"
            f"?start={start}&limit=100&activityType=running"
        )
        page = await fetch_json(client, url)
        if not isinstance(page, list) or not page:
            break
        activities.extend(page)
        print(f"  listed {len(activities)} activities")
        if len(page) < 100:
            break
        start += 100
    return activities


async def fetch_detail(client, activity, semaphore):
    """Read the detail of one activity, the API rate limits bursts."""
    activity_id = activity.get("activityId")
    # the client carries the activity url as a template, the real address is
    # built from the modern url the same way garmin_sync.py asks for a detail
    url = f"{client.modern_url}/activity-service/activity/{activity_id}"
    async with semaphore:
        detail = await fetch_json(client, url)
    return activity, detail


async def collect(client, cache, refresh, limit):
    """Fill the cache with the detail of every activity that is still missing."""
    activities = await list_activities(client)
    if limit:
        activities = activities[:limit]
    print(f"garmin listed {len(activities)} running activities")

    pending = [
        activity
        for activity in activities
        if refresh or str(activity.get("activityId", "")) not in cache
    ]
    print(f"{len(pending)} activities still need a detail request")

    semaphore = asyncio.Semaphore(CONCURRENCY)
    tasks = [fetch_detail(client, activity, semaphore) for activity in pending]

    done = 0
    failures = 0
    unplaced = 0
    for future in asyncio.as_completed(tasks):
        activity, detail = await future
        activity_id = str(activity.get("activityId", ""))
        if not detail:
            failures += 1
        else:
            record = build_record(activity, detail)
            if record.get("start_date"):
                cache[activity_id] = record
            else:
                # an activity without a start cannot be placed in the calendar,
                # it is asked again on the next run
                unplaced += 1
        done += 1
        if done % 50 == 0:
            print(f"  fetched {done}/{len(pending)} details")
            save_cache(cache)
    if failures:
        print(f"{failures} activities could not be read")
    if unplaced:
        print(f"{unplaced} activities carry no start time")
    save_cache(cache)
    return cache


async def run(secret_string, auth_domain, refresh, limit):
    # imported here so the parsing helpers stay usable without the sync stack
    from garmin_sync import Garmin

    client = Garmin(secret_string, auth_domain, True)
    cache = load_cache()
    cache = await collect(client, cache, refresh, limit)
    await client.req.aclose()

    records = [record for record in cache.values() if record.get("start_date")]
    payload = write_output(records)
    print(f"wrote {len(payload['activities'])} records to {GARMIN_METRICS_FILE}")

    with_vo2 = sum(1 for record in records if record.get("vo2_max") is not None)
    with_elevation = sum(
        1 for record in records if record.get("elevation_gain") is not None
    )
    print(f"records with vo2 max: {with_vo2}")
    print(f"records with elevation: {with_elevation}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "secret_string", nargs="?", help="secret_string from get_garmin_secret.py"
    )
    parser.add_argument(
        "--is-cn",
        dest="is_cn",
        action="store_true",
        help="if garmin account is cn",
    )
    parser.add_argument(
        "--refresh",
        dest="refresh",
        action="store_true",
        help="read every activity again instead of using the cache",
    )
    parser.add_argument(
        "--limit",
        dest="limit",
        type=int,
        default=0,
        help="only read this many activities, useful for a quick check",
    )
    options = parser.parse_args()
    if options.secret_string is None:
        print("Missing argument nor valid configuration file")
        sys.exit(1)
    auth_domain = "CN" if options.is_cn else None
    asyncio.run(run(options.secret_string, auth_domain, options.refresh, options.limit))
