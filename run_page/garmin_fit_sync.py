"""
Garmin refuses to export activities longer than 8 hours as GPX, so those runs
never reach GPX_OUT and stay missing from the site. This script asks Garmin
for the full activity list, finds the long activities that are not recorded
yet, downloads the original .fit file for each of them and syncs them into
the database.
"""

import argparse
import asyncio
import os
import sqlite3
import zipfile
from io import BytesIO

from config import FOLDER_DICT, JSON_FILE, SQL_FILE, config
from garmin_sync import Garmin, gather_with_concurrency
from utils import make_activities_file

# Garmin's GPX export service gives up on activities longer than this.
GPX_EXPORT_LIMIT = 8 * 3600


def recorded_activity_ids():
    """Garmin activity ids that already have a file on disk."""
    ids = set()
    for folder in (FOLDER_DICT["gpx"], FOLDER_DICT["fit"]):
        if not os.path.isdir(folder):
            continue
        for name in os.listdir(folder):
            if name.startswith("."):
                continue
            ids.add(name.split(".")[0].removesuffix("_ACTIVITY"))
    return ids


def recorded_start_times():
    """UTC start times of the activities already stored in the database."""
    times = set()
    if not os.path.exists(SQL_FILE):
        return times
    connection = sqlite3.connect(SQL_FILE)
    try:
        for (start_date,) in connection.execute("select start_date from activities"):
            times.add(str(start_date)[:19])
    finally:
        connection.close()
    return times


async def get_all_activities(client, start=0):
    activities = await client.get_activities(start, 100)
    if not isinstance(activities, list) or not activities:
        return []
    return activities + await get_all_activities(client, start + 100)


async def download_fit(client, activity_id):
    """Save the .fit of one activity, leaving the other archive members alone."""
    folder = FOLDER_DICT["fit"]
    os.makedirs(folder, exist_ok=True)
    try:
        data = await client.download_activity(activity_id, file_type="fit")
        with zipfile.ZipFile(BytesIO(data)) as archive:
            for info in archive.infolist():
                if not info.filename.lower().endswith(".fit"):
                    continue
                target = os.path.join(folder, f"{activity_id}.fit")
                with open(target, "wb") as f:
                    f.write(archive.read(info))
                print(f"downloaded {target}")
                return
        print(f"no fit file inside the archive of activity {activity_id}")
    except Exception as e:
        print(f"failed to download activity {activity_id}: {e}")


async def run(secret_string, auth_domain, is_only_running, threshold, list_only):
    client = Garmin(secret_string, auth_domain, is_only_running)
    activities = await get_all_activities(client)
    print(f"garmin returned {len(activities)} activities")

    known_ids = recorded_activity_ids()
    known_times = recorded_start_times()

    long_count = 0
    missing = []
    for activity in activities:
        activity_id = str(activity.get("activityId", ""))
        duration = float(activity.get("duration") or 0)
        start = str(activity.get("startTimeGMT", ""))[:19]
        if duration <= threshold:
            continue
        long_count += 1
        if activity_id in known_ids or start in known_times:
            continue
        missing.append(
            {
                "id": activity_id,
                "name": activity.get("activityName", ""),
                "duration": duration,
                "start": start,
            }
        )

    print(f"activities longer than {threshold / 3600:.0f}h: {long_count}")
    print(f"of those, not recorded yet: {len(missing)}")
    for activity in missing:
        print(
            f"MISSING {activity['id']} {activity['duration'] / 3600:.2f}h"
            f" {activity['start']} {activity['name']}"
        )

    if not missing:
        await client.req.aclose()
        return

    if list_only:
        await client.req.aclose()
        return

    await gather_with_concurrency(
        5,
        [download_fit(client, activity["id"]) for activity in missing],
    )
    await client.req.aclose()

    titles = {}
    for activity in missing:
        titles[activity["id"]] = activity["name"]
        titles[f"{activity['id']}_ACTIVITY"] = activity["name"]

    make_activities_file(SQL_FILE, FOLDER_DICT["gpx"], JSON_FILE, "gpx", titles)
    make_activities_file(SQL_FILE, FOLDER_DICT["fit"], JSON_FILE, "fit", titles)
    print("sync done")


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
        "--only-run",
        dest="only_run",
        action="store_true",
        help="if is only for running",
    )
    parser.add_argument(
        "--threshold",
        dest="threshold",
        type=int,
        default=GPX_EXPORT_LIMIT,
        help="only look at activities longer than this many seconds",
    )
    parser.add_argument(
        "--list-only",
        dest="list_only",
        action="store_true",
        help="only list the missing activities, do not download them",
    )
    options = parser.parse_args()
    if options.secret_string is None:
        print("Missing argument nor valid configuration file")
        raise SystemExit(1)
    auth_domain = (
        "CN" if options.is_cn else config("sync", "garmin", "authentication_domain")
    )
    asyncio.run(
        run(
            options.secret_string,
            auth_domain,
            options.only_run,
            options.threshold,
            options.list_only,
        )
    )
