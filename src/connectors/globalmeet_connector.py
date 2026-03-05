"""GlobalMeet webinar/virtual events connector.

GlobalMeet provides webinar attendance and engagement data.
This connector supports two modes:
  1. REST API (if available for your account)
  2. SFTP file drops (common for enterprise accounts)

Customize the API endpoints and data mapping once you have credentials.
"""

import os
from datetime import datetime
from pathlib import Path
import pandas as pd
import httpx

from src.connectors.base import BaseConnector


class GlobalMeetConnector(BaseConnector):
    name = "globalmeet"
    description = "GlobalMeet Webinar Platform"

    def __init__(self):
        self.api_url = os.getenv("GLOBALMEET_API_URL", "")
        self.api_key = os.getenv("GLOBALMEET_API_KEY", "")
        self.api_secret = os.getenv("GLOBALMEET_API_SECRET", "")
        self.sftp_host = os.getenv("GLOBALMEET_SFTP_HOST", "")
        self.sftp_user = os.getenv("GLOBALMEET_SFTP_USER", "")
        self.sftp_password = os.getenv("GLOBALMEET_SFTP_PASSWORD", "")
        self.sftp_path = os.getenv("GLOBALMEET_SFTP_PATH", "/reports/")
        self.mode = "api" if self.api_key else ("sftp" if self.sftp_host else "none")

    def test_connection(self) -> dict:
        if self.mode == "none":
            return {"success": False, "message": "GlobalMeet credentials not configured. Set GLOBALMEET_* in .env"}

        if self.mode == "api":
            return self._test_api()
        else:
            return self._test_sftp()

    def _test_api(self) -> dict:
        try:
            # Adjust endpoint based on GlobalMeet's actual API docs
            response = httpx.get(
                f"{self.api_url}/v1/status",
                headers=self._auth_headers(),
                timeout=15,
            )
            if response.status_code == 200:
                return {"success": True, "message": "GlobalMeet API connected"}
            return {"success": False, "message": f"API returned status {response.status_code}"}
        except Exception as e:
            return {"success": False, "message": f"API connection failed: {str(e)}"}

    def _test_sftp(self) -> dict:
        # SFTP test would require paramiko — keeping as placeholder
        return {"success": False, "message": "SFTP mode: install paramiko and configure credentials to enable"}

    def _auth_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def fetch_activities(self, since: datetime = None) -> pd.DataFrame:
        """Fetch webinar/event metadata from GlobalMeet.

        TODO: Customize API endpoint and response mapping when you have credentials.
        Expected data: webinar ID, title, date, duration, registration count.
        """
        if self.mode == "api":
            return self._fetch_activities_api(since)
        elif self.mode == "sftp":
            return self._fetch_activities_sftp(since)
        return pd.DataFrame()

    def _fetch_activities_api(self, since: datetime = None) -> pd.DataFrame:
        params = {}
        if since:
            params["start_date"] = since.isoformat()

        response = httpx.get(
            f"{self.api_url}/v1/webinars",
            headers=self._auth_headers(),
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        # Map GlobalMeet fields to standard activity fields
        # Adjust keys based on actual API response structure
        records = []
        for item in data.get("webinars", data if isinstance(data, list) else []):
            records.append({
                "activity_id": f"GM-{item.get('id', '')}",
                "activity_name": item.get("title", ""),
                "activity_type": "Webinar",
                "activity_date": item.get("date", item.get("start_time", "")),
                "description": item.get("description", ""),
            })

        return pd.DataFrame(records)

    def _fetch_activities_sftp(self, since: datetime = None) -> pd.DataFrame:
        # Placeholder: download files from SFTP and parse
        return pd.DataFrame()

    def fetch_learner_data(self, activity_id: str = None, since: datetime = None) -> pd.DataFrame:
        """Fetch attendee/participant data from GlobalMeet.

        Expected data: email, name, attendance status, duration, poll responses.
        TODO: Customize when you have credentials.
        """
        if self.mode == "api":
            return self._fetch_learner_data_api(activity_id, since)
        elif self.mode == "sftp":
            return self._fetch_learner_data_sftp(activity_id)
        return pd.DataFrame()

    def _fetch_learner_data_api(self, activity_id: str = None, since: datetime = None) -> pd.DataFrame:
        # Fetch attendee reports for webinars
        # If activity_id provided, fetch for that specific webinar
        endpoint = f"{self.api_url}/v1/webinars"
        if activity_id:
            # Strip the GM- prefix we added
            gm_id = activity_id.replace("GM-", "")
            endpoint = f"{endpoint}/{gm_id}/attendees"

        response = httpx.get(
            endpoint,
            headers=self._auth_headers(),
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        # Map to standard learner fields
        records = []
        for item in data.get("attendees", data if isinstance(data, list) else []):
            records.append({
                "email": item.get("email", ""),
                "first_name": item.get("first_name", item.get("firstName", "")),
                "last_name": item.get("last_name", item.get("lastName", "")),
                "employer": item.get("organization", item.get("company", "")),
                "activity_id": activity_id or "",
                "activity_date": item.get("join_time", item.get("date", "")),
            })

        return pd.DataFrame(records)

    def _fetch_learner_data_sftp(self, activity_id: str = None) -> pd.DataFrame:
        # Placeholder: download attendee report CSVs from SFTP
        return pd.DataFrame()
