"""Pigeonhole Live audience engagement connector.

Pigeonhole provides poll responses, Q&A data, and survey/pulse question results.
This data maps to the pulse questions and comments in the PTCE data model.

API docs: https://api.pigeonholelive.com (requires workspace token)
Customize response mapping once you have credentials.
"""

import os
from datetime import datetime
import pandas as pd
import httpx

from src.connectors.base import BaseConnector


class PigeonholeConnector(BaseConnector):
    name = "pigeonhole"
    description = "Pigeonhole Live Audience Engagement"

    def __init__(self):
        self.api_url = os.getenv("PIGEONHOLE_API_URL", "https://api.pigeonholelive.com")
        self.api_token = os.getenv("PIGEONHOLE_API_TOKEN", "")
        self.workspace_id = os.getenv("PIGEONHOLE_WORKSPACE_ID", "")

    def _auth_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
        }

    def test_connection(self) -> dict:
        if not self.api_token:
            return {"success": False, "message": "Pigeonhole credentials not configured. Set PIGEONHOLE_* in .env"}
        try:
            response = httpx.get(
                f"{self.api_url}/v1/workspaces/{self.workspace_id}",
                headers=self._auth_headers(),
                timeout=15,
            )
            if response.status_code == 200:
                return {"success": True, "message": "Pigeonhole API connected"}
            return {"success": False, "message": f"API returned status {response.status_code}"}
        except Exception as e:
            return {"success": False, "message": f"Connection failed: {str(e)}"}

    def fetch_activities(self, since: datetime = None) -> pd.DataFrame:
        """Fetch Pigeonhole events (sessions/events that map to PTCE activities).

        Pigeonhole 'events' or 'pigeonholes' correspond to PTCE activity sessions.
        TODO: Customize endpoint based on actual API structure.
        """
        if not self.api_token:
            return pd.DataFrame()

        params = {"workspace_id": self.workspace_id}
        if since:
            params["start_after"] = since.isoformat()

        response = httpx.get(
            f"{self.api_url}/v1/events",
            headers=self._auth_headers(),
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        records = []
        for item in data.get("events", data if isinstance(data, list) else []):
            records.append({
                "activity_id": f"PH-{item.get('id', '')}",
                "activity_name": item.get("name", item.get("title", "")),
                "activity_type": "Webinar",
                "activity_date": item.get("start_date", item.get("date", "")),
                "description": item.get("description", ""),
            })

        return pd.DataFrame(records)

    def fetch_learner_data(self, activity_id: str = None, since: datetime = None) -> pd.DataFrame:
        """Fetch poll/survey responses and Q&A from Pigeonhole.

        This data feeds into pulse questions and comments.
        Each poll response becomes a row with the learner's email and their answer.
        TODO: Customize when you have credentials.
        """
        if not self.api_token:
            return pd.DataFrame()

        # Pigeonhole data is event-scoped
        if activity_id:
            ph_id = activity_id.replace("PH-", "")
        else:
            # Fetch all events and iterate
            activities = self.fetch_activities(since)
            if activities.empty:
                return pd.DataFrame()
            all_data = []
            for _, row in activities.iterrows():
                df = self._fetch_event_responses(row["activity_id"].replace("PH-", ""))
                if not df.empty:
                    df["activity_id"] = row["activity_id"]
                    all_data.append(df)
            return pd.concat(all_data, ignore_index=True) if all_data else pd.DataFrame()

        df = self._fetch_event_responses(ph_id)
        if not df.empty:
            df["activity_id"] = activity_id
        return df

    def _fetch_event_responses(self, event_id: str) -> pd.DataFrame:
        """Fetch all poll/Q&A responses for a specific Pigeonhole event."""
        response = httpx.get(
            f"{self.api_url}/v1/events/{event_id}/responses",
            headers=self._auth_headers(),
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        records = []
        for item in data.get("responses", data if isinstance(data, list) else []):
            records.append({
                "email": item.get("email", item.get("respondent_email", "")),
                "first_name": item.get("first_name", ""),
                "last_name": item.get("last_name", ""),
                "question_text": item.get("question", item.get("poll_title", "")),
                "answer": item.get("answer", item.get("response", "")),
                "question_type": item.get("type", "pulse"),
                "timestamp": item.get("created_at", item.get("timestamp", "")),
            })

        return pd.DataFrame(records)

    def fetch_poll_results(self, event_id: str) -> pd.DataFrame:
        """Fetch aggregated poll results for an event.

        Useful for pulse question analysis.
        """
        if not self.api_token:
            return pd.DataFrame()

        response = httpx.get(
            f"{self.api_url}/v1/events/{event_id}/polls",
            headers=self._auth_headers(),
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        records = []
        for poll in data.get("polls", data if isinstance(data, list) else []):
            for option in poll.get("options", []):
                records.append({
                    "poll_title": poll.get("title", ""),
                    "option_text": option.get("text", ""),
                    "vote_count": option.get("count", option.get("votes", 0)),
                    "percentage": option.get("percentage", 0),
                })

        return pd.DataFrame(records)
