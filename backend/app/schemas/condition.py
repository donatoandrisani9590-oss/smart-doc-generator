"""
Condition Schema: Pydantic models for clause condition validation.
Supports both simple conditions and complex AND/OR groups.
"""
from __future__ import annotations
from typing import Literal, Union, List, Any, Optional
from pydantic import BaseModel, Field, model_validator


class SimpleCondition(BaseModel):
    """
    A simple condition comparing a field value.
    Example: {"type": "simple", "field": "firmenwagen", "operator": "=", "value": true}
    """
    type: Literal["simple"] = "simple"
    id: Optional[str] = None  # Frontend-generated ID for UI tracking
    field: str = Field(..., min_length=1, description="Form field name to evaluate")
    operator: Literal[
        "=", "!=",  # Equality
        ">", ">=", "<", "<=",  # Numeric comparison
        "contains", "startsWith", "endsWith",  # String operations
        "exists", "notExists",  # Existence checks
        "in", "notIn"  # List membership
    ] = Field(default="=", description="Comparison operator")
    value: Any = Field(default=None, description="Expected value to compare against")


class ConditionGroup(BaseModel):
    """
    A group of conditions combined with AND/OR logic.
    Supports nesting up to 3 levels deep (matching frontend).

    Example:
    {
        "type": "group",
        "logic": "and",
        "conditions": [
            {"type": "simple", "field": "position", "operator": "=", "value": "Manager"},
            {"type": "simple", "field": "gehalt", "operator": ">=", "value": 50000}
        ]
    }
    """
    type: Literal["group"] = "group"
    id: Optional[str] = None  # Frontend-generated ID for UI tracking
    logic: Literal["and", "or"] = Field(default="and", description="How to combine conditions")
    conditions: List[Union[SimpleCondition, "ConditionGroup"]] = Field(
        default_factory=list,
        description="List of conditions to combine"
    )

    @model_validator(mode="after")
    def validate_nesting_depth(self) -> "ConditionGroup":
        """Ensure nesting doesn't exceed 3 levels (matching frontend limit)."""
        def check_depth(condition: Union[SimpleCondition, ConditionGroup], depth: int) -> int:
            if depth > 3:
                raise ValueError("Condition nesting cannot exceed 3 levels")
            if isinstance(condition, ConditionGroup):
                max_child_depth = depth
                for child in condition.conditions:
                    child_depth = check_depth(child, depth + 1)
                    max_child_depth = max(max_child_depth, child_depth)
                return max_child_depth
            return depth

        check_depth(self, 1)
        return self


class LegacyCondition(BaseModel):
    """
    Legacy condition format for backwards compatibility.
    Example: {"field": "firmenwagen", "operator": "=", "value": true}
    """
    field: str
    operator: str = "="
    value: Any = None


# Union type for any valid condition format
Condition = Union[SimpleCondition, ConditionGroup, LegacyCondition, None]


def normalize_condition(condition: dict | None) -> dict | None:
    """
    Normalize a condition to the modern format.
    Converts legacy conditions to SimpleCondition format.

    Args:
        condition: Raw condition dict from database

    Returns:
        Normalized condition dict or None
    """
    if not condition:
        return None

    # Already in modern format
    if condition.get("type") in ("simple", "group"):
        return condition

    # Legacy format: {"field": "x", "operator": "=", "value": y}
    if "field" in condition and "type" not in condition:
        return {
            "type": "simple",
            "field": condition.get("field"),
            "operator": condition.get("operator", "="),
            "value": condition.get("value")
        }

    return condition


# Enable forward references for recursive model
ConditionGroup.model_rebuild()
