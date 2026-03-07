# Aqua Roma — Hardcoded Demo Spec

**Branch:** `feature/aqua-roma-hardcoded`  
**Goal:** 3–5 minute vertical slice. Bot-led Roman aqueduct tour + one simple puzzle. No procedural generation.

---

## 1. Demo goal

- Show that a bot-led guided tour can teach a real historical engineering concept.
- Player learns through interaction (tour + puzzle), not just dialogue.
- Minecraft + Mineflayer + simple scripting is enough for an educational minigame MVP.

---

## 2. Learning objectives (3 takeaways)

1. **Aqueducts moved water using gravity.**
2. **Roman engineers used arches for strength and support.**
3. **Roman infrastructure was a system:** source → channel → supports → city delivery.

---

## 3. Target audience

- Ages 9–14, short attention span, minimal reading.
- Design: **visual, short, friendly, obvious, low failure cost.**

---

## 4. Session flow → FSM mapping

| Step | Spec name        | QuizCraft FSM state   | Notes |
|------|------------------|------------------------|-------|
| 1    | Spawn / greeting | WAIT_FOR_PLAYER → INTRODUCE | Bot waits until player near. |
| 2    | Stop 1 — The arch | ESCORT_TO_REGION → NARRATE | Bot walks to arch, explains. |
| 3    | Stop 2 — Channel | ESCORT_TO_REGION → NARRATE | Channel + slope explanation. |
| 4    | Stop 3 — Basin   | ESCORT_TO_REGION → NARRATE | City delivery point. |
| 5    | Puzzle setup     | NARRATE (dialogue)    | “System is broken. Restore the water.” |
| 6    | Puzzle           | MONITOR_OBJECTIVE     | Lever / block / route; detect completion. |
| 7    | Success          | (trigger) → CLIMAX_RECAP | Water flows; bot celebrates. |
| 8    | Wrap-up          | CLIMAX_RECAP → END_SESSION | Recap + optional quiz. |

---

## 5. World layout (25×25 to 40×40 blocks)

| Zone | Name             | Purpose |
|------|------------------|---------|
| A    | Spawn courtyard  | Signage, bot start. |
| B    | Aqueduct arch    | One visible arch (broken vs intact optional). |
| C    | Channel section  | Elevated trough, broken piece / lever / route switch. |
| D    | City basin       | Fountain / cistern, delivery endpoint. |
| E    | Maintenance      | One repair block or switch area. |

**Footprint:** Small. Museum exhibit + puzzle room, not a full city.

---

## 6. Build checklist (handcrafted scene)

- [ ] **Ground:** Flat or slight slope; spawn at (0, 4, 0).
- [ ] **Zone A — Spawn:** Small courtyard, 1–2 signs (“Aqua Roma”, “Follow the guide”).
- [ ] **Zone B — Arch:** 1–2 arches (stone bricks); optional broken vs intact.
- [ ] **Zone C — Channel:** Elevated trough (slabs/stairs), one blocked or dry section; lever or gate.
- [ ] **Zone D — Basin:** Empty fountain/cistern; endpoint for water “flow” (visual when puzzle solved).
- [ ] **Zone E — Maintenance:** Lever(s) and/or one placeable block to “repair” channel.
- [ ] **Paths:** Clear path A→B→C→D; E reachable from C or D.
- [ ] **Puzzle elements:**  
  - At least one **lever** (sluice gate or route switch).  
  - Optional: **one block** player must place to repair channel.  
  - Optional: **second lever** to choose city line vs waste channel (obvious which is correct).

---

## 7. Bot dialogue script (short lines, 1–2 sentences max)

### Greeting (after player near)
- “Welcome to Aqua Roma. Today I’ll show you how Roman engineers moved water across long distances.”

### Stop 1 — Arch
- “This arch helps hold up the channel above it. Arches spread weight better than a flat gap.”
- “Why not just build a flat wall everywhere?” *(engagement; answer not graded)*

### Stop 2 — Channel
- “Water doesn’t need pumps here. It moves because the channel slopes very slightly downhill.”
- “Too steep is bad, too flat is bad. Romans got the slope just right.”

### Stop 3 — City basin
- “Roman engineers weren’t just building structures. They were building systems that served whole cities.”
- “This basin is where the water finally arrived for baths, fountains, and homes.”

### Puzzle intro
- “The system is broken. The city fountain is dry. Can you restore the water?”
- “One gate is closed, or one section is blocked. See if you can fix it.”

### During puzzle (hints if needed)
- “Look for a lever that opens the water gate.”
- “Or a missing block in the channel wall.”
- “Try the lever to send water toward the city, not the waste channel.”

### Success
- “Well done. Roman aqueducts depended on careful design, steady slope, and constant maintenance.”
- “You used three ideas Roman engineers relied on: strong supports, controlled flow, and system design.”

### Optional final quiz
- “What made the water move? A: Magic  B: Gravity  C: Fire”
- Accept “B” or “gravity” in chat; then wrap.

---

## 8. Puzzle design (MVP)

- **Objective:** Restore water to the city basin.
- **Mechanics (use 2 of 3):**
  - **A:** Flip lever → opens sluice gate.
  - **B:** Place one block in channel wall.
  - **C:** Use lever to direct water into city line (not waste).
- **Principles:** Visually readable, one main objective, 1–2 interactions, immediate feedback, tied to the explanation. No obscure logic, no large map.

**Win:** Water “flows” (visual: water in basin / block state change / particle or lamp). Bot says success line and moves to recap.

**Soft fail:** Wrong lever or block → bot gives hint; retry immediately. No hard fail.

---

## 9. Interactivity spec

**Allowed:** Proximity trigger, lever flip, button press, place one block, chat response, visual water-success state.

**Avoid for MVP:** Inventory crafting, combat, timed fail states, large branching quests, procedural NPCs, multi-user sync.

---

## 10. Success criteria

Demo is successful if a new player can:

- Understand what the aqueduct does.
- Follow the bot without confusion.
- Complete the puzzle in under 2 minutes.
- Explain afterward: “water moved downhill,” “arches support the structure,” “Romans built systems for cities.”

---

## 11. Hardcoded plans in codebase

- **Experience package (shared):** `packages/shared/src/plans/aqua-roma-experience.ts`  
  - Full `ExperiencePackage` (regions, dialogue, questions, triggers) for Aqua Roma. Use in “demo mode” instead of Gemini.

- **Build plan (bot):** `packages/bot/src/plans/aqua-roma-build.ts`  
  - Hardcoded `BuildPlan` (region centers, placements, objective placement) in bot shape. Use when building the Aqua Roma scene without Gemini.

To run the demo: start a session in “Aqua Roma demo” mode so the server/bot load these plans instead of calling the experience planner and scene builder.

---

## 12. Blunt MVP version

- One arch, one channel, one basin, one bot, one lever, one line of “flowing” water, three explanation stops.  
- That is enough for proof; the rest is polish.
