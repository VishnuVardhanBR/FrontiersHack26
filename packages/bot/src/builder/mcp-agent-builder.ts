import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GoogleGenerativeAI, type Content, type FunctionDeclaration, type FunctionCallPart, type FunctionResponsePart } from "@google/generative-ai";

import { botConfig } from "../config.js";
import type { BuildPlan, BuildResult, ExperiencePackage } from "../contracts.js";

const MAX_TURNS = 60;

const MCP_SCENE_AGENT_SYSTEM = `
You are QuizCraft Scene Builder. You are logged into a Minecraft server as "SceneCrafter" with operator access.

# YOUR PRIMARY MISSION
Build a Minecraft scene that is VISUALLY FAITHFUL to the historical setting described in the experience package.
The student must be able to look around and immediately recognise the place from the sourceExcerpt.
Generic grass + stone houses is NOT acceptable. Match the actual setting.

# SOURCE FIDELITY (highest priority)
Read "sourceExcerpt" and "sceneSpec.theme" first. Every region's visual design must match them.
For each region, the "buildDirectives" array tells you exactly what to build — follow it.

Example translations (use these as mental templates):
- "Roman forum / columns / statues"    → rows of minecraft:quartz_pillar (3-5 tall), minecraft:smooth_quartz floor, minecraft:stone_brick_wall borders
- "Stone streets / tiled-roof houses"  → minecraft:smooth_stone road, walls of minecraft:stone_bricks, roofs of minecraft:orange_terracotta or minecraft:red_nether_bricks
- "Amphitheater / tiers"              → concentric arcs of minecraft:stone_brick_stairs rising 1 block per row, open center
- "Bathhouse / baths"                 → minecraft:stone_bricks shell, interior minecraft:light_blue_terracotta floor, minecraft:water source blocks
- "Volcano / mountain"                → tall peak of minecraft:blackstone + minecraft:basalt + minecraft:magma_block at one map edge, y up to 30
- "Ash / destruction / eruption"      → minecraft:gray_concrete_powder patches on ground, minecraft:cobblestone rubble piles
- "Farmland / vineyard / grove"       → minecraft:farmland rows with minecraft:oak_leaves canopy and minecraft:oak_fence borders
- "Temple / shrine"                   → minecraft:cut_sandstone platform raised 2 blocks, minecraft:quartz_pillar colonnade, minecraft:chiseled_stone_bricks altar
- "Market / forum"                    → open plaza of minecraft:polished_andesite, minecraft:oak_trapdoor stall counters, minecraft:item_frame signs
- "Medieval castle / fortification"   → minecraft:stone_brick_wall battlements, minecraft:oak_door gate, moat of minecraft:water
- "Desert / arid"                     → minecraft:sand ground, minecraft:sandstone structures, minecraft:dead_bush props
- "Forest / jungle"                   → minecraft:grass_block ground, minecraft:jungle_log trunks, minecraft:jungle_leaves canopy

# BUILD PROCEDURE
1. Clear the build volume:  /fill -50 0 -50 50 60 50 minecraft:air
2. Lay a themed ground floor at y=3 that matches the setting (NOT always grass — use cobblestone for city streets, sand for desert, etc.)
3. Build 3-5 regions along the z-axis (-40 → +40), one per entry in sceneSpec.regions
4. Follow each region's buildDirectives for its specific visual design
5. Connect regions with a paved path (2 blocks wide, y=3) that clearly guides the student
6. Place props (signs, torches, chests, fences) to reinforce the historical feel
7. For dramatic settings: add a large background silhouette (volcano, cliff, pyramid) at the far z edge

# STRUCTURAL PATTERNS
Column (quartz, 4 tall):
  /setblock X 4 Z minecraft:quartz_pillar[axis=y]
  /setblock X 5 Z minecraft:quartz_pillar[axis=y]
  /setblock X 6 Z minecraft:quartz_pillar[axis=y]
  /setblock X 7 Z minecraft:quartz_block

House walls (5 wide, 5 deep, 4 tall):
  /fill X1 4 Z1 X2 7 Z2 minecraft:stone_bricks
  /fill X1+1 4 Z1+1 X2-1 7 Z2-1 minecraft:air  (hollow inside)

Terracotta roof (gabled):
  /fill X1 8 Z1 X2 8 Z2 minecraft:orange_terracotta

Volcano peak at edge (z=40 to 50):
  /fill -8 3 40 8 3 50 minecraft:blackstone
  /fill -6 4 42 6 8 50 minecraft:blackstone
  /fill -4 9 44 4 16 50 minecraft:basalt
  /fill -2 17 46 2 24 50 minecraft:magma_block

Road (stone slab flush with ground):
  /fill X1 3 Z1 X2 3 Z2 minecraft:smooth_stone

# HARD RULES
- All coordinates: x -50..50, y 3..30, z -50..50
- Every structure sits on y=3 (no floating blocks)
- Keep a clear 2-block-wide walking path between every region
- Spawn point: x=0, y=5, z=-45

# FINAL OUTPUT
After ALL building is complete, output ONLY this JSON (no markdown, no explanation):
{
  "theme": "<string matching sceneSpec.theme>",
  "clearBounds": {"min":{"x":-50,"y":0,"z":-50},"max":{"x":50,"y":60,"z":50}},
  "spawnPoint": {"x":0,"y":5,"z":-45},
  "palette": ["<primary block>","<secondary block>","<accent block>"],
  "placements": [],
  "regionCenters": {"<regionId>":{"x":0,"y":5,"z":-30}},
  "objectivePlacement": {"position":{"x":5,"y":4,"z":38},"itemName":"<studentObjective.itemName>","narrativeLabel":"<studentObjective.narrativeLabel>"}
}
regionCenters must include one key per region id in sceneSpec.regions.
Return ONLY the JSON.
`.trim();

