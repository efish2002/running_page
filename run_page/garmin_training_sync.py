"""
Pull the training status Garmin records for the account and store it in a JSON
file the site charts.

The training status page of Garmin Connect reads its numbers from a handful of
services: the daily training status with the acute and the chronic load, the
heart rate variability with its baseline, the training readiness, the altitude
acclimation and the monthly load balance. Each one is asked here, the days
that are already known stay in a cache so a run only asks for what is new.

The raw activity files are never touched, the training status lands in its own
JSON file next to the activity data.
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote

from config import GARMIN_TRAINING_CACHE, GARMIN_TRAINING_FILE

# how many days the site shows
WINDOW_DAYS = 365

# the Garmin API answers a few requests at a time before it starts to complain
CONCURRENCY = 5


def as_float(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return round(number, 2)


def as_date(value):
    """A day as a plain string, the json file cannot hold a date object."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def days_between(start, end):
    """Every day from start to end, both of them included."""
    day = start
    while day <= end:
        yield day
        day += timedelta(days=1)


def month_starts(start, end):
    """The first day of every month between start and end."""
    day = date(start.year, start.month, 1)
    while day <= end:
        yield day
        if day.month == 12:
            day = date(day.year + 1, 1, 1)
        else:
            day = date(day.year, day.month + 1, 1)


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
                # the service does not hold this day, asking again does not help
                return None
            response.raise_for_status()
            return response.json()
        except Exception as err:
            print(f"  request failed: {err}")
            await asyncio.sleep(2 * (attempt + 1))
    return None


async def read_profile(client):
    """The account the metrics belong to."""
    payload = await fetch_json(
        client, f"{client.modern_url}/userprofile-service/socialProfile"
    )
    if not isinstance(payload, dict):
        return ""
    return str(payload.get("displayName") or "").strip()


def status_record(day, payload):
    """The training status of one day with the load it carries."""
    if not isinstance(payload, dict):
        return None
    devices = payload.get("latestTrainingStatusData")
    if not isinstance(devices, dict) or not devices:
        return None
    record = None
    for value in devices.values():
        if not isinstance(value, dict):
            continue
        if record is None or value.get("primaryTrainingDevice"):
            record = value
    if record is None:
        return None
    load = record.get("acuteTrainingLoadDTO") or {}
    return {
        "date": as_date(day),
        "status": as_float(record.get("trainingStatus")),
        "phrase": str(record.get("trainingStatusFeedbackPhrase") or ""),
        "fitness_trend": as_float(record.get("fitnessTrend")),
        "since": record.get("sinceDate"),
        "acute_load": as_float(load.get("dailyTrainingLoadAcute")),
        "chronic_load": as_float(load.get("dailyTrainingLoadChronic")),
        "chronic_max": as_float(load.get("maxTrainingLoadChronic")),
        "chronic_min": as_float(load.get("minTrainingLoadChronic")),
        "acwr": as_float(load.get("dailyAcuteChronicWorkloadRatio")),
        "acwr_percent": as_float(load.get("acwrPercent")),
        "acwr_status": load.get("acwrStatus"),
    }


def hrv_record(row):
    """The heart rate variability of one night with its baseline."""
    baseline = row.get("baseline") or {}
    return {
        "date": row.get("calendarDate"),
        "status": row.get("status"),
        "phrase": row.get("feedbackPhrase"),
        "last_night_avg": as_float(row.get("lastNightAvg")),
        "last_night_high": as_float(row.get("lastNight5MinHigh")),
        "weekly_avg": as_float(row.get("weeklyAvg")),
        "low_upper": as_float(baseline.get("lowUpper")),
        "balanced_low": as_float(baseline.get("balancedLow")),
        "balanced_upper": as_float(baseline.get("balancedUpper")),
        "marker": as_float(baseline.get("markerValue")),
    }


def readiness_record(row):
    """The readiness of one day with the factors it is built from."""
    return {
        "date": row.get("calendarDate"),
        "score": as_float(row.get("score")),
        "level": row.get("level"),
        "feedback": row.get("feedbackShort"),
        "recovery_time": as_float(row.get("recoveryTime")),
        "sleep_score": as_float(row.get("sleepScore")),
        "hrv_factor": as_float(row.get("hrvFactorPercent")),
        "sleep_factor": as_float(row.get("sleepHistoryFactorPercent")),
        "stress_factor": as_float(row.get("stressHistoryFactorPercent")),
        "acwr_factor": as_float(row.get("acwrFactorPercent")),
        "acute_load": as_float(row.get("acuteLoad")),
        "hrv_weekly_avg": as_float(row.get("hrvWeeklyAverage")),
        "timestamp": row.get("timestampLocal"),
    }


