declare module "d3-force-3d" {
  export interface SimulationNodeDatum {
    index?: number;
    x: number;
    y: number;
    z: number;
    vx?: number;
    vy?: number;
    vz?: number;
  }

  export interface SimulationLinkDatum<TNode extends SimulationNodeDatum> {
    source: string | TNode;
    target: string | TNode;
  }

  export interface Simulation {
    force(name: string, force?: unknown): this;
    tick(iterations?: number): this;
    stop(): this;
  }

  export interface ForceLink<TNode extends SimulationNodeDatum, TLink extends SimulationLinkDatum<TNode>> {
    id(accessor: (node: TNode) => string): this;
    distance(distance: number | ((link: TLink) => number)): this;
    strength(strength: number | ((link: TLink) => number)): this;
  }

  export interface ForceManyBody<TNode extends SimulationNodeDatum> {
    strength(strength: number | ((node: TNode) => number)): this;
  }

  export interface ForceCollide<TNode extends SimulationNodeDatum> {
    radius(radius: number | ((node: TNode) => number)): this;
    strength(strength: number): this;
  }

  export interface AxisForce {
    strength(strength: number): this;
  }

  export function forceSimulation<TNode extends SimulationNodeDatum>(
    nodes: TNode[],
    numDimensions?: number,
  ): Simulation;

  export function forceLink<TNode extends SimulationNodeDatum, TLink extends SimulationLinkDatum<TNode>>(
    links: TLink[],
  ): ForceLink<TNode, TLink>;

  export function forceManyBody<TNode extends SimulationNodeDatum>(): ForceManyBody<TNode>;
  export function forceCollide<TNode extends SimulationNodeDatum>(): ForceCollide<TNode>;
  export function forceCenter(x?: number, y?: number, z?: number): unknown;
  export function forceX<TNode extends SimulationNodeDatum>(
    x?: number | ((node: TNode) => number),
  ): AxisForce;
  export function forceY<TNode extends SimulationNodeDatum>(
    y?: number | ((node: TNode) => number),
  ): AxisForce;
  export function forceZ<TNode extends SimulationNodeDatum>(
    z?: number | ((node: TNode) => number),
  ): AxisForce;
}
