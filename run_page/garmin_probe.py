"""Ask the Garmin training status services what they hold, once.

The training status page of Garmin Connect reads its numbers from a handful
of services, each one answers a day or a year at a time. This probe asks every
one of them for the last year and writes what came back to a report file. The
report is the input for the real sync script, the probe itself is thrown away
once that script exists.
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import date, timedelta
from urllib.parse import quote

from garmin_sync import Garmin

REPORT_PATH = os.path.join(
    os.path.dirname(os.path.realpath(__file__)), "garmin_probe_report.json"
)

# how much of a row is kept in the report, the full documents are huge
SAMPLE_LIMIT = 1200


def shorten(value, limit=SAMPLE_LIMIT):
    """Cut a value down so the report stays readable."""
    if isinstance(value, str) and len(value) > limit:
        return value[:limit] + "..."
    if isinstance(value, dict):
        return {key: shorten(item, 200) for key, item in list(value.items())[:40]}
    if isinstance(value, list):
        return [shorten(item, 200) for item in value[:2]]
    return value


def rows_of(payload):
    """The daily rows of an answer, whatever shape the service uses."""
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("dailyTrainingStatusList", "metricsMap", "values", "rows", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
        if "allMetrics" in payload and isinstance(payload["allMetrics"], dict):
            return list(payload["allMetrics"].values())
    return []


async def ask(client, path, label):
    """Ask one endpoint and describe what it answered."""
    url = f"{client.modern_url}{path}"
    answer = {
        "label": label,
        "path": path,
    }
    try:
        response = await client.req.get(url, headers=client.headers)
    except Exception as err:
        answer["error"] = str(err)
        return answer
    answer["status"] = response.status_code
    if response.status_code != 200:
        answer["body"] = response.text[:200]
        return answer
    try:
        payload = response.json()
    except Exception as err:
        answer["error"] = f"not json: {err}"
        return answer
    rows = rows_of(payload)
    answer["shape"] = type(payload).__name__
    answer["rows"] = len(rows)
    if rows:
        first = rows[0]
        answer["keys"] = sorted(first.keys()) if isinstance(first, dict) else []
        answer["sample"] = shorten(first)
        if isinstance(first, dict):
            dates = [
                str(row.get("calendarDate") or row.get("date") or "")
                for row in rows
                if isinstance(row, dict)
            ]
            dates = [value for value in dates if value]
            if dates:
                answer["from"] = min(dates)
                answer["to"] = max(dates)
    else:
        answer["keys"] = sorted(payload.keys()) if isinstance(payload, dict) else []
        answer["sample"] = shorten(payload)
    return answer


async def probe(secret_string, auth_domain, days):
    client = Garmin(secret_string, auth_domain, True)

    profile = await ask(client, "/userprofile-service/socialProfile", "profile")
    who = ""
    if profile.get("status") == 200:
        payload = profile.get("sample") or {}
        who = str(payload.get("displayName") or "")
    who = quote(who) if who else ""
    print(f"display name: {who}")

    today = date.today()
    start = (today - timedelta(days=days)).isoformat()
    end = today.isoformat()
    single = (today - timedelta(days=1)).isoformat()

    paths = [
        (
            f"/metrics-service/metrics/trainingstatus/weekly/{who}",
            "training status rows",
        ),
        (
            f"/metrics-service/metrics/trainingstatus/daily/{single}",
            "training status day",
        ),
        (
            f"/metrics-service/metrics/trainingstatus/aggregated/{single}",
            "training status aggregated",
        ),
        (f"/hrv-service/hrv/daily/{start}/{end}", "hrv rows"),
        (f"/hrv-service/hrv/{single}", "hrv day"),
        (f"/metrics-service/metrics/trainingreadiness/{start}/{end}", "readiness rows"),
        (f"/metrics-service/metrics/trainingreadiness/{single}", "readiness day"),
        (
            f"/metrics-service/metrics/trainingloadbalance/latest/{single}",
            "load balance",
        ),
        (
            f"/metrics-service/metrics/heataltitudeacclimation/daily/{start}/{end}",
            "acclimation rows",
        ),
        (
            f"/metrics-service/metrics/heataltitudeacclimation/latest/{single}",
            "acclimation latest",
        ),
        (f"/metrics-service/metrics/maxmet/daily/{start}/{end}", "vo2 max rows"),
        (
            f"/usersummary-service/usersummary/daily/{who}?calendarDate={single}",
            "daily summary",
        ),
        (
            f"/wellness-service/wellness/dailySleepData/{who}?calendarDate={single}",
            "sleep",
        ),
    ]

    answers = []
    for path, label in paths:
        answer = await ask(client, path, label)
        answers.append(answer)
        print(
            f"{label}: {answer.get('status')} rows={answer.get('rows')} "
            f"from={answer.get('from')} to={answer.get('to')}"
        )
        await asyncio.sleep(0.4)

    await client.req.aclose()

    report = {
        "probed_at": today.isoformat(),
        "window": {"start": start, "end": end},
        "display_name": who,
        "endpoints": answers,
    }
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
    print(f"wrote {REPORT_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("secret_string", nargs="?")
    parser.add_argument("--is-cn", dest="is_cn", action="store_true")
    parser.add_argument("--days", dest="days", type=int, default=365)
    options = parser.parse_args()
    if options.secret_string is None:
        print("Missing argument nor valid configuration file")
        sys.exit(1)
    auth_domain = "CN" if options.is_cn else None
    asyncio.run(probe(options.secret_string, auth_domain, options.days))
