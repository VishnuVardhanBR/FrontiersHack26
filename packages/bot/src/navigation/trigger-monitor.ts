import { Vec3 } from "vec3";

export class TriggerMonitor {
  isWithinRadius(position: Vec3, target: Vec3, radius: number): boolean {
    return position.distanceTo(target) <= radius;
  }
}