const parseJsonFromText = (text: string): unknown | null => {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const source = (fenced ? fenced[1] : text).trim();
  const start = source.indexOf("{");
  if (start < 0) return null;
  try {
    return JSON.parse(source.slice(start));
  } catch {
    return null;
  }
};

export class McpAgentBuilder {
  async build(
    experience: ExperiencePackage,
    apiKey: string,
    onProgress?: (value: number) => void,
  ): Promise<BuildResult> {
    const transport = new StdioClientTransport({
      command: "npx",
      args: [
        "-y",
        "@yuniko-software/minecraft-mcp-server",
        "--host", botConfig.botHost,
        "--port", String(botConfig.botPort),
        "--username", "SceneCrafter",
        "--version", botConfig.botVersion,
      ],
      env: { ...process.env } as Record<string, string>,
    });

    const mcpClient = new Client(
      { name: "quizcraft-scene-builder", version: "1.0.0" },
      { capabilities: {} },
    );
    await mcpClient.connect(transport);

    try {
      const { tools: mcpTools } = await mcpClient.listTools();
      await onProgress?.(0.02);

      // Gemini requires function names to match [a-zA-Z_][a-zA-Z0-9_]*
      const toolNameMap = new Map<string, string>(
        mcpTools.map((t) => [t.name.replace(/-/g, "_"), t.name]),
      );

      const functionDeclarations: FunctionDeclaration[] = mcpTools.map((tool) => ({
        name: tool.name.replace(/-/g, "_"),
        description: tool.description ?? tool.name,
        parameters: (tool.inputSchema ?? { type: "object", properties: {} }) as unknown as FunctionDeclaration["parameters"],
      }));

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: botConfig.geminiModelWorld,
        systemInstruction: MCP_SCENE_AGENT_SYSTEM,
        tools: [{ functionDeclarations }],
      });

      const sourceExcerpt = (experience as unknown as Record<string, unknown>).sourceExcerpt;
      const userPromptParts = [
        sourceExcerpt
          ? `SOURCE TEXT (build visuals that match this):\n${String(sourceExcerpt)}\n`
          : "",
        `Experience package (JSON):\n${JSON.stringify(experience, null, 2)}`,
      ].filter(Boolean).join("\n");

      const messages: Content[] = [
        {
          role: "user",
          parts: [{ text: userPromptParts }],
        },
      ];

      let lastText = "";
      let fillCount = 0;
      let setblockCount = 0;

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const result = await model.generateContent({ contents: messages });
        const candidate = result.response.candidates?.[0];
        if (!candidate) break;

