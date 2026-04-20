import zipfile

import pandas as pd
from openpyxl import load_workbook
from openpyxl import Workbook
import io
from typing import Tuple, List, Optional
import xml.etree.ElementTree as ET


class ExcelValidator:

    @staticmethod
    def is_valid_excel_fast(file_bytes: bytes) -> bool:
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as zip_file:
                required_files = [
                    '[Content_Types].xml',
                    'xl/workbook.xml',
                    'xl/styles.xml'
                ]

                zip_files = zip_file.namelist()

                has_content_types = '[Content_Types].xml' in zip_files
                has_workbook = any(f.startswith('xl/workbook') for f in zip_files)

                return has_content_types and has_workbook

        except zipfile.BadZipFile:
            return ExcelValidator._check_old_excel(file_bytes)
        except Exception:
            return False

    @staticmethod
    def _check_old_excel(file_bytes: bytes) -> bool:
        try:
            if len(file_bytes) < 8:
                return False

            ole_signature = b'\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1'
            if file_bytes.startswith(ole_signature):
                return True

            return False
        except Exception:
            return False

    @staticmethod
    def get_column_names(file_bytes: bytes) -> Optional[List[str]]:
        try:
            df = pd.read_excel(
                io.BytesIO(file_bytes),
                nrows=0,
                engine='openpyxl'
            )
            return df.columns.tolist()
        except Exception as e:
            print(f"Ошибка при чтении заголовков: {e}")
            return None

    @staticmethod
    def check_columns_fast(file_bytes: bytes, required_columns: List[str]) -> Tuple[bool, List[str]]:
        columns = ExcelValidator.get_column_names(file_bytes)

        if columns is None:
            return False, required_columns

        missing_columns = [col for col in required_columns if col not in columns]
        return len(missing_columns) == 0, missing_columns

