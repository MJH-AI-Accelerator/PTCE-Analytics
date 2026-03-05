"""Array (CE activity management) connector.

Array manages CE activity completions, compliance tracking, and learner records.
This connector pulls activity metadata and learner completion/assessment data.

Customize the API endpoints and response mapping once you have credentials.
"""

import os
from datetime import datetime
import pandas as pd
import httpx

from src.connectors.base import BaseConnector


class ArrayConnector(BaseConnector):
    name = "array"
    description = "Array CE Management Platform"

    def __init__(self):
        self.api_url = os.getenv("ARRAY_API_URL", "")
        self.api_key = os.getenv("ARRAY_API_KEY", "")
        self.api_secret = os.getenv("ARRAY_API_SECRET", "")

    def _auth_headers(self) -> dict:
        # Adjust authentication based on Array's actual API docs
        return {
            "X-API-Key": self.api_key,
            "X-API-Secret": self.api_secret,
            "Content-Type": "application/json",
        }

    def test_connection(self) -> dict:
        if not self.api_url or not self.api_key:
            return {"success": False, "message": "Array credentials not configured. Set ARRAY_* in .env"}
        try:
            response = httpx.get(
                f"{self.api_url}/v1/status",
                headers=self._auth_headers(),
                timeout=15,
            )
            if response.status_code == 200:
                return {"success": True, "message": "Array API connected"}
            return {"success": False, "message": f"API returned status {response.status_code}"}
        except Exception as e:
            return {"success": False, "message": f"Connection failed: {str(e)}"}

    def fetch_activities(self, since: datetime = None) -> pd.DataFrame:
        """Fetch CE activity metadata from Array.

        Expected data: activity ID, name, type, dates, accreditation, credit hours,
        therapeutic area, learning objectives.
        TODO: Customize endpoint and mapping when you have credentials.
        """
        if not self.api_url or not self.api_key:
            return pd.DataFrame()

        params = {}
        if since:
            params["updated_since"] = since.isoformat()

        response = httpx.get(
            f"{self.api_url}/v1/activities",
            headers=self._auth_headers(),
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

        # Map Array fields to standard activity fields
        records = []
        for item in data.get("activities", data if isinstance(data, list) else []):
            records.append({
                "activity_id": f"ARR-{item.get('id', '')}",
                "activity_name": item.get("name", item.get("title", "")),
                "activity_type": item.get("type", item.get("format", "")),
                "activity_date": item.get("date", item.get("start_date", "")),
                "therapeutic_area": item.get("therapeutic_area", ""),
                "disease_state": item.get("disease_state", ""),
                "sponsor": item.get("sponsor", item.get("supporter", "")),
                "accreditation_type": item.get("accreditation_type", item.get("accreditation", "")),
                "credit_hours": item.get("credit_hours", item.get("credits", 0)),
                "target_audience": item.get("target_audience", ""),
                "description": item.get("description", ""),
            })

        return pd.DataFrame(records)

    def fetch_learner_data(self, activity_id: str = None, since: datetime = None) -> pd.DataFrame:
        """Fetch learner completion and assessment data from Array.

        Expected data: email, name, employer, practice setting, role,
        pre/post scores, confidence, completion status.
        TODO: Customize endpoint and mapping when you have credentials.
        """
        if not self.api_url or not self.api_key:
            return pd.DataFrame()

        params = {}
        if activity_id:
            arr_id = activity_id.replace("ARR-", "")
            params["activity_id"] = arr_id
        if since:
            params["completed_since"] = since.isoformat()

        response = httpx.get(
            f"{self.api_url}/v1/completions",
            headers=self._auth_headers(),
            params=params,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()

        # Map Array fields to standard learner fields
        records = []
        for item in data.get("completions", data if isinstance(data, list) else []):
            records.append({
                "email": item.get("email", item.get("learner_email", "")),
                "first_name": item.get("first_name", ""),
                "last_name": item.get("last_name", ""),
                "employer": item.get("employer", item.get("organization", "")),
                "practice_setting": item.get("practice_setting", ""),
                "role": item.get("role", item.get("profession", "")),
                "activity_id": activity_id or f"ARR-{item.get('activity_id', '')}",
                "activity_date": item.get("completion_date", item.get("date", "")),
                "pre_score": item.get("pre_test_score", item.get("pre_score", None)),
                "post_score": item.get("post_test_score", item.get("post_score", None)),
                "pre_confidence": item.get("pre_confidence", ""),
                "post_confidence": item.get("post_confidence", ""),
                "comments": item.get("comments", item.get("feedback", "")),
            })

        return pd.DataFrame(records)
