import asyncio
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "run_page"))

from garmin_metrics_sync import (  # noqa: E402
    build_record,
    collect,
    normalise_start,
    pick,
    resolve_start,
    write_output,
)


class PickTest(unittest.TestCase):
    def test_reads_a_top_level_value(self):
        self.assertEqual(pick({"elevationGain": 12}, ("elevationGain",)), 12)

    def test_falls_back_to_the_second_name(self):
        self.assertEqual(pick({"vO2MaxValue": 51}, ("vo2MaxValue", "vO2MaxValue")), 51)

    def test_finds_a_nested_value(self):
        payload = {"summary": {"vo2MaxValue": 49}}
        self.assertEqual(pick(payload, ("vo2MaxValue",)), 49)

    def test_returns_none_when_the_value_is_missing(self):
        self.assertIsNone(pick({"distance": 10}, ("vo2MaxValue",)))


class NormaliseStartTest(unittest.TestCase):
    def test_keeps_the_utc_timestamp(self):
        self.assertEqual(normalise_start("2020-07-08 22:35:23"), "2020-07-08 22:35:23")

    def test_drops_the_fraction_and_the_zulu_marker(self):
        self.assertEqual(
            normalise_start("2020-07-08T22:35:23.000Z"), "2020-07-08 22:35:23"
        )

    def test_rejects_a_broken_timestamp(self):
        self.assertIsNone(normalise_start("not a date"))

    def test_rejects_an_empty_timestamp(self):
        self.assertIsNone(normalise_start(None))


class BuildRecordTest(unittest.TestCase):
    def setUp(self):
        self.activity = {
            "activityId": 100031239,
            "activityName": "成都市 跑步",
            "startTimeGMT": "2020-07-08 22:35:23",
            "distance": 7336.2,
            "duration": 2400.34,
        }
        self.detail = {
            "vo2MaxValue": 52.0,
            "elevationGain": 312.0,
            "elevationLoss": 290.5,
            "maxElevation": 780.0,
            "maxHR": 178,
            "averageHR": 152.0,
            "aerobicTrainingEffect": 3.2,
            "activityTrainingLoad": 180.0,
            "averageRunningCadenceInStepsPerMinute": 176.0,
        }

    def test_reads_every_metric_of_the_detail(self):
        record = build_record(self.activity, self.detail)
        self.assertEqual(record["id"], "100031239")
        self.assertEqual(record["name"], "成都市 跑步")
        self.assertEqual(record["start_date"], "2020-07-08 22:35:23")
        self.assertEqual(record["vo2_max"], 52.0)
        self.assertEqual(record["elevation_gain"], 312.0)
        self.assertEqual(record["elevation_loss"], 290.5)
        self.assertEqual(record["max_elevation"], 780.0)
        self.assertEqual(record["max_hr"], 178.0)
        self.assertEqual(record["avg_hr"], 152.0)
        self.assertEqual(record["aerobic_te"], 3.2)
        self.assertEqual(record["training_load"], 180.0)
        self.assertEqual(record["avg_cadence"], 176.0)

    def test_leaves_out_the_metrics_the_detail_does_not_carry(self):
        record = build_record(self.activity, {})
        self.assertNotIn("vo2_max", record)
        self.assertNotIn("elevation_gain", record)
        self.assertEqual(record["distance"], 7336.2)

    def test_falls_back_to_the_activity_list(self):
        activity = dict(self.activity, elevationGain=120.0)
        record = build_record(activity, {})
        self.assertEqual(record["elevation_gain"], 120.0)

    def test_survives_a_detail_that_is_not_a_document(self):
        record = build_record(self.activity, None)
        self.assertEqual(record["start_date"], "2020-07-08 22:35:23")
        self.assertNotIn("vo2_max", record)


class WriteOutputTest(unittest.TestCase):
    def test_sorts_the_records_by_start_date(self):
        path = os.path.join(os.path.dirname(__file__), "garmin_metrics_tmp.json")
        import garmin_metrics_sync

        original = garmin_metrics_sync.GARMIN_METRICS_FILE
        garmin_metrics_sync.GARMIN_METRICS_FILE = path
        try:
            payload = write_output(
                [
                    {"start_date": "2021-05-01 07:00:00", "vo2_max": 50},
                    {"start_date": "2020-05-01 07:00:00", "vo2_max": 48},
                ]
            )
            with open(path, "r", encoding="utf-8") as f:
                written = json.load(f)
        finally:
            garmin_metrics_sync.GARMIN_METRICS_FILE = original
            if os.path.exists(path):
                os.remove(path)
        self.assertEqual(payload["activities"][0]["start_date"], "2020-05-01 07:00:00")
        self.assertEqual(len(written["activities"]), 2)