def acclimation_record(row):
    """How well the body copes with the altitude it lives at."""
    return {
        "date": row.get("calendarDate"),
        "altitude": as_float(row.get("altitudeAcclimation")),
        "percentage": as_float(row.get("acclimationPercentage")),
        "trend": row.get("altitudeTrend"),
        "current_altitude": as_float(row.get("currentAltitude")),
        "heat_percentage": as_float(row.get("heatAcclimationPercentage")),
        "heat_trend": row.get("heatTrend"),
    }


def vo2_record(row):
    """The maximum oxygen uptake Garmin measured on one day."""
    generic = row.get("generic") or {}
    value = as_float(generic.get("vo2MaxValue"))
    if value is None:
        return None
    return {
        "date": generic.get("calendarDate") or row.get("calendarDate"),
        "value": value,
        "precise": as_float(generic.get("vo2MaxPreciseValue")),
    }


def load_balance_record(day, payload):
    """The load of one month against the range that keeps it healthy."""
    if not isinstance(payload, dict):
        return None
    devices = payload.get("metricsTrainingLoadBalanceDTOMap")
    if not isinstance(devices, dict):
        return None
    for value in devices.values():
        if not isinstance(value, dict):
            continue
        return {
            "date": as_date(value.get("calendarDate") or day),
            "month": day.strftime("%Y-%m"),
            "aerobic_low": as_float(value.get("monthlyLoadAerobicLow")),
            "aerobic_high": as_float(value.get("monthlyLoadAerobicHigh")),
            "anaerobic": as_float(value.get("monthlyLoadAnaerobic")),
            "aerobic_low_min": as_float(value.get("monthlyLoadAerobicLowTargetMin")),
            "aerobic_low_max": as_float(value.get("monthlyLoadAerobicLowTargetMax")),
            "aerobic_high_min": as_float(value.get("monthlyLoadAerobicHighTargetMin")),
            "aerobic_high_max": as_float(value.get("monthlyLoadAerobicHighTargetMax")),
            "anaerobic_min": as_float(value.get("monthlyLoadAnaerobicTargetMin")),
            "anaerobic_max": as_float(value.get("monthlyLoadAnaerobicTargetMax")),
            "phrase": value.get("trainingBalanceFeedbackPhrase"),
        }
    return None


