"""Base connector interface — all platform connectors implement this."""

from abc import ABC, abstractmethod
from datetime import datetime
import pandas as pd


class BaseConnector(ABC):
    """Standard interface for all data source connectors."""

    name: str = "base"
    description: str = "Base connector"

    @abstractmethod
    def test_connection(self) -> dict:
        """Test that the connection works.

        Returns: {"success": bool, "message": str}
        """
        pass

    @abstractmethod
    def fetch_activities(self, since: datetime = None) -> pd.DataFrame:
        """Fetch activity/program metadata.

        Args:
            since: Only fetch activities updated since this date (for incremental refresh).

        Returns: DataFrame with activity metadata columns.
        """
        pass

    @abstractmethod
    def fetch_learner_data(self, activity_id: str = None, since: datetime = None) -> pd.DataFrame:
        """Fetch learner participation/performance data.

        Args:
            activity_id: Fetch data for a specific activity only. If None, fetch all.
            since: Only fetch records updated since this date.

        Returns: DataFrame with learner data columns.
        """
        pass

    def fetch_all(self, since: datetime = None) -> dict:
        """Convenience method to fetch everything.

        Returns: {"activities": DataFrame, "learner_data": DataFrame}
        """
        return {
            "activities": self.fetch_activities(since),
            "learner_data": self.fetch_learner_data(since=since),
        }
