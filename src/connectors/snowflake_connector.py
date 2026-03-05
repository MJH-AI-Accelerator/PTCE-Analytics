"""Snowflake data warehouse connector."""

import os
from datetime import datetime
import pandas as pd
import snowflake.connector

from src.connectors.base import BaseConnector


class SnowflakeConnector(BaseConnector):
    name = "snowflake"
    description = "Snowflake Data Warehouse"

    def __init__(self):
        self.account = os.getenv("SNOWFLAKE_ACCOUNT")
        self.user = os.getenv("SNOWFLAKE_USER")
        self.password = os.getenv("SNOWFLAKE_PASSWORD")
        self.warehouse = os.getenv("SNOWFLAKE_WAREHOUSE")
        self.database = os.getenv("SNOWFLAKE_DATABASE")
        self.schema = os.getenv("SNOWFLAKE_SCHEMA")
        self.role = os.getenv("SNOWFLAKE_ROLE")

    def _get_connection(self):
        return snowflake.connector.connect(
            account=self.account,
            user=self.user,
            password=self.password,
            warehouse=self.warehouse,
            database=self.database,
            schema=self.schema,
            role=self.role,
        )

    def test_connection(self) -> dict:
        if not self.account or not self.user:
            return {"success": False, "message": "Snowflake credentials not configured. Set SNOWFLAKE_* in .env"}
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT CURRENT_VERSION()")
            version = cursor.fetchone()[0]
            conn.close()
            return {"success": True, "message": f"Connected to Snowflake v{version}"}
        except Exception as e:
            return {"success": False, "message": f"Connection failed: {str(e)}"}

    def fetch_activities(self, since: datetime = None) -> pd.DataFrame:
        """Fetch activity metadata from Snowflake.

        IMPORTANT: Customize the SQL query below to match your Snowflake schema.
        The column aliases must map to the standard activity fields.
        """
        query = """
            SELECT
                activity_id,
                activity_name,
                activity_type,
                activity_date,
                therapeutic_area,
                disease_state,
                sponsor,
                accreditation_type,
                credit_hours,
                target_audience,
                description
            FROM activities
        """
        params = {}
        if since:
            query += " WHERE updated_at >= %(since)s"
            params["since"] = since

        conn = self._get_connection()
        df = pd.read_sql(query, conn, params=params)
        conn.close()
        return df

    def fetch_learner_data(self, activity_id: str = None, since: datetime = None) -> pd.DataFrame:
        """Fetch learner data from Snowflake.

        IMPORTANT: Customize the SQL query below to match your Snowflake schema.
        The column aliases must map to the standard learner data fields.
        """
        query = """
            SELECT
                email,
                first_name,
                last_name,
                employer,
                practice_setting,
                role,
                activity_id,
                activity_date,
                pre_score,
                post_score,
                pre_confidence,
                post_confidence,
                comments
            FROM learner_participations
            WHERE 1=1
        """
        params = {}
        if activity_id:
            query += " AND activity_id = %(activity_id)s"
            params["activity_id"] = activity_id
        if since:
            query += " AND updated_at >= %(since)s"
            params["since"] = since

        conn = self._get_connection()
        df = pd.read_sql(query, conn, params=params)
        conn.close()
        return df

    def run_custom_query(self, query: str) -> pd.DataFrame:
        """Run an arbitrary SQL query against Snowflake. For analyst use."""
        conn = self._get_connection()
        df = pd.read_sql(query, conn)
        conn.close()
        return df
