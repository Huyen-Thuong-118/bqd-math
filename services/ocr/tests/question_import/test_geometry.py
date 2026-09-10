import pytest
from app.question_import.models.geometry import BoundingBox


def test_geometry_helpers_and_coordinate_round_trip():
    box = BoundingBox(x0=10, y0=20, x1=50, y1=80)
    assert box.width == 40
    assert box.height == 60
    assert box.area == 2400
    assert box.contains(BoundingBox(x0=20, y0=30, x1=30, y1=40))
    assert box.intersects(BoundingBox(x0=49, y0=79, x1=60, y1=90))
    normalized = box.normalized(100, 200)
    restored = BoundingBox.from_normalized(normalized, 100, 200)
    assert restored.model_dump() == pytest.approx(box.model_dump())
    assert box.to_pixels(100, 200, 200, 400).model_dump() == {
        "x0": 20.0,
        "y0": 40.0,
        "x1": 100.0,
        "y1": 160.0,
    }


def test_rejects_inverted_box():
    with pytest.raises(ValueError):
        BoundingBox(x0=5, y0=0, x1=4, y1=2)