def rows_of(payload, *keys):
    """The daily rows of an answer, whatever shape the service uses."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in keys:
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def keep_latest_per_day(rows):
    """The newest answer of every day, the service answers a day more than once."""
    latest = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        day = row.get("calendarDate")
        if not day:
            continue
        known = latest.get(day)
        if known is None or str(row.get("timestampLocal") or "") >= str(
            known.get("timestampLocal") or ""
        ):
            latest[day] = row
    return [latest[day] for day in sorted(latest)]


def load_cache():
    if not os.path.exists(GARMIN_TRAINING_CACHE):
        return {}
    try:
        with open(GARMIN_TRAINING_CACHE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as err:
        print(f"could not read the training cache: {err}")
        return {}


def save_cache(cache):
    with open(GARMIN_TRAINING_CACHE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)


async def ask_status(client, day, semaphore):
    """The training status of one day."""
    url = f"{client.modern_url}/metrics-service/metrics/trainingstatus/daily/{day}"
    async with semaphore:
        payload = await fetch_json(client, url)
    return day, status_record(day, payload)


async def ask_load_balance(client, day, semaphore):
    """The load balance of the month the day belongs to."""
    url = (
        f"{client.modern_url}/metrics-service/metrics/trainingloadbalance/latest/{day}"
    )
    async with semaphore:
        payload = await fetch_json(client, url)
    return day, load_balance_record(day, payload)


async def collect(client, cache, refresh, days):
    """Read the training status of every day the site shows."""
    who = await read_profile(client)
    print(f"account: {who or 'unknown'}")

    today = date.today()
    start = today - timedelta(days=days)
    end = today
    window = f"{start}/{end}"

    hrv_rows = rows_of(
        await fetch_json(client, f"{client.modern_url}/hrv-service/hrv/daily/{window}"),
        "hrvSummaries",
    )
    hrv = [hrv_record(row) for row in hrv_rows if isinstance(row, dict)]
    print(f"hrv rows: {len(hrv)}")

    readiness_rows = keep_latest_per_day(
        rows_of(
            await fetch_json(
                client,
                f"{client.modern_url}/metrics-service/metrics/trainingreadiness/{window}",
            )
        )
    )
    readiness = [readiness_record(row) for row in readiness_rows]
    print(f"readiness rows: {len(readiness)}")

    acclimation_rows = rows_of(
        await fetch_json(
            client,
            f"{client.modern_url}/metrics-service/metrics/heataltitudeacclimation/daily/{window}",
        )
    )
    acclimation = [
        acclimation_record(row) for row in acclimation_rows if isinstance(row, dict)
    ]
    print(f"acclimation rows: {len(acclimation)}")

    vo2_rows = rows_of(
        await fetch_json(
            client, f"{client.modern_url}/metrics-service/metrics/maxmet/daily/{window}"
        )
    )
    vo2 = [vo2_record(row) for row in vo2_rows if isinstance(row, dict)]
    vo2 = [row for row in vo2 if row]
    print(f"vo2 max rows: {len(vo2)}")

    status_cache = cache.setdefault("status", {})
    load_balance_cache = cache.setdefault("load_balance", {})

    semaphore = asyncio.Semaphore(CONCURRENCY)

    pending_status = [
        day
        for day in days_between(start, end)
        if refresh or day.isoformat() not in status_cache
    ]
    print(f"{len(pending_status)} days still need a status request")

    status_tasks = [ask_status(client, day, semaphore) for day in pending_status]
    done = 0
    for future in asyncio.as_completed(status_tasks):
        day, record = await future
        if record:
            status_cache[day.isoformat()] = record
        done += 1
        if done % 50 == 0:
            print(f"  fetched {done}/{len(status_tasks)} days")
            save_cache(cache)

    pending_months = [
        day
        for day in month_starts(start, end)
        if refresh or day.strftime("%Y-%m") not in load_balance_cache
    ]
    print(f"{len(pending_months)} months still need a load balance request")

    balance_tasks = [ask_load_balance(client, day, semaphore) for day in pending_months]
    for future in asyncio.as_completed(balance_tasks):
        day, record = await future
        if record:
            load_balance_cache[day.strftime("%Y-%m")] = record

    cache["status"] = status_cache
    cache["load_balance"] = load_balance_cache
    save_cache(cache)

    return {
        "status": [status_cache[day] for day in sorted(status_cache)],
        "hrv": hrv,
        "readiness": readiness,
        "acclimation": acclimation,
        "vo2": vo2,
        "load_balance": [
            load_balance_cache[month] for month in sorted(load_balance_cache)
        ],
    }


def write_output(payload):
    document = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    }
    document.update(payload)
    with open(GARMIN_TRAINING_FILE, "w", encoding="utf-8") as f:
        json.dump(document, f, ensure_ascii=False, separators=(",", ":"))
    return document


async def run(secret_string, auth_domain, refresh, days):
    # imported here so the parsing helpers stay usable without the sync stack
    from garmin_sync import Garmin

    client = Garmin(secret_string, auth_domain, True)
    cache = load_cache()
    payload = await collect(client, cache, refresh, days)
    await client.req.aclose()

    document = write_output(payload)
    for key in ("status", "hrv", "readiness", "acclimation", "vo2", "load_balance"):
        print(f"{key}: {len(document.get(key) or [])}")
    print(f"wrote {GARMIN_TRAINING_FILE}")


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
        help="read every day again instead of using the cache",
    )
    parser.add_argument(
        "--days",
        dest="days",
        type=int,
        default=WINDOW_DAYS,
        help="how many days to read, the site shows a year",
    )
    options = parser.parse_args()
    if options.secret_string is None:
        print("Missing argument nor valid configuration file")
        sys.exit(1)
    auth_domain = "CN" if options.is_cn else None
    asyncio.run(run(options.secret_string, auth_domain, options.refresh, options.days))
