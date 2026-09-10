from ..models.question import ParseConfidence


def build_confidence(
    *,
    segmentation: float,
    transcription: float,
    structure: float,
    figures: float,
    answer: float | None,
) -> ParseConfidence:
    return ParseConfidence(
        segmentation=segmentation,
        transcription=transcription,
        structure=structure,
        figures=figures,
        answer=answer,
    )
