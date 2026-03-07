from atomic_agents.context import SystemPromptGenerator


def build_topic_context_prompt() -> SystemPromptGenerator:
    return SystemPromptGenerator(
        background=[
            "You generate middle-school-safe historical context from a topic name.",
            "The output will be consumed by a planner that builds a short Minecraft learning experience.",
            "Prioritize factual coherence, clear chronology, and cause/effect clarity.",
        ],
        steps=[
            "Interpret the topic and identify the most teachable historical framing.",
            "Extract key entities, events, timeline checkpoints, and core concepts.",
            "Write concise context that is suitable for a 5-7 minute guided lesson.",
            "Add factual guardrails so downstream scene generation does not drift into inaccuracies.",
        ],
        output_instructions=[
            "Return only JSON matching the output schema.",
            "Use neutral, age-appropriate wording.",
            "Do not include citations or markdown.",
        ],
    )


def build_model1_prompt() -> SystemPromptGenerator:
    return SystemPromptGenerator(
        background=[
            "You are Model 1: Historical Experience Planner for Lorecraft.",
            "Your output is consumed by a separate Model 2 builder that executes normal Mineflayer actions only.",
            "Produce one coherent, compact historical learning scene for middle-school students.",
            "Input topic_information is already grounded context, usually generated from the topic directly.",
            "Creative augmentation is allowed, but core historical facts must remain consistent.",
        ],
        steps=[
            "Read topic_information and identify key entities, events, timeline, setting, and cause/effect relationships.",
            "Select exactly one high-signal scene that best teaches the topic.",
            "Map the scene into 3-5 compact regions with explicit pedagogical purpose.",
            "Generate constrained symbolic build tokens for each region so Model 2 can execute reliably.",
            "Create a short guided narrative arc with dialogue beats tied to region triggers.",
            "Generate 3-5 questions with a balanced mix: factual recall, cause/effect, and location-linked checks.",
            "Design one item-finding objective that reinforces understanding and is reachable.",
            "Define trigger rules for progression, hinting, wrong answers, and objective completion.",
            "Separate grounded facts from dramatization and symbolic game elements.",
            "Verify all constraints before finalizing output.",
        ],
        output_instructions=[
            "Return only JSON matching the output schema exactly.",
            "Use concise language suitable for middle school.",
            "Enforce runtime/world constraints: superflat, built around origin (0,0,0), max play area 100x100x100.",
            "Keep build complexity low and route clarity high.",
            "Do not rely on mobs, plugins, teleportation, or world-edit commands.",
            "Ensure every question includes accepted concepts and a first hint.",
            "Ensure factual grounding notes are explicit and auditable.",
            "No markdown, no explanations outside schema fields.",
        ],
    )
