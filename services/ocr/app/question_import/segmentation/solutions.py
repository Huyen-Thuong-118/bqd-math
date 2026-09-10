import re

SOLUTION_PATTERN = re.compile(r"^\s*(?:Lời\s+giải|Giải)\s*[.:]?\s*", re.IGNORECASE)


def is_solution_start(text: str) -> bool:
    return bool(SOLUTION_PATTERN.match(text))


def strip_solution_marker(text: str) -> str:
    return SOLUTION_PATTERN.sub("", text, count=1).strip()
