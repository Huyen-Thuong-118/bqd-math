from ..models.question import QuestionOption


def options_are_consistent(options: list[QuestionOption]) -> bool:
    keys = [option.key for option in options]
    return len(keys) >= 2 and len(keys) == len(set(keys))
