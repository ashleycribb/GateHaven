import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';

import { ENGINE } from '../../shared/engine';
import type { BaseState, CrateState, PlayerState, SocketState } from '../../shared/schema';
import type { PlayerController } from '../entities/PlayerController';
import type { BattleIslandConnection } from '../net/client';

const TEAM_PALETTE: readonly Color3[] = [
  new Color3(0.88, 0.43, 0.24), // team_0: Warm Ember Coral
  new Color3(0.22, 0.56, 0.84), // team_1: Coastal Azure
  new Color3(0.32, 0.72, 0.44), // team_2: Moss Emerald
  new Color3(0.78, 0.62, 0.20), // team_3: Sun Gold
  new Color3(0.64, 0.36, 0.78), // team_4: Reef Violet
];

function teamColor(teamId: string): Color3 {
  const idx = Number(teamId.replace('team_', ''));
  if (Number.isInteger(idx) && idx >= 0 && idx < TEAM_PALETTE.length) {
    return TEAM_PALETTE[idx];
  }
  return TEAM_PALETTE[0];
}

interface UnitVisual {
  root: TransformNode;
  body: Mesh;
  head: Mesh;
  shieldDome: Mesh;
  helperRing?: Mesh;
  teamId: string;
}

interface BaseVisual {
  root: TransformNode;
  coreMesh: Mesh;
  sockets: Map<string, { pad: Mesh; builtMesh: Mesh | null; lastTier: number }>;
}

export class IslandScene {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: FreeCamera;
  private readonly connection: BattleIslandConnection;
  private readonly controller: PlayerController;

  private readonly unitVisuals = new Map<string, UnitVisual>();
  private readonly baseVisuals = new Map<string, BaseVisual>();
  private readonly crateVisuals = new Map<string, Mesh>();
  private readonly trapVisuals = new Map<string, Mesh>();

  private islandBuiltRadius = 0;
  private islandBuiltTeams = 0;
  private readonly islandNodes: TransformNode[] = [];

  private readonly teamMaterials = new Map<string, StandardMaterial>();
  private readonly crateMaterials = new Map<number, StandardMaterial>();
  private readonly shieldMat: StandardMaterial;
  private readonly trapMat: StandardMaterial;
  private readonly socketEmptyMat: StandardMaterial;

