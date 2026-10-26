import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "run_page"))

from garmin_metrics_sync import (  # noqa: E402
    build_record,
    normalise_start,
    pick,
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


if __name__ == "__main__":
    unittest.main()