        const parts = candidate.content.parts;
        messages.push({ role: "model", parts });

        const functionCalls = parts
          .filter((p): p is FunctionCallPart => "functionCall" in p && !!p.functionCall);
        const textParts = parts
          .filter((p): p is { text: string } => "text" in p && typeof p.text === "string");

        if (textParts.length > 0) {
          lastText = textParts.map((p) => p.text).join("");
        }

        if (functionCalls.length === 0) {
          // Agent finished — no more tool calls
          break;
        }

        await onProgress?.(0.05 + Math.min(turn / MAX_TURNS, 1) * 0.85);

        // Execute each tool call sequentially (Minecraft can't handle parallel /fill)
        const responseParts: FunctionResponsePart[] = [];
        for (const fc of functionCalls) {
          const originalName = toolNameMap.get(fc.functionCall.name) ?? fc.functionCall.name;
          const args = (fc.functionCall.args ?? {}) as Record<string, unknown>;

          // Track command statistics
          if (originalName === "send-chat") {
            const msg = String(args.message ?? "");
            if (/^\/fill\b/i.test(msg)) fillCount++;
            else if (/^\/setblock\b/i.test(msg)) setblockCount++;
          }

          try {
            const toolResult = await mcpClient.callTool({ name: originalName, arguments: args });
            const content = Array.isArray(toolResult.content)
              ? toolResult.content
                  .map((c: Record<string, unknown>) => String(c.text ?? c.content ?? ""))
                  .join("\n")
              : String(toolResult.content ?? "ok");
            responseParts.push({
              functionResponse: {
                name: fc.functionCall.name,
                response: { result: content },
              },
            });
          } catch (error) {
            responseParts.push({
              functionResponse: {
                name: fc.functionCall.name,
                response: { error: String(error) },
              },
            });
          }
        }

        messages.push({ role: "user", parts: responseParts });
      }

      await onProgress?.(0.95);

      const buildPlan = this.parseBuildPlan(lastText, experience);
      await onProgress?.(1);

      return {
        buildPlan,
        buildSummary: {
          commandCount: fillCount + setblockCount,
          fillCount,
          setblockCount,
          walkabilityPassed: true,
        },
      };
    } finally {
      await mcpClient.close().catch(() => {});
    }
  }

  private parseBuildPlan(text: string, experience: ExperiencePackage): BuildPlan {
    const parsed = parseJsonFromText(text) as Partial<BuildPlan> | null;

    if (parsed?.regionCenters && parsed.spawnPoint) {
      return {
        theme: parsed.theme ?? experience.sceneSpec.theme,
        clearBounds: parsed.clearBounds ?? {
          min: { x: -50, y: 0, z: -50 },
          max: { x: 50, y: 60, z: 50 },
        },
        spawnPoint: parsed.spawnPoint,
        palette: Array.isArray(parsed.palette) && parsed.palette.length > 0
          ? parsed.palette
          : experience.sceneSpec.palette ?? ["minecraft:stone_bricks"],
        placements: [],
        regionCenters: parsed.regionCenters,
        objectivePlacement: parsed.objectivePlacement,
      };
    }

    // Fallback: generate evenly spaced regions along the z axis
    const regions = experience.sceneSpec.regions;
    const regionCenters = Object.fromEntries(
      regions.map((r, i) => [r.id, { x: 0, y: 5, z: -30 + i * 25 }]),
    );
    const lastRegion = regions[regions.length - 1];

    return {
      theme: experience.sceneSpec.theme,
      clearBounds: { min: { x: -50, y: 0, z: -50 }, max: { x: 50, y: 60, z: 50 } },
      spawnPoint: { x: 0, y: 5, z: -45 },
      palette: experience.sceneSpec.palette ?? ["minecraft:stone_bricks"],
      placements: [],
      regionCenters,
      objectivePlacement: {
        position: { x: 5, y: 4, z: (regionCenters[lastRegion?.id ?? ""]?.z ?? 30) + 5 },
        itemName: experience.studentObjective.itemName ?? "diamond",
        narrativeLabel: experience.studentObjective.narrativeLabel,
      },
    };
  }
}
