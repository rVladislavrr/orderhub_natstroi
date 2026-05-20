import re

from sqlalchemy.exc import IntegrityError


def extract_conflict_field(e: IntegrityError) -> str | None:
    orig = e.orig

    if hasattr(orig, 'detail') and orig.detail:
        match = re.search(r'Key \((.+?)\)=', orig.detail)
        if match:
            return match.group(1)

    # psycopg2 — диагностика
    if hasattr(orig, 'diag'):
        if orig.diag.column_name:
            return orig.diag.column_name
        if orig.diag.constraint_name:
            return orig.diag.constraint_name

    match = re.search(r'DETAIL:.*Key \((.+?)\)=', str(e))
    if match:
        return match.group(1)

    return None