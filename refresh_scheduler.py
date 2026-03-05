"""Scheduled daily refresh script.

Run this via Windows Task Scheduler to auto-refresh data every day.

Setup (Windows Task Scheduler):
  1. Open Task Scheduler
  2. Create Basic Task -> Name: "PTCE Analytics Daily Refresh"
  3. Trigger: Daily, at your preferred time (e.g., 6:00 AM)
  4. Action: Start a Program
     - Program: C:\\Users\\fagustin\\AppData\\Local\\Programs\\Python\\Python312\\python.exe
     - Arguments: refresh_scheduler.py
     - Start in: C:\\Users\\fagustin\\Documents\\GitHub\\ptce-analytics
  5. Finish

You can also run this manually:
  python refresh_scheduler.py
  python refresh_scheduler.py --full    (full refresh, not just last 24h)
"""

import sys
import logging
from pathlib import Path
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from src.database.db import init_db
from src.connectors.refresh import refresh_all

# Logging
log_dir = Path(__file__).parent / "data" / "logs"
log_dir.mkdir(parents=True, exist_ok=True)
log_file = log_dir / f"refresh_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("ptce.refresh")


def main():
    full_refresh = "--full" in sys.argv

    logger.info("=" * 60)
    logger.info(f"PTCE Analytics Data Refresh - {'FULL' if full_refresh else 'INCREMENTAL'}")
    logger.info(f"Started at: {datetime.now().isoformat()}")
    logger.info("=" * 60)

    init_db()

    results = refresh_all(full_refresh=full_refresh)

    # Summary
    total_activities = 0
    total_learners = 0
    total_errors = 0

    for name, stats in results.items():
        activities = stats.get("activities_fetched", 0)
        learners = stats.get("learners_processed", 0)
        errors = len(stats.get("errors", []))
        total_activities += activities
        total_learners += learners
        total_errors += errors

        status = "OK" if errors == 0 else f"ERRORS ({errors})"
        logger.info(f"  [{name}] {status} - {activities} activities, {learners} learners")
        for err in stats.get("errors", []):
            logger.warning(f"    Error: {err}")

    logger.info("-" * 60)
    logger.info(f"Total: {total_activities} activities, {total_learners} learners, {total_errors} errors")
    logger.info(f"Finished at: {datetime.now().isoformat()}")


if __name__ == "__main__":
    main()
