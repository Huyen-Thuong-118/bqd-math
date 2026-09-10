from app.question_import.parser.answers import extract_legacy_answer_key


def test_legacy_answer_parser_uses_explicit_values_without_fixed_counts():
    text = """
Phần I
1) B
2) D
Câu 1. Lời giải
Phần II
1) ĐSĐS
Câu 1. Lời giải
Phần III
1) 0,31
2) -4
Câu 1. Lời giải
"""
    result = extract_legacy_answer_key(text)
    assert result["answerKey"] == ["B", "D", "D,S,D,S", "0,31", "-4"]
    assert result["complete"] is True
