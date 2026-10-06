import pytest
from scripts.shared.geometry import (
    get_bbox, bboxes_overlap, overlap_pct, find_free_position,
    assign_hitboxes, clamp_bounds, verify_no_overlaps, DEFAULT_W, DEFAULT_H,
)


class TestGetBbox:
    def test_with_explicit_width_height(self):
        item = {"x": 10.0, "y": 20.0, "width": 8.0, "height": 6.0}
        assert get_bbox(item) == (10.0, 20.0, 18.0, 26.0)

    def test_centered_when_no_dimensions(self):
        item = {"x": 50.0, "y": 50.0}
        x1, y1, x2, y2 = get_bbox(item)
        assert x1 == pytest.approx(46.0)
        assert y1 == pytest.approx(46.0)
        assert x2 == pytest.approx(54.0)
        assert y2 == pytest.approx(54.0)

    def test_custom_defaults(self):
        item = {"x": 50.0, "y": 50.0}
        x1, y1, x2, y2 = get_bbox(item, default_w=10.0, default_h=10.0)
        assert x1 == pytest.approx(45.0)
        assert x2 == pytest.approx(55.0)

    def test_zero_origin(self):
        item = {"x": 0.0, "y": 0.0, "width": 10.0, "height": 10.0}
        assert get_bbox(item) == (0.0, 0.0, 10.0, 10.0)


class TestBboxesOverlap:
    def test_no_overlap(self):
        a = (0, 0, 10, 10)
        b = (20, 20, 30, 30)
        assert bboxes_overlap(a, b) is False

    def test_full_overlap(self):
        a = (0, 0, 10, 10)
        b = (2, 2, 8, 8)
        assert bboxes_overlap(a, b) is True

    def test_partial_overlap(self):
        a = (0, 0, 10, 10)
        b = (5, 5, 15, 15)
        assert bboxes_overlap(a, b) is True

    def test_edge_touching_no_overlap(self):
        a = (0, 0, 10, 10)
        b = (10, 0, 20, 10)
        assert bboxes_overlap(a, b) is False

    def test_corner_touching_no_overlap(self):
        a = (0, 0, 10, 10)
        b = (10, 10, 20, 20)
        assert bboxes_overlap(a, b) is False


class TestOverlapPct:
    def test_no_overlap(self):
        a = (0, 0, 10, 10)
        b = (20, 20, 30, 30)
        assert overlap_pct(a, b) == 0.0

    def test_full_containment(self):
        a = (0, 0, 20, 20)
        b = (5, 5, 10, 10)
        pct = overlap_pct(a, b)
        assert pct == pytest.approx(100.0)

    def test_partial_overlap(self):
        a = (0, 0, 10, 10)
        b = (5, 0, 15, 10)
        pct = overlap_pct(a, b)
        assert pct == pytest.approx(50.0)

    def test_zero_area_bbox(self):
        a = (0, 0, 0, 0)
        b = (0, 0, 10, 10)
        assert overlap_pct(a, b) == 0.0


class TestFindFreePosition:
    def test_empty_room(self):
        x, y = find_free_position("test", 8.0, 8.0, [])
        assert 0 <= x <= 100
        assert 0 <= y <= 100

    def test_avoids_existing(self):
        existing = [{"x": 5, "y": 20, "width": 15, "height": 15}]
        x, y = find_free_position("test", 8.0, 8.0, existing)
        for e in existing:
            ex2 = e["x"] + e["width"]
            ey2 = e["y"] + e["height"]
            overlap = x < ex2 and x + 8.0 > e["x"] and y < ey2 and y + 8.0 > e["y"]
            assert not overlap

    def test_item_missing_keys_ignored(self):
        existing = [{"x": 5, "y": 20}]
        x, y = find_free_position("test", 8.0, 8.0, existing)
        assert isinstance(x, float)


