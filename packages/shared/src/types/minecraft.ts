export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  min: Vec3Like;
  max: Vec3Like;
}

export interface BlockPlacement {
  x: number;
  y: number;
  z: number;
  block: string;
}

export interface FillPlacement {
  from: Vec3Like;
  to: Vec3Like;
  block: string;
}

export interface CommandPlacement {
  command: string;
  reason?: string;
}

export interface RouteCheckpoint {
  id: string;
  position: Vec3Like;
}
