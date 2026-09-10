from __future__ import annotations

import re


def extract_legacy_answer_key(text: str) -> dict:
    """Compatibility parser for dedicated answer sheets; only explicit answer syntax."""
    normalized = text.replace("\r", "")
    section_chunks = re.split(r"(?im)^\s*Phần\s+(I{1,3}|[123])\b", normalized)
    chunks: dict[str, str] = {}
    for index in range(1, len(section_chunks), 2):
        chunks[section_chunks[index].casefold()] = section_chunks[index + 1]

    part_one = chunks.get("i") or chunks.get("1") or ""
    answer_area = re.split(r"(?i)Câu\s+1\s*[.:)]", part_one, maxsplit=1)[0]
    choices = [
        value.upper()
        for value in re.findall(r"(?i)\b\d+\s*[).:-]\s*([A-E])\b", answer_area)
    ]
    if not choices:
        choices = [
            value.upper()
            for value in re.findall(
                r"(?i)(?:chọn\s+(?:đáp\s+án\s+)?|đáp\s+án\s*[:.]?\s*)([A-E])\b",
                part_one,
            )
        ]

    part_two = chunks.get("ii") or chunks.get("2") or ""
    tf_area = re.split(r"(?i)Câu\s+1\s*[.:)]", part_two, maxsplit=1)[0]
    rows = re.findall(
        r"(?im)^\s*(?:\d+\s*[).:-]\s*)?([DĐS](?:\s*[,;|]?\s*[DĐS]){3})\s*$", tf_area
    )
    true_false = []
    for row in rows:
        values = re.findall(r"[DĐS]", row.upper())
        true_false.append(",".join("D" if value in "DĐ" else "S" for value in values))
    if not true_false:
        rows = re.findall(r"(?i)\b\d+\s*[).:-]\s*([DĐS]{4})\b", tf_area)
        for row in rows:
            true_false.append(
                ",".join("D" if value in "DĐ" else "S" for value in row.upper())
            )
    if not true_false:
        answer_line = re.search(r"(?im)^\s*Đáp\s+án\s+(.+)$", tf_area)
        if answer_line:
            for row in re.findall(
                r"(?<![A-ZĐ])([DĐS]{4})(?![A-ZĐ])", answer_line.group(1).upper()
            ):
                true_false.append(
                    ",".join("D" if value in "DĐ" else "S" for value in row)
                )

    part_three = chunks.get("iii") or chunks.get("3") or ""
    short_area = re.split(r"(?i)Câu\s+1\s*[.:)]", part_three, maxsplit=1)[0]
    short_answers = re.findall(
        r"(?i)\b\d+\s*[).:-]\s*([-+]?\d+(?:[,.]\d+)?)\b", short_area
    )
    if not short_answers:
        answer_line = re.search(r"(?im)^\s*Đáp\s+án\s+(.+)$", short_area)
        if answer_line:
            short_answers = re.findall(r"[-+]?\d+(?:[,.]\d+)?", answer_line.group(1))

    answer_key = choices + true_false + short_answers
    return {
        "multipleChoice": choices,
        "trueFalse": true_false,
        "shortAnswer": short_answers,
        "answerKey": answer_key,
        "complete": bool(choices and true_false and short_answers),
    }
