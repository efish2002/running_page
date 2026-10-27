"""
Pull the trail race results from ITRA and store them in a JSON file the site
charts.

The runner space page of ITRA renders every race the runner started, but the
text of the table is put into the page by the server, so a plain GET of the
table fragment is enough to read all of it.  ITRA does not publish the track
of a course, the route of a race therefore comes from the activity Garmin
recorded on the same day, the raw activity files are only read, never
touched.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import date, datetime

import httpx
import polyline
from lxml import html as lxml_html

from config import ITRA_FILE, JSON_FILE

# the runner space of this athlete
RUNNER_ID = "4683832"
RUNNER_SPACE = "https://itra.run/RunnerSpace/gao.hao.4683832"
TABLE_URL = (
    "https://itra.run/RunnerSpace/GetLatestRaceResultByYear"
    f"?runnerId={RUNNER_ID}&raceyear=&categoryId="
)
RACE_URL = "https://itra.run/Races/RaceDetails/{race_year_id}"

TIME_OUT = httpx.Timeout(60.0, connect=30.0)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# how far a route may drift from the distance ITRA reports before it is not
# the same run any more, the gps track of a trail is longer than the course
DISTANCE_TOLERANCE = 0.4
DISTANCE_SLACK_KM = 2.0
# a race may be recorded a day earlier or later, night races often are
NEAR_DAYS = 2

# the route of a race is drawn on the map and as a thumbnail, both do not
# need every single point of the track
SIMPLIFY_TOLERANCE = 0.00005
MAX_ROUTE_POINTS = 500

# the site answers with an empty body when it throttles the requests
RETRIES = 5
RETRY_WAIT = 8.0

# the site answers a plain request with a javascript challenge, a browser that
# runs with a screen solves it
BROWSER_SCRIPT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "itra_browser.mjs"
)
BROWSER_TIMEOUT = 300


def clean(text):
    """The text of a cell without the whitespace the html adds."""
    return " ".join(text.split())


def first_number(text):
    """The first number of a string, zero when there is none."""
    digits = ""
    for char in text:
        if char.isdigit():
            digits += char
        elif digits:
            break
    return int(digits) if digits else 0


def cell_text(row, class_name):
    """The text of the first cell with that class."""
    nodes = row.xpath(f".//div[contains(@class,'{class_name}')]")
    return clean(nodes[0].text_content()) if nodes else ""


def cell_tail(row, class_name):
    """The text of a cell without its small mobile title."""
    nodes = row.xpath(f".//div[contains(@class,'{class_name}')]")
    if not nodes:
        return ""
    text = clean(nodes[0].text_content())
    for title in nodes[0].xpath(".//div[contains(@class,'mobile-title')]"):
        title_text = clean(title.text_content())
        if text.startswith(title_text):
            text = clean(text[len(title_text) :])
    return text


def cell_value(row, class_name):
    """The value of a cell, the part below its title."""
    nodes = row.xpath(f".//div[contains(@class,'{class_name}')]")
    if not nodes:
        return ""
    values = nodes[0].xpath(".//div[contains(@class,'result-table')]")
    if values:
        return clean(values[0].text_content())
    return cell_tail(row, class_name)


def paragraph_value(document, label):
    """The bold value of the paragraph of the profile that carries the label."""
    for paragraph in document.xpath("//div[@id='divShowResults']//p"):
        if not clean(paragraph.text_content()).startswith(label):
            continue
        values = paragraph.xpath(".//b")
        if values:
            return clean(values[0].text_content())
    return ""


def parse_profile(document):
    """The name, the itra id and the performance index of the runner."""
    names = document.xpath("//div[@id='divShowResults']/preceding-sibling::h4[1]")
    counts = document.xpath("//div[@id='divProgress']//span[@class='level-count']")
    levels = document.xpath("//div[@id='divProgress']//span[@class='level']")
    return {
        "name": clean(names[0].text_content()) if names else "",
        "itraId": paragraph_value(document, "ITRA ID:"),
        "performanceIndex": first_number(counts[0].text_content()) if counts else 0,
        "level": clean(levels[0].text_content()) if levels else "",
        "gender": paragraph_value(document, "Gender:"),
        "ageCategory": paragraph_value(document, "Age Category:"),
        "url": RUNNER_SPACE,
    }


def parse_distance(text):
    """'22 km / 1160 m+' becomes (22.0, 1160)."""
    distance = 0.0
    elevation = 0
    parts = text.split("/")
    if parts:
        distance = float(first_number(parts[0]) or 0)
    if len(parts) > 1:
        elevation = first_number(parts[1])
    return distance, elevation


def parse_ratio(text):
    """'3 / 238' becomes (3, 238)."""
    if "/" not in text:
        return None, None
    left, right = text.split("/", 1)
    return first_number(left) or None, first_number(right) or None


def parse_badges(row):
    """The league and the itra point badges of a race."""
    badges = []
    for node in row.xpath(".//div[contains(@class,'badges-national-league')]"):
        label = clean(node.text_content())
        if label:
            badges.append(label)
    return badges


def parse_rows(document):
    """Every race of the runner space table."""
    races = []
    for row in document.xpath("//div[contains(@class,'table-body-row')]"):
        links = row.xpath(".//div[contains(@class,'info-col')]//a")
        if not links:
            continue
        name = clean(links[0].text_content())
        href = links[0].get("href") or ""
        race_year_id = href.rstrip("/").split("/")[-1]
        if not name or not race_year_id.isdigit():
            continue

        distance_km, elevation_m = parse_distance(cell_tail(row, "distance-col"))
        gender_rank, gender_total = parse_ratio(cell_value(row, "col-general"))
        general_rank, general_total = parse_ratio(
            cell_value(row, "col-general-ranking")
        )

        finishers, dnf = parse_ratio(cell_value(row, "col-finishers"))
        participants = first_number(cell_value(row, "col-participants"))
        male_pct = first_number(cell_value(row, "col-gender")) or None

        score_label = cell_tail(row, "race-score-col")
        if score_label in ("Coming Soon", "DNF"):
            score = None
        else:
            score = first_number(score_label) or None

        races.append(
            {
                "date": cell_tail(row, "date-col"),
                "name": name,
                "raceYearId": race_year_id,
                "url": RACE_URL.format(race_year_id=race_year_id),
                "category": cell_tail(row, "category-col"),
                "country": cell_tail(row, "country-col"),
                "distanceKm": distance_km,
                "elevationM": elevation_m,
                "itraPoints": first_number(cell_tail(row, "badges-col")),
                "genderRank": first_number(cell_tail(row, "ranking-col")) or None,
                "genderTotal": gender_total,
                "generalRank": general_rank,
                "generalTotal": general_total,
                "ageGroupRank": first_number(cell_tail(row, "col-age-group")) or None,
                "participants": participants,
                "finishers": finishers,
                "dnf": dnf,
                "malePct": male_pct,
                "femalePct": (100 - male_pct) if male_pct else None,
                "time": cell_tail(row, "race-time-col"),
                "score": score,
                "scoreLabel": score_label,
                "badges": parse_badges(row),
            }
        )
    return races


def perpendicular_distance(point, start, end):
    """How far a point sits from the line between two other points."""
    (x, y), (x1, y1), (x2, y2) = point, start, end
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
    ratio = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)
    ratio = max(0.0, min(1.0, ratio))
    px = x1 + ratio * dx
    py = y1 + ratio * dy
    return ((x - px) ** 2 + (y - py) ** 2) ** 0.5


def simplify(points, tolerance):
    """Douglas-Peucker, the track of a race has far more points than needed."""
    if len(points) < 3:
        return list(points)

    keep = [False] * len(points)
    keep[0] = True
    keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        if last <= first + 1:
            continue
        worst = 0.0
        worst_index = first
        for index in range(first + 1, last):
            distance = perpendicular_distance(
                points[index], points[first], points[last]
            )
            if distance > worst:
                worst = distance
                worst_index = index
        if worst > tolerance:
            keep[worst_index] = True
            stack.append((first, worst_index))
            stack.append((worst_index, last))
    return [point for point, flag in zip(points, keep) if flag]


def route_points(activity):
    """The track of an activity as a list of (lat, lon)."""
    encoded = activity.get("summary_polyline")
    if not encoded:
        return []
    try:
        return polyline.decode(encoded, precision=5)
    except (ValueError, polyline.InvalidPolyline):
        return []


def activity_date(activity):
    return (activity.get("start_date_local") or "")[:10]


def distance_ok(race_distance, activity_distance):
    """Whether an activity can be the race, the gps track runs longer."""
    if activity_distance <= 0:
        return False
    low = race_distance * (1.0 - DISTANCE_TOLERANCE)
    high = race_distance * (1.0 + DISTANCE_TOLERANCE) + DISTANCE_SLACK_KM
    return low <= activity_distance <= high


def match_activity(race, activities):
    """The activity of a race, the same day first and a nearby day second."""
    race_day = race.get("date")
    if not race_day:
        return None, None
    try:
        day = date.fromisoformat(race_day)
    except ValueError:
        return None, None

    candidates = []
    for activity in activities:
        activity_day = activity_date(activity)
        if not activity_day:
            continue
        try:
            other = date.fromisoformat(activity_day)
        except ValueError:
            continue
        gap = abs((other - day).days)
        if gap > NEAR_DAYS:
            continue
        if not distance_ok(
            race.get("distanceKm") or 0, (activity.get("distance") or 0) / 1000
        ):
            continue
        candidates.append(
            (
                gap,
                abs(
                    (activity.get("distance") or 0) / 1000
                    - (race.get("distanceKm") or 0)
                ),
                activity,
            )
        )

    if not candidates:
        return None, None
    candidates.sort(key=lambda item: (item[0], item[1]))
    gap = candidates[0][0]
    return candidates[0][2], ("same-day" if gap == 0 else "near-day")


def build_routes(races, activities):
    """Give every race the track of the run it was."""
    for race in races:
        activity, match = match_activity(race, activities)
        if not activity:
            race["route"] = None
            continue
        points = route_points(activity)
        if not points:
            race["route"] = None
            continue
        reduced = simplify(points, SIMPLIFY_TOLERANCE)
        if len(reduced) > MAX_ROUTE_POINTS:
            step = len(reduced) / MAX_ROUTE_POINTS
            reduced = [reduced[int(index * step)] for index in range(MAX_ROUTE_POINTS)]
            reduced.append(points[-1])
        race["route"] = {
            "runId": activity.get("run_id"),
            "match": match,
            "distanceKm": round((activity.get("distance") or 0) / 1000, 2),
            "polyline": polyline.encode(reduced, precision=5),
        }
    return races


def get_page(client, url):
    """A page of the site, httpx renamed the flag of the redirects in 0.20."""
    try:
        return client.get(url, follow_redirects=True)
    except TypeError:
        return client.get(url, allow_redirects=True)


def browser_documents(pages):
    """The pages of the runner space, read by a browser.

    The site answers a plain request with a javascript challenge that only a
    browser can solve, so the pages are read with one browser that keeps the
    cookie of the challenge.
    """
    node = shutil.which("node")
    if not node:
        print("no node was found, the pages are read with a plain request")
        return {}

    folder = tempfile.mkdtemp(prefix="itra-pages-")
    try:
        command = [node, BROWSER_SCRIPT, folder]
        for name, (url, marker) in pages.items():
            command += [name, url, marker]
        result = subprocess.run(
            command, capture_output=True, text=True, timeout=BROWSER_TIMEOUT
        )
        documents = {}
        for name in pages:
            path = os.path.join(folder, f"{name}.html")
            if not os.path.exists(path):
                continue
            with open(path, "r", encoding="utf-8") as handle:
                documents[name] = lxml_html.fromstring(handle.read())
        if result.returncode != 0:
            # a page that failed must not throw the pages that worked away
            print(
                f"the browser could not read every page: {result.stderr.strip()[-300:]}"
            )
        for line in result.stdout.strip().splitlines():
            print(line)
        return documents
    except (OSError, subprocess.SubprocessError) as error:
        print(f"the browser could not read the pages: {error}")
        return {}
    finally:
        shutil.rmtree(folder, ignore_errors=True)


def fetch_document(url):
    """Read a page of the runner space, the site throttles the requests."""
    problem = "no answer"
    for attempt in range(RETRIES):
        try:
            with httpx.Client(timeout=TIME_OUT, headers=HEADERS) as client:
                response = get_page(client, url)
            if response.status_code == 200 and response.text.strip():
                return lxml_html.fromstring(response.text)
            problem = f"the page answered {response.status_code}"
        except httpx.HTTPError as error:
            problem = str(error)
        if attempt < RETRIES - 1:
            print(f"{url} did not answer, trying again in {RETRY_WAIT}s")
            time.sleep(RETRY_WAIT)
    raise RuntimeError(f"{url} could not be read: {problem}")


def empty_profile():
    """The profile of a runner that could not be read."""
    return {
        "name": "",
        "itraId": "",
        "performanceIndex": 0,
        "level": "",
        "gender": "",
        "ageCategory": "",
        "url": RUNNER_SPACE,
    }


def fetch_profile():
    """The profile of the runner, the page puts it into the html itself."""
    try:
        document = fetch_document(RUNNER_SPACE)
    except (RuntimeError, lxml_html.etree.ParserError) as error:
        # the races matter more than the profile, a broken profile is no reason
        # to throw the whole sync away
        print(f"the runner space page could not be read: {error}")
        return empty_profile()
    return parse_profile(document)


def previous_profile(path):
    """The profile of the last run, it is kept when the site stays silent."""
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            stored = json.load(handle)
    except (OSError, ValueError):
        return None
    runner = stored.get("runner")
    if isinstance(runner, dict) and runner.get("name"):
        return runner
    return None


def main():
    parser = argparse.ArgumentParser(description="sync the ITRA race results")
    parser.add_argument("--output", default=ITRA_FILE, help="the json file to write")
    parser.add_argument(
        "--activities", default=JSON_FILE, help="the activity file the routes come from"
    )
    args = parser.parse_args()

    documents = browser_documents(
        {
            "table": (TABLE_URL, "table-body-row"),
            "space": (RUNNER_SPACE, "ITRA ID"),
        }
    )

    table = documents.get("table")
    if table is None:
        table = fetch_document(TABLE_URL)
    races = parse_rows(table)
    if not races:
        print("no race was found in the runner space table")
        return 1
    print(f"{len(races)} races read from {RUNNER_SPACE}")

    activities = []
    if os.path.exists(args.activities):
        with open(args.activities, "r", encoding="utf-8") as handle:
            activities = json.load(handle)
    build_routes(races, activities)

    matched = sum(1 for race in races if race.get("route"))
    print(f"{matched} of {len(races)} races got a route from the activity file")

    space = documents.get("space")
    profile = parse_profile(space) if space is not None else fetch_profile()
    if not profile["name"]:
        # the site throttles the requests, a profile that could not be read
        # must not wipe the one of the last run
        profile = previous_profile(args.output) or empty_profile()

    payload = {
        "updatedAt": datetime.now().strftime("%Y-%m-%d"),
        "runner": profile,
        "races": races,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1)
    print(f"wrote {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
