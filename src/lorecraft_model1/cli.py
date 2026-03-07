from __future__ import annotations

import argparse
from pathlib import Path

from planner import ChapterPlannerAgent


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="lorecraft-model1",
        description="Generate an ExperiencePackage from a topic using Atomic Agents + Gemini Pro.",
    )
    parser.add_argument("--topic", required=True, help="Historical topic to plan from.")
    parser.add_argument("--grade-level", default="middle school")
    parser.add_argument("--preferred-question-count", type=int, default=4)
    parser.add_argument("--objective-emphasis", default=None)
    parser.add_argument("--duration-minutes", type=int, default=6)
    parser.add_argument(
        "--topic-information-file",
        default=None,
        help="Optional pre-written context text. If omitted, context is generated from --topic.",
    )
    parser.add_argument(
        "--context-output",
        default=None,
        help="Optional JSON file path for generated topic context.",
    )
    parser.add_argument("--model", default=None, help="Override Gemini model id.")
    parser.add_argument("--output", default=None, help="Optional output JSON file.")
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    topic_information: str | None = None
    if args.topic_information_file:
        topic_information = Path(args.topic_information_file).read_text(encoding="utf-8")

    agent = ChapterPlannerAgent(model=args.model)
    topic_context, package = agent.plan_from_topic(
        topic=args.topic,
        grade_level=args.grade_level,
        preferred_question_count=args.preferred_question_count,
        objective_emphasis=args.objective_emphasis,
        duration_minutes=args.duration_minutes,
        topic_information=topic_information,
    )
    payload = package.model_dump_json(indent=2)

    if args.context_output and topic_context is not None:
        Path(args.context_output).write_text(
            topic_context.model_dump_json(indent=2) + "\n",
            encoding="utf-8",
        )

    if args.output:
        Path(args.output).write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)


if __name__ == "__main__":
    main()
