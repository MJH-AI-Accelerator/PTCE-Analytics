"""Export reports to Excel and PDF."""

import io
import pandas as pd


def export_to_excel(dataframes: dict[str, pd.DataFrame]) -> bytes:
    """Export multiple DataFrames to an Excel file with multiple sheets.

    Args:
        dataframes: dict of sheet_name -> DataFrame

    Returns:
        bytes of the Excel file
    """
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        for sheet_name, df in dataframes.items():
            # Excel sheet names max 31 chars
            safe_name = sheet_name[:31]
            df.to_excel(writer, sheet_name=safe_name, index=False)
    return output.getvalue()


def export_dataframe_csv(df: pd.DataFrame) -> str:
    """Export a DataFrame to CSV string."""
    return df.to_csv(index=False)
