from __future__ import annotations

import os

import instructor
from atomic_agents import AgentConfig, AtomicAgent
from atomic_agents.context import ChatHistory
from openai import OpenAI

from prompt import build_model1_prompt, build_topic_context_prompt
from schemas import ExperiencePackage, PlannerInput, TopicContext, TopicContextInput

DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview"


class ChapterPlannerAgent:
    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        resolved_api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not resolved_api_key:
            raise ValueError("Missing GEMINI_API_KEY.")

        resolved_model = model or os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
        resolved_base_url = base_url or os.getenv("GEMINI_BASE_URL", DEFAULT_GEMINI_BASE_URL)

        openai_client = OpenAI(api_key=resolved_api_key, base_url=resolved_base_url)
        instructor_client = instructor.from_openai(openai_client, mode=instructor.Mode.JSON)

        self._context_agent = AtomicAgent[TopicContextInput, TopicContext](
            config=AgentConfig(
                client=instructor_client,
                model=resolved_model,
                history=ChatHistory(),
                system_prompt_generator=build_topic_context_prompt(),
            )
        )

        self._planner_agent = AtomicAgent[PlannerInput, ExperiencePackage](
            config=AgentConfig(
                client=instructor_client,
                model=resolved_model,
                history=ChatHistory(),
                system_prompt_generator=build_model1_prompt(),
            )
        )

    def generate_topic_context(self, context_input: TopicContextInput) -> TopicContext:
        return self._context_agent.run(context_input)

    @staticmethod
    def _compose_topic_information(topic_context: TopicContext) -> str:
        sections: list[str] = [
            f"Topic: {topic_context.topic}",
            "",
            "Generated Context:",
            topic_context.generated_context,
            "",
            "Key Entities:",
            *[f"- {item}" for item in topic_context.key_entities],
            "",
            "Key Events:",
            *[f"- {item}" for item in topic_context.key_events],
            "",
            "Timeline:",
            *[f"- {item}" for item in topic_context.timeline],
            "",
            "Core Concepts:",
            *[f"- {item}" for item in topic_context.core_concepts],
            "",
            "Factual Guardrails:",
            *[f"- {item}" for item in topic_context.factual_guardrails],
        ]
        return "\n".join(sections)

    def plan(self, planner_input: PlannerInput) -> ExperiencePackage:
        return self._planner_agent.run(planner_input)

    def plan_from_topic(
        self,
        topic: str,
        *,
        grade_level: str = "middle school",
        preferred_question_count: int = 4,
        objective_emphasis: str | None = None,
        duration_minutes: int = 6,
        topic_information: str | None = None,
    ) -> tuple[TopicContext | None, ExperiencePackage]:
        generated_context: TopicContext | None = None
        resolved_topic_information = topic_information

        if not resolved_topic_information:
            generated_context = self.generate_topic_context(
                TopicContextInput(
                    topic=topic,
                    grade_level=grade_level,
                    objective_emphasis=objective_emphasis,
                )
            )
            resolved_topic_information = self._compose_topic_information(generated_context)

        planner_input = PlannerInput(
            topic_name=topic,
            topic_information=resolved_topic_information,
            grade_level=grade_level,
            preferred_question_count=preferred_question_count,
            objective_emphasis=objective_emphasis,
            duration_minutes=duration_minutes,
        )
        return generated_context, self.plan(planner_input)
