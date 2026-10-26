import json
import os
import sys
import unittest
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "run_page"))

from garmin_training_sync import (  # noqa: E402
    load_balance_record,
    status_record,
)


class StatusRecordTest(unittest.TestCase):
    def test_keeps_the_training_state_of_the_day(self):
        record = status_record(
            date(2026, 5, 30),
            {
                "latestTrainingStatusData": {
                    "device": {
                        "primaryTrainingDevice": True,
                        "trainingStatus": 4,
                        "trainingStatusFeedbackPhrase": "MAINTAINING_2",
                        "fitnessTrend": 2,
                        "sinceDate": "2026-01-04",
                        "acuteTrainingLoadDTO": {
                            "dailyTrainingLoadAcute": 838,
                            "dailyTrainingLoadChronic": 799,
                            "dailyAcuteChronicWorkloadRatio": 1.05,
                        },
                    }
                }
            },
        )
        self.assertEqual(record["phrase"], "MAINTAINING_2")
        self.assertEqual(record["acute_load"], 838)
        self.assertEqual(record["chronic_load"], 799)

    def test_writes_the_day_as_a_plain_string(self):
        record = status_record(
            date(2026, 5, 30),
            {
                "latestTrainingStatusData": {
                    "device": {"trainingStatusFeedbackPhrase": "PRODUCTIVE_1"}
                }
            },
        )
        self.assertEqual(record["date"], "2026-05-30")

    def test_can_be_stored_as_json(self):
        record = status_record(
            date(2026, 5, 30),
            {
                "latestTrainingStatusData": {
                    "device": {"trainingStatusFeedbackPhrase": "PEAKING_1"}
                }
            },
        )
        json.dumps(record)


class LoadBalanceRecordTest(unittest.TestCase):
    def test_keeps_the_monthly_load(self):
        record = load_balance_record(
            date(2026, 5, 1),
            {
                "metricsTrainingLoadBalanceDTOMap": {
                    "device": {
                        "calendarDate": "2026-05-31",
                        "monthlyLoadAerobicLow": 935.6,
                        "monthlyLoadAerobicHigh": 1756.2,
                        "trainingBalanceFeedbackPhrase": "ANAEROBIC_SHORTAGE",
                    }
                }
            },
        )
        self.assertEqual(record["month"], "2026-05")
        self.assertEqual(record["aerobic_low"], 935.6)
        self.assertEqual(record["phrase"], "ANAEROBIC_SHORTAGE")

    def test_writes_the_day_as_a_plain_string(self):
        record = load_balance_record(
            date(2026, 5, 1),
            {
                "metricsTrainingLoadBalanceDTOMap": {
                    "device": {"monthlyLoadAnaerobic": 257.2}
                }
            },
        )
        self.assertEqual(record["date"], "2026-05-01")

    def test_can_be_stored_as_json(self):
        record = load_balance_record(
            date(2026, 5, 1),
            {
                "metricsTrainingLoadBalanceDTOMap": {
                    "device": {"monthlyLoadAnaerobic": 257.2}
                }
            },
        )
        json.dumps(record)


class CacheTest(unittest.TestCase):
    def test_the_whole_cache_can_be_stored_as_json(self):
        cache = {
            "status": {
                "2026-05-30": status_record(
                    date(2026, 5, 30),
                    {
                        "latestTrainingStatusData": {
                            "device": {"trainingStatusFeedbackPhrase": "PRODUCTIVE_1"}
                        }
                    },
                )
            },
            "load_balance": {
                "2026-05": load_balance_record(
                    date(2026, 5, 1),
                    {
                        "metricsTrainingLoadBalanceDTOMap": {
                            "device": {"monthlyLoadAnaerobic": 257.2}
                        }
                    },
                )
            },
        }
        json.dumps(cache)


if __name__ == "__main__":
    unittest.main()
