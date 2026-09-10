from ..models.question import TrueFalseStatement


def apply_explicit_summary(
    statements: list[TrueFalseStatement], summary: dict[str, bool]
) -> list[TrueFalseStatement]:
    for statement in statements:
        if statement.key in summary:
            statement.answer = summary[statement.key]
    return statements
