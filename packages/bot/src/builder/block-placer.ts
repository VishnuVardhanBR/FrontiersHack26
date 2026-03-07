import type { Bot } from "mineflayer";

import { BlockPlacement, Vector3Like } from "../contracts.js";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface FillCommand {
  kind: "fill";
  from: Vector3Like;
  to: Vector3Like;
  block: string;
}

interface SetBlockCommand {
  kind: "setblock";
  placement: BlockPlacement;
}

type WorldCommand = FillCommand | SetBlockCommand;

export interface PlacementStats {
  commandCount: number;
  fillCount: number;
  setblockCount: number;
}

export class BlockPlacer {
  constructor(private readonly bot: Bot) {}

  async clearArea(min: Vector3Like, max: Vector3Like): Promise<void> {
    await this.executeCommands(
      [
        {
          kind: "fill",
          from: min,
          to: max,
          block: "minecraft:air",
        },
        {
          kind: "fill",
          from: { x: min.x, y: 3, z: min.z },
          to: { x: max.x, y: 3, z: max.z },
          block: "minecraft:grass_block",
        },
      ],
      () => undefined,
    );
  }

  async placeBlocks(
    placements: BlockPlacement[],
    onProgress?: (value: number) => Promise<void> | void,
  ): Promise<PlacementStats> {
    const commands = this.optimize(placements);
    return this.executeCommands(commands, onProgress);
  }

  private optimize(placements: BlockPlacement[]): WorldCommand[] {
    const grouped = new Map<string, BlockPlacement[]>();

    for (const placement of placements) {
      const key = `${placement.block}|${placement.nbt ?? ""}|${placement.y}|${placement.z}`;
      const items = grouped.get(key) ?? [];
      items.push(placement);
      grouped.set(key, items);
    }

    const commands: WorldCommand[] = [];

    for (const items of grouped.values()) {
      items.sort((left, right) => left.x - right.x);
      let lineStart = items[0];
      let previous = items[0];

      for (let index = 1; index <= items.length; index += 1) {
        const current = items[index];
        const contiguous =
          current &&
          current.block === previous.block &&
          current.nbt === previous.nbt &&
          current.y === previous.y &&
          current.z === previous.z &&
          current.x === previous.x + 1;

        if (contiguous) {
          previous = current;
          continue;
        }

        if (!lineStart.nbt && previous.x > lineStart.x) {
          commands.push({
            kind: "fill",
            from: { x: lineStart.x, y: lineStart.y, z: lineStart.z },
            to: { x: previous.x, y: previous.y, z: previous.z },
            block: lineStart.block,
          });
        } else {
          for (let x = lineStart.x; x <= previous.x; x += 1) {
            const placement = items.find((item) => item.x === x && item.y === lineStart.y && item.z === lineStart.z);
            if (placement) {
              commands.push({ kind: "setblock", placement });
            }
          }
        }

        if (current) {
          lineStart = current;
          previous = current;
        }
      }
    }

    return commands;
  }

  private async executeCommands(
    commands: WorldCommand[],
    onProgress?: (value: number) => Promise<void> | void,
  ): Promise<PlacementStats> {
    let fillCount = 0;
    let setblockCount = 0;

    for (let index = 0; index < commands.length; index += 1) {
      const command = commands[index];

      if (command.kind === "fill") {
        fillCount += 1;
        this.bot.chat(
          `/fill ${command.from.x} ${command.from.y} ${command.from.z} ${command.to.x} ${command.to.y} ${command.to.z} ${command.block}`,
        );
      } else {
        setblockCount += 1;
        const { placement } = command;
        const nbtSuffix = placement.nbt ? placement.nbt : "";
        this.bot.chat(`/setblock ${placement.x} ${placement.y} ${placement.z} ${placement.block}${nbtSuffix}`);
      }

      if ((index + 1) % 10 === 0) {
        await delay(100);
      }

      if (onProgress) {
        await onProgress((index + 1) / commands.length);
      }
    }

    return {
      commandCount: commands.length,
      fillCount,
      setblockCount,
    };
  }
}