class TestAssignHitboxes:
    def test_assigns_travel_size(self):
        rooms = {"test": {"interactables": [{"id": "door1", "type": "travel", "x": 50, "y": 50}]}}
        assign_hitboxes(rooms)
        item = rooms["test"]["interactables"][0]
        assert item["width"] == 10.0
        assert item["height"] == 8.0

    def test_no_override_existing(self):
        rooms = {"test": {"interactables": [{"id": "obj1", "x": 50, "y": 50, "width": 12, "height": 15}]}}
        assign_hitboxes(rooms)
        item = rooms["test"]["interactables"][0]
        assert item["width"] == 12
        assert item["height"] == 15

    def test_default_to_inspect(self):
        rooms = {"test": {"interactables": [{"id": "obj1", "x": 50, "y": 50, "type": "unknown"}]}}
        assign_hitboxes(rooms)
        item = rooms["test"]["interactables"][0]
        assert item["width"] == 7.0
        assert item["height"] == 7.0


class TestClampBounds:
    def test_no_clamp_needed(self):
        rooms = {"test": {"interactables": [{"id": "ok", "x": 50, "y": 50, "width": 8, "height": 8}]}}
        clamp_bounds(rooms)
        assert rooms["test"]["interactables"][0]["x"] == 50

    def test_clamp_right_overflow(self):
        rooms = {"test": {"interactables": [{"id": "over", "x": 95, "y": 50, "width": 10, "height": 10}]}}
        clamp_bounds(rooms)
        assert rooms["test"]["interactables"][0]["x"] == 90

    def test_clamp_bottom_overflow(self):
        rooms = {"test": {"interactables": [{"id": "over", "x": 50, "y": 95, "width": 10, "height": 10}]}}
        clamp_bounds(rooms)
        assert rooms["test"]["interactables"][0]["y"] == 90

    def test_clamp_negative(self):
        rooms = {"test": {"interactables": [{"id": "neg", "x": -5, "y": 50, "width": 10, "height": 10}]}}
        clamp_bounds(rooms)
        assert rooms["test"]["interactables"][0]["x"] == 0

    def test_centered_clamp_negative_origin(self):
        rooms = {"test": {"interactables": [{"id": "c", "x": 2, "y": 2}]}}
        clamp_bounds(rooms)
        assert rooms["test"]["interactables"][0]["x"] == pytest.approx(DEFAULT_W / 2)
        assert rooms["test"]["interactables"][0]["y"] == pytest.approx(DEFAULT_H / 2)


class TestVerifyNoOverlaps:
    def test_clean_room(self):
        rooms = {"test": {"interactables": [
            {"id": "a", "x": 10, "y": 10, "width": 8, "height": 8},
            {"id": "b", "x": 50, "y": 10, "width": 8, "height": 8},
        ]}}
        issues = verify_no_overlaps(rooms)
        assert len(issues) == 0

    def test_duplicate_id(self):
        rooms = {"test": {"interactables": [
            {"id": "dup", "x": 10, "y": 10, "width": 8, "height": 8},
            {"id": "dup", "x": 50, "y": 50, "width": 8, "height": 8},
        ]}}
        issues = verify_no_overlaps(rooms)
        assert any("DUPLICATE" in i for i in issues)

    def test_out_of_bounds(self):
        rooms = {"test": {"interactables": [
            {"id": "oob", "x": -5, "y": 50, "width": 8, "height": 8},
        ]}}
        issues = verify_no_overlaps(rooms)
        assert any("OUT_OF_BOUNDS" in i for i in issues)

    def test_overlap_above_threshold(self):
        rooms = {"test": {"interactables": [
            {"id": "a", "x": 10, "y": 10, "width": 20, "height": 20},
            {"id": "b", "x": 15, "y": 15, "width": 20, "height": 20},
        ]}}
        issues = verify_no_overlaps(rooms, threshold=5.0)
        assert any("OVERLAP" in i for i in issues)