class ResolveStartTest(unittest.TestCase):
    def test_prefers_the_text_start_of_the_activity(self):
        activity = {"startTimeGMT": "2020-07-08 22:35:23"}
        detail = {"startTimeGMT": "2020-07-08 22:35:23"}
        self.assertEqual(resolve_start(activity, detail), "2020-07-08 22:35:23")

    def test_reads_the_start_of_the_detail_when_the_activity_has_none(self):
        self.assertEqual(
            resolve_start({}, {"startTimeGMT": "2020-07-08 22:35:23"}),
            "2020-07-08 22:35:23",
        )

    def test_reads_an_epoch_start(self):
        activity = {"activityStartTimestampGMT": 1594254923000}
        self.assertEqual(resolve_start(activity, {}), "2020-07-09 00:35:23")

    def test_reads_an_epoch_start_of_the_detail(self):
        detail = {"beginTimestamp": 1594254923000}
        self.assertEqual(resolve_start({}, detail), "2020-07-09 00:35:23")

    def test_returns_none_when_no_start_is_offered(self):
        self.assertIsNone(resolve_start({}, {}))


class FakeResponse:
    def __init__(self, payload, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"{self.status_code} error")
        return None

    def json(self):
        return self._payload


class FakeRequest:
    def __init__(self, activities, details, missing=()):
        self.activities = activities
        self.details = details
        self.missing = set(missing)
        self.requested = []

    async def get(self, url, headers=None):
        self.requested.append(url)
        if "search/activities" in url:
            return FakeResponse(list(self.activities))
        for activity_id, payload in self.details.items():
            if url.endswith("/" + str(activity_id)):
                if activity_id in self.missing:
                    return FakeResponse(None, status=404)
                return FakeResponse(payload)
        return FakeResponse(None)


class FakeClient:
    modern_url = "https://connectapi.example"
    activity_url = "https://connectapi.example/activity-service/activity/{activity_id}"
    headers = {"Authorization": "Bearer test"}

    def __init__(self, activities, details, missing=()):
        self.req = FakeRequest(activities, details, missing)


class CollectTest(unittest.TestCase):
    def setUp(self):
        import garmin_metrics_sync

        self.module = garmin_metrics_sync
        self.original = garmin_metrics_sync.GARMIN_METRICS_CACHE
        self.path = os.path.join(
            os.path.dirname(__file__), "garmin_metrics_cache_tmp.json"
        )
        garmin_metrics_sync.GARMIN_METRICS_CACHE = self.path
        self.activities = [
            {
                "activityId": 1,
                "activityName": "a",
                "startTimeGMT": "2020-07-08 22:35:23",
            },
            {"activityId": 2, "activityName": "b"},
        ]
        self.details = {
            "1": {"vo2MaxValue": 50.0},
            "2": {"vo2MaxValue": 51.0},
        }

    def tearDown(self):
        self.module.GARMIN_METRICS_CACHE = self.original
        if os.path.exists(self.path):
            os.remove(self.path)

    def test_keeps_the_activities_that_carry_a_start(self):
        client = FakeClient(self.activities, self.details)
        cache = asyncio.run(collect(client, {}, False, 0))
        self.assertIn("1", cache)
        self.assertNotIn("2", cache)

    def test_asks_again_for_an_activity_without_a_start(self):
        client = FakeClient(self.activities, self.details)
        cache = asyncio.run(collect(client, {}, False, 0))
        again = FakeClient(self.activities, self.details)
        asyncio.run(collect(again, cache, False, 0))
        self.assertTrue(
            any(url.endswith("/2") for url in again.req.requested),
            "an activity without a start has to be requested again",
        )

    def test_asks_for_the_activity_with_its_id(self):
        client = FakeClient(self.activities, self.details)
        asyncio.run(collect(client, {}, False, 0))
        self.assertTrue(
            any(url.endswith("/1") for url in client.req.requested),
            "the detail url carries the id of the activity",
        )
        self.assertFalse(
            any("{activity_id}" in url for url in client.req.requested),
            "the url template has to be filled in",
        )

    def test_asks_once_for_an_activity_that_is_gone(self):
        client = FakeClient(self.activities, self.details, missing={"2"})
        asyncio.run(collect(client, {}, False, 0))
        calls = [url for url in client.req.requested if url.endswith("/2")]
        self.assertEqual(len(calls), 1, "a missing activity is asked once")


if __name__ == "__main__":
    unittest.main()
