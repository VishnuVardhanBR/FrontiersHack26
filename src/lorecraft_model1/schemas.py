from __future__ import annotations

from typing import Literal

from atomic_agents import BaseIOSchema
from pydantic import Field


class TopicContextInput(BaseIOSchema):
    """topic context"""
    topic: str = Field(..., min_length=2, description="Historical topic name.")
    grade_level: str = Field(default="middle school")


class TopicContext(BaseIOSchema):
    """topic context"""
    topic: str = Field(..., min_length=2)
    generated_context: str = Field(
        ...,
        min_length=200,
        description="Teacher-ready background context generated directly from the topic.",
    )
    key_entities: list[str] = Field(..., min_length=3)
    key_events: list[str] = Field(..., min_length=3)
    timeline: list[str] = Field(..., min_length=3)
    core_concepts: list[str] = Field(..., min_length=3)
    factual_guardrails: list[str] = Field(
        ...,
        min_length=3,
        description="Facts that should not be contradicted in the generated scene.",
    )


class PlannerInput(BaseIOSchema):
    """topic context"""
    topic_name: str = Field(..., min_length=2, description="Historical topic name.")
    topic_information: str = Field(
        ...,
        min_length=200,
        description="Grounded context for planning (from topic generation or teacher text).",
    )
    grade_level: str = Field(default="middle school")
    preferred_question_count: int = Field(default=4, ge=3, le=5)
    objective_emphasis: str | None = Field(
        default=None,
        description="Optional learning emphasis, e.g. cause and effect.",
    )
    duration_minutes: int = Field(default=6, ge=5, le=7)


class CreativeLicense(BaseIOSchema):
    """topic context"""
    enabled: bool = Field(default=True)
    notes: str = Field(
        ...,
        min_length=8,
        description="How the scene can be creatively augmented while preserving facts.",
    )


class RegionSpec(BaseIOSchema):
    """topic context"""
    id: str = Field(..., pattern=r"^[a-z0-9_]+$")
    purpose: str = Field(..., min_length=3)
    description: str = Field(..., min_length=10)
    build_grammar_tokens: list[str] = Field(
        ...,
        min_length=2,
        description="Constrained symbolic build tokens for Model 2.",
    )
    anchor_facts: list[str] = Field(
        ...,
        min_length=1,
        description="Facts that should be narrated in this region.",
    )
    trigger_label: str = Field(..., min_length=3)


class SceneSpec(BaseIOSchema):
    """topic context"""
    theme: str = Field(..., min_length=5)
    size: Literal["small", "medium"] = Field(default="medium")
    world_constraints: list[str] = Field(
        default_factory=lambda: [
            "superflat world",
            "build around origin (0,0,0)",
            "play area max 100x100x100",
            "clear walkable route",
        ]
    )
    regions: list[RegionSpec] = Field(..., min_length=3, max_length=5)


class StudentObjective(BaseIOSchema):
    """topic context"""
    type: Literal["find_item"] = "find_item"
    item_name: str = Field(default="diamond")
    narrative_label: str = Field(..., min_length=5)
    placement_rule: str = Field(..., min_length=10)


class DialogueBeat(BaseIOSchema):
    """topic context"""
    beat_id: str = Field(..., pattern=r"^d[0-9]+$")
    region_id: str = Field(..., pattern=r"^[a-z0-9_]+$")
    narration: str = Field(..., min_length=12)
    learning_purpose: str = Field(..., min_length=6)


class QuestionBeat(BaseIOSchema):
    """topic context"""
    question_id: str = Field(..., pattern=r"^q[0-9]+$")
    region_id: str = Field(..., pattern=r"^[a-z0-9_]+$")
    question_type: Literal["factual_recall", "cause_effect", "location_linked", "recap"]
    prompt: str = Field(..., min_length=12)
    accepted_concepts: list[str] = Field(..., min_length=1)
    first_hint: str = Field(..., min_length=8)


class TriggerRule(BaseIOSchema):
    """topic context"""
    trigger_id: str = Field(..., pattern=r"^t[0-9]+$")
    trigger_type: Literal[
        "enter_region_radius",
        "time_in_region",
        "incorrect_answer_threshold",
        "item_found",
        "no_movement_timeout",
        "final_region_reached",
    ]
    condition: str = Field(..., min_length=8)
    effect: str = Field(..., min_length=8)


class SourceGrounding(BaseIOSchema):
    """topic context"""
    grounded_facts: list[str] = Field(..., min_length=3)
    creative_dramatization: list[str] = Field(..., min_length=1)
    symbolic_gameplay_elements: list[str] = Field(..., min_length=1)


class ExperiencePackage(BaseIOSchema):
    """topic context"""
    experience_id: str = Field(..., pattern=r"^[a-z0-9_]+$")
    title: str = Field(..., min_length=5)
    grade_band: str = Field(default="middle school")
    duration_minutes: int = Field(default=6, ge=5, le=7)
    learning_objectives: list[str] = Field(..., min_length=3, max_length=5)
    historical_summary: str = Field(..., min_length=40)
    source_grounding: SourceGrounding
    creative_license: CreativeLicense
    scene_spec: SceneSpec
    student_objective: StudentObjective
    dialogue_plan: list[DialogueBeat] = Field(..., min_length=3)
    question_plan: list[QuestionBeat] = Field(..., min_length=3, max_length=5)
    trigger_plan: list[TriggerRule] = Field(..., min_length=5)
    success_conditions: list[str] = Field(..., min_length=3)
    fallback_hints: list[str] = Field(..., min_length=3)
    factual_grounding_notes: list[str] = Field(..., min_length=3)
    build_constraints: list[str] = Field(
        default_factory=lambda: [
            "Use normal Mineflayer actions only",
            "Keep scene compact and modular",
            "Keep all regions walkable",
            "Avoid lava directly on main route",
            "Keep objective reachable without teleport",
        ]
    )
