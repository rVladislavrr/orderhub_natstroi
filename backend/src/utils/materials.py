from collections import defaultdict
from typing import Any

from src.models import RelMarkaDel


def _aggregate_rel_entries(
        rel_entries: list[RelMarkaDel],
        column_key: int,
) -> dict[tuple[str, str], dict[int, float]]:
    result: dict[tuple[str, str], dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for rel in rel_entries:
        d = rel.detail
        profile = f"{d.type} {d.size}".strip()
        total_weight = float(d.weight or 0) * rel.details_quantity
        result[(profile, d.steel_grade)][column_key] += total_weight
    return result


def _merge_aggregates(
        aggregates: list[dict[tuple[str, str], dict[str, float]]],
) -> dict[tuple[str, str], dict[str, float]]:
    merged: dict[tuple[str, str], dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for agg in aggregates:
        for (profile, steel), columns in agg.items():
            for col, weight in columns.items():
                merged[(profile, steel)][col] += weight
    return merged


def _build_response(
        merged: dict[tuple[str, str], dict[str, float]],
        columns: list[int],
) -> dict[str, Any]:
    rows = []
    column_totals: dict[str, float] = defaultdict(float)
    grand_total = 0.0

    for (profile, steel), col_weights in sorted(merged.items()):
        totals = {col: round(col_weights.get(col, 0.0), 1) for col in columns}
        row_total = round(sum(totals.values()), 1)
        rows.append(
            {
                "profile": profile,
                "steel_grade": steel,
                "totals": totals,
                "grand_total": row_total,
            }
        )
        for col, w in totals.items():
            column_totals[col] += w
        grand_total += row_total

    return {
        "columns": columns,
        "rows": rows,
        "column_totals": {col: round(v, 1) for col, v in column_totals.items()},
        "grand_total": round(grand_total, 1),
    }
