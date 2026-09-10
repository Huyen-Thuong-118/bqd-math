import re


def safe_numeric_value(value: str) -> float | None:
    if not re.fullmatch(r"[-+]?\d+(?:[,.]\d+)?", value.strip()):
        return None
    return float(value.replace(",", "."))