  private lastFrameMs = performance.now();
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    connection: BattleIslandConnection,
    controller: PlayerController,
  ) {
    this.connection = connection;
    this.controller = controller;

    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.47, 0.72, 0.88, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.0042;
    this.scene.fogColor = new Color3(0.56, 0.77, 0.88);

    // Sunlit coastal lighting
    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, 0.1), this.scene);
    hemi.intensity = 0.85;
    hemi.diffuse = new Color3(1.0, 0.96, 0.88);
    hemi.groundColor = new Color3(0.28, 0.36, 0.32);

    const sun = new DirectionalLight('sun', new Vector3(-0.45, -0.82, -0.36), this.scene);
    sun.intensity = 1.05;
    sun.diffuse = new Color3(1.0, 0.92, 0.76);

    // Third-person follow camera
    this.camera = new FreeCamera('thirdPersonCam', new Vector3(0, 14, -20), this.scene);
    this.camera.minZ = 0.3;
    this.camera.maxZ = 450;

    // Shared dynamic materials
    this.shieldMat = new StandardMaterial('shieldMat', this.scene);
    this.shieldMat.diffuseColor = new Color3(0.35, 0.82, 0.96);
    this.shieldMat.emissiveColor = new Color3(0.12, 0.35, 0.45);
    this.shieldMat.alpha = 0.36;

    this.trapMat = new StandardMaterial('trapMat', this.scene);
    this.trapMat.diffuseColor = new Color3(0.92, 0.34, 0.22);
    this.trapMat.emissiveColor = new Color3(0.35, 0.08, 0.04);

    this.socketEmptyMat = new StandardMaterial('socketEmptyMat', this.scene);
    this.socketEmptyMat.diffuseColor = new Color3(0.76, 0.70, 0.58);
    this.socketEmptyMat.emissiveColor = new Color3(0.14, 0.12, 0.08);

    this.initCrateMaterials();

    window.addEventListener('resize', this.onResize);
    this.engine.runRenderLoop(this.renderFrame);
  }

  private initCrateMaterials(): void {
    const specs: Array<[number, Color3, Color3]> = [
      [1, new Color3(0.62, 0.45, 0.28), new Color3(0.08, 0.05, 0.02)],
      [2, new Color3(0.24, 0.68, 0.52), new Color3(0.05, 0.18, 0.12)],
      [3, new Color3(0.95, 0.76, 0.24), new Color3(0.32, 0.22, 0.04)],
    ];
    for (const [tier, diffuse, emissive] of specs) {
      const mat = new StandardMaterial(`crateMat_${tier}`, this.scene);
      mat.diffuseColor = diffuse;
      mat.emissiveColor = emissive;
      this.crateMaterials.set(tier, mat);
    }
  }

  private getTeamMaterial(teamId: string): StandardMaterial {
    let mat = this.teamMaterials.get(teamId);
    if (!mat) {
      mat = new StandardMaterial(`teamMat_${teamId}`, this.scene);
      const c = teamColor(teamId);
      mat.diffuseColor = c;
      mat.emissiveColor = c.scale(0.18);
      this.teamMaterials.set(teamId, mat);
    }
    return mat;
  }

  private buildIslandEnvironment(radius: number, centerRadius: number, teamCount: number): void {
    for (const node of this.islandNodes) {
      node.dispose();
    }
    this.islandNodes.length = 0;

    const root = new TransformNode('islandEnv', this.scene);
    this.islandNodes.push(root);

    // 1. Ocean water plane
    const ocean = CreateDisc('ocean', { radius: radius * 4.5, tessellation: 64 }, this.scene);
    ocean.rotation.x = Math.PI / 2;
    ocean.position.y = -1.2;
    const oceanMat = new StandardMaterial('oceanMat', this.scene);
    oceanMat.diffuseColor = new Color3(0.12, 0.48, 0.64);
    oceanMat.specularColor = new Color3(0.35, 0.45, 0.50);
    ocean.material = oceanMat;
    ocean.parent = root;

    // 2. Sandy coastal shoreline rim
    const sand = CreateCylinder(
      'islandSand',
      { diameter: radius * 2.08, height: 1.6, tessellation: 64 },
      this.scene,
    );
    sand.position.y = -0.95;
    const sandMat = new StandardMaterial('sandMat', this.scene);
    sandMat.diffuseColor = new Color3(0.84, 0.76, 0.56);
    sand.material = sandMat;
    sand.parent = root;

    // 3. Grass radial island plateau
    const grass = CreateCylinder(
      'islandGrass',
      { diameter: radius * 1.94, height: 1.2, tessellation: 64 },
      this.scene,
    );
    grass.position.y = -0.6;
    const grassMat = new StandardMaterial('grassMat', this.scene);
    grassMat.diffuseColor = new Color3(0.33, 0.56, 0.31);
    grassMat.specularColor = new Color3(0.06, 0.08, 0.06);
    grass.material = grassMat;
    grass.parent = root;

    // 4. Center high-loot golden stone arena disc
    const centerDisc = CreateCylinder(
      'centerArena',
      { diameter: centerRadius * 2, height: 0.35, tessellation: 48 },
      this.scene,
    );
    centerDisc.position.y = 0.05;
    const centerMat = new StandardMaterial('centerArenaMat', this.scene);
    centerMat.diffuseColor = new Color3(0.76, 0.68, 0.48);
    centerMat.emissiveColor = new Color3(0.10, 0.08, 0.03);
    centerDisc.material = centerMat;
    centerDisc.parent = root;

    const centerRing = CreateTorus(
      'centerRing',
      { diameter: centerRadius * 1.95, thickness: 0.45, tessellation: 48 },
      this.scene,
    );
    centerRing.position.y = 0.22;
    const ringMat = new StandardMaterial('centerRingMat', this.scene);
    ringMat.diffuseColor = new Color3(0.88, 0.72, 0.30);
    ringMat.emissiveColor = new Color3(0.22, 0.16, 0.04);
    centerRing.material = ringMat;
    centerRing.parent = root;

    // 5. Radial pathways connecting each base angle to center + scenic perimeter pines
    const pathMat = new StandardMaterial('pathMat', this.scene);
    pathMat.diffuseColor = new Color3(0.68, 0.63, 0.52);

    const trunkMat = new StandardMaterial('trunkMat', this.scene);
    trunkMat.diffuseColor = new Color3(0.42, 0.30, 0.20);
    const canopyMat = new StandardMaterial('canopyMat', this.scene);
    canopyMat.diffuseColor = new Color3(0.20, 0.44, 0.24);

    for (let i = 0; i < teamCount; i++) {
      const angle = (2 * Math.PI * i) / teamCount;
      const laneLen = radius * 0.72;
      const lane = CreateBox(`lane_${i}`, { width: 4.5, height: 0.08, depth: laneLen }, this.scene);
      lane.position.x = Math.cos(angle) * (laneLen * 0.5);
      lane.position.z = Math.sin(angle) * (laneLen * 0.5);
      lane.position.y = 0.02;
      lane.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle));
      lane.material = pathMat;
      lane.parent = root;
    }

    // Perimeter low-poly trees placed outside gameplay radius near shoreline
    const treeCount = 16;
    for (let i = 0; i < treeCount; i++) {
      const angle = (2 * Math.PI * i) / treeCount + 0.19;
      const r = radius * 0.90;
      const tx = Math.cos(angle) * r;
      const tz = Math.sin(angle) * r;

      const trunk = CreateCylinder(
        `treeTrunk_${i}`,
        { diameterTop: 0.45, diameterBottom: 0.7, height: 2.6, tessellation: 8 },
        this.scene,
      );
      trunk.position.set(tx, 1.3, tz);
      trunk.material = trunkMat;
      trunk.parent = root;

      const foliage = CreateCylinder(
        `treeCone_${i}`,
        { diameterTop: 0.2, diameterBottom: 3.6, height: 5.2, tessellation: 8 },
        this.scene,
      );
      foliage.position.set(tx, 4.4, tz);
      foliage.material = canopyMat;
      foliage.parent = root;
    }

    this.islandBuiltRadius = radius;
    this.islandBuiltTeams = teamCount;
  }

  private syncBases(): void {
    const bases = this.connection.room.state.bases;
    if (!bases) return;

    for (const [teamId, base] of bases.entries()) {
      let vis = this.baseVisuals.get(teamId);
      if (!vis) {
        vis = this.createBaseVisual(base);
        this.baseVisuals.set(teamId, vis);
      }

      // Scale core pillar vertically with remaining HP
      const hpRatio = Math.max(0.15, base.coreHp / ENGINE.baseCoreMaxHp);
      vis.coreMesh.scaling.y = hpRatio * (1 + (base.tier - 1) * 0.22);

      // Update sockets
      for (const [sockId, sock] of base.sockets.entries()) {
        const entry = vis.sockets.get(sockId);
        if (!entry) continue;
        if (sock.tier !== entry.lastTier) {
          entry.lastTier = sock.tier;
          if (entry.builtMesh) {
            entry.builtMesh.dispose();
            entry.builtMesh = null;
          }
          if (sock.occupied && sock.tier > 0) {
            entry.builtMesh = this.createBuiltStructureMesh(teamId, sock);
            entry.builtMesh.parent = vis.root;
          }
        }
      }
    }
  }

  private createBaseVisual(base: BaseState): BaseVisual {
    const root = new TransformNode(`base_${base.teamId}`, this.scene);
    const mat = this.getTeamMaterial(base.teamId);

    const pad = CreateCylinder(
      `basePad_${base.teamId}`,
      { diameter: 14, height: 0.3, tessellation: 24 },
      this.scene,
    );
    pad.position.set(base.x, 0.12, base.z);
    pad.material = mat;
    pad.parent = root;

    const coreMesh = CreateCylinder(
      `baseCore_${base.teamId}`,
      { diameterTop: 2.2, diameterBottom: 3.4, height: 5.5, tessellation: 8 },
      this.scene,
    );
    coreMesh.position.set(base.x, 2.75, base.z);
    coreMesh.material = mat;
    coreMesh.parent = root;

    const sockets = new Map<string, { pad: Mesh; builtMesh: Mesh | null; lastTier: number }>();
    for (const [sockId, sock] of base.sockets.entries()) {
      const sockPad = CreateCylinder(
        `sockPad_${sockId}`,
        { diameter: 2.6, height: 0.16, tessellation: 12 },
        this.scene,
      );
      sockPad.position.set(sock.x, 0.08, sock.z);
      sockPad.material = this.socketEmptyMat;
      sockPad.parent = root;
      sockets.set(sockId, { pad: sockPad, builtMesh: null, lastTier: 0 });
    }

    return { root, coreMesh, sockets };
  }

  private createBuiltStructureMesh(teamId: string, sock: SocketState): Mesh {
    const mat = this.getTeamMaterial(teamId);
    const heightScale = 1 + (sock.tier - 1) * 0.35;
    let mesh: Mesh;

    if (sock.type === 'wall') {
      mesh = CreateBox(
        `built_${sock.id}`,
        { width: 3.8, height: 2.2 * heightScale, depth: 0.9 },
        this.scene,
      );
      mesh.position.set(sock.x, 1.1 * heightScale, sock.z);
      mesh.rotation.y = Math.atan2(-sock.x, -sock.z);
    } else if (sock.type === 'tower') {
      mesh = CreateCylinder(
        `built_${sock.id}`,
        { diameterTop: 1.4, diameterBottom: 2.1, height: 3.8 * heightScale, tessellation: 8 },
        this.scene,
      );
      mesh.position.set(sock.x, 1.9 * heightScale, sock.z);
    } else if (sock.type === 'trap_pad') {
      mesh = CreateCylinder(
        `built_${sock.id}`,
        { diameter: 2.8, height: 0.45 * heightScale, tessellation: 16 },
        this.scene,
      );
      mesh.position.set(sock.x, 0.25, sock.z);
    } else {
      mesh = CreateTorus(
        `built_${sock.id}`,
        { diameter: 4.5 + sock.tier * 0.6, thickness: 0.45, tessellation: 24 },
        this.scene,
      );
      mesh.position.set(sock.x, 3.2 + sock.tier * 0.5, sock.z);
    }

    mesh.material = mat;
    return mesh;
  }

  private syncCrates(nowSec: number): void {
    const crates = this.connection.room.state.crates;
    if (!crates) return;

    const activeIds = new Set<string>();
    for (const [id, crate] of crates.entries()) {
      activeIds.add(id);
      let mesh = this.crateVisuals.get(id);
      if (!mesh) {
        mesh = this.createCrateMesh(crate);
        this.crateVisuals.set(id, mesh);
      }

      if (crate.opened) {
        mesh.isVisible = false;
      } else {
        mesh.isVisible = true;
        mesh.position.x = crate.x;
        mesh.position.z = crate.z;
        mesh.position.y = 0.72 + Math.sin(nowSec * 2.2 + crate.x) * 0.14;
        mesh.rotation.y = nowSec * 0.9 + crate.z * 0.1;
      }
    }

    for (const [id, mesh] of this.crateVisuals.entries()) {
      if (!activeIds.has(id)) {
        mesh.dispose();
        this.crateVisuals.delete(id);
      }
    }
  }

  private createCrateMesh(crate: CrateState): Mesh {
    const size = crate.tier === 3 ? 1.45 : crate.tier === 2 ? 1.2 : 1.05;
    const mesh = CreateBox(`crate_${crate.id}`, { size }, this.scene);
    mesh.position.set(crate.x, 0.72, crate.z);
    mesh.material = this.crateMaterials.get(crate.tier) ?? this.crateMaterials.get(1)!;
    return mesh;
  }

  private syncTraps(): void {
    const traps = this.connection.room.state.traps;
    if (!traps) return;

    const activeIds = new Set<string>();
    for (const [id, trap] of traps.entries()) {
      if (trap.triggered) continue;
      activeIds.add(id);
      let mesh = this.trapVisuals.get(id);
      if (!mesh) {
        mesh = CreateCylinder(`trap_${id}`, { diameter: 1.5, height: 0.18, tessellation: 16 }, this.scene);
        mesh.material = this.trapMat;
        this.trapVisuals.set(id, mesh);
      }
      mesh.position.set(trap.x, 0.1, trap.z);
    }

    for (const [id, mesh] of this.trapVisuals.entries()) {
      if (!activeIds.has(id)) {
        mesh.dispose();
        this.trapVisuals.delete(id);
      }
    }
  }

  private syncPlayers(): void {
    const players = this.connection.room.state.players;
    if (!players) return;

    const mySessionId = this.connection.room.sessionId;
    const activeIds = new Set<string>();

    for (const [id, entity] of players.entries()) {
      activeIds.add(id);
      let vis = this.unitVisuals.get(id);
      if (!vis) {
        vis = this.createUnitVisual(entity);
        this.unitVisuals.set(id, vis);
      } else if (vis.teamId !== entity.teamId) {
        const mat = this.getTeamMaterial(entity.teamId);
        vis.body.material = mat;
        vis.teamId = entity.teamId;
      }

      const isSelf = id === mySessionId;
      const pose = isSelf
        ? this.connection.getLocalPose() ?? { x: entity.x, y: entity.y, z: entity.z, rotY: entity.rotY }
        : this.connection.getRemotePose(entity);

      vis.root.setEnabled(entity.alive);
      vis.root.position.set(pose.x, pose.y, pose.z);
      vis.root.rotation.y = pose.rotY;
      vis.shieldDome.isVisible = entity.alive && entity.shieldHp > 0;
    }

    for (const [id, vis] of this.unitVisuals.entries()) {
      if (!activeIds.has(id)) {
        vis.root.dispose();
        this.unitVisuals.delete(id);
      }
    }
  }

  private createUnitVisual(entity: PlayerState): UnitVisual {
    const root = new TransformNode(`unit_${entity.id}`, this.scene);
    const mat = this.getTeamMaterial(entity.teamId);

    const body = CreateCapsule(
      `unitBody_${entity.id}`,
      { radius: 0.46, height: 1.5 },
      this.scene,
    );
    body.position.y = 0.8;
    body.material = mat;
    body.parent = root;

    const head = CreateSphere(`unitHead_${entity.id}`, { diameter: 0.62 }, this.scene);
    head.position.y = 1.82;
    const headMat = new StandardMaterial(`headMat_${entity.id}`, this.scene);
    headMat.diffuseColor = entity.isBot ? new Color3(0.86, 0.84, 0.78) : new Color3(0.95, 0.84, 0.72);
    head.material = headMat;
    head.parent = root;

    // Facing visor indicator so players immediately read facing direction
    const visor = CreateBox(`unitVisor_${entity.id}`, { width: 0.42, height: 0.16, depth: 0.18 }, this.scene);
    visor.position.set(0, 1.84, 0.28);
    const visorMat = new StandardMaterial(`visorMat_${entity.id}`, this.scene);
    visorMat.diffuseColor = new Color3(0.14, 0.18, 0.24);
    visor.material = visorMat;
    visor.parent = root;

    const shieldDome = CreateSphere(`unitShield_${entity.id}`, { diameter: 2.4 }, this.scene);
    shieldDome.position.y = 1.05;
    shieldDome.material = this.shieldMat;
    shieldDome.isVisible = false;
    shieldDome.parent = root;

    let helperRing: Mesh | undefined;
    if (entity.id.startsWith('helper_')) {
      helperRing = CreateTorus(
        `helperRing_${entity.id}`,
        { diameter: 1.0, thickness: 0.12, tessellation: 16 },
        this.scene,
      );
      helperRing.position.y = 2.35;
      helperRing.material = this.crateMaterials.get(3)!;
      helperRing.parent = root;
    }

    return {
      root,
      body,
      head,
      shieldDome,
      helperRing,
      teamId: entity.teamId,
    };
  }

  private updateThirdPersonCamera(): void {
    const pose = this.connection.getLocalPose();
    if (!pose) return;

    const yaw = this.controller.cameraYaw;
    const pitch = this.controller.cameraPitch;
    const dist = 12.5;
    const horizDist = Math.cos(pitch) * dist;
    const camX = pose.x - Math.sin(yaw) * horizDist;
    const camZ = pose.z - Math.cos(yaw) * horizDist;
    const camY = pose.y + 2.2 + Math.sin(pitch) * dist;

    this.camera.position.set(camX, camY, camZ);
    this.camera.setTarget(new Vector3(pose.x, pose.y + 1.4, pose.z));
  }

  private renderFrame = (): void => {
    if (this.disposed) return;

    const nowMs = performance.now();
    const dtSec = Math.min(0.05, Math.max(0.001, (nowMs - this.lastFrameMs) / 1000));
    this.lastFrameMs = nowMs;

    // 1. Poll local input device -> room.input
    this.controller.update(nowMs, dtSec);

    // 2. Step Colyseus Predict interpolation & local reconciliation
    this.connection.predict.tick(nowMs);

    // 3. Build static radial island once config is hydrated
    const cfg = this.connection.room.state.islandConfig;
    if (
      cfg &&
      cfg.radius > 0 &&
      (cfg.radius !== this.islandBuiltRadius || cfg.teamCount !== this.islandBuiltTeams)
    ) {
      this.buildIslandEnvironment(cfg.radius, cfg.centerRadius, cfg.teamCount);
    }

    // 4. Sync pure visual meshes from authoritative + predicted state
    this.syncBases();
    this.syncCrates(nowMs / 1000);
    this.syncTraps();
    this.syncPlayers();
    this.updateThirdPersonCamera();

    this.scene.render();
  };

  private onResize = (): void => {
    this.engine.resize();
  };

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    this.engine.stopRenderLoop(this.renderFrame);
    this.scene.dispose();
    this.engine.dispose();
  }
}
