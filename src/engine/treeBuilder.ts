import * as THREE from 'three';

export interface TreePropSpec {
  /** World-space position in meters */
  x: number;
  y: number;
  z: number;
  kind: 'pine' | 'oak' | 'birch';
  scale: number;
  seed: number;
}

export interface FoliageCollection {
  root: THREE.Group;
  campfireFlames: THREE.Mesh[];
  dispose: () => void;
}

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/**
 * Builds procedural Valheim-style low-poly tapered Nordic pines, rounded broad-leaf oaks/birches,
 * mossy shoreline boulders, and warm village hearth campfires.
 */
export function buildNordicFoliageAndProps(
  trees: TreePropSpec[],
  options: {
    castShadow: boolean;
    includeVillageCampfire?: { x: number; y: number; z: number } | null;
    boulders?: Array<{ x: number; y: number; z: number; scale: number; seed: number }>;
  },
): FoliageCollection {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const campfireFlames: THREE.Mesh[] = [];

  // Shared muted Nordic materials (flatShading for crisp Valheim low-poly light catch)
  const pineBarkMat = new THREE.MeshStandardMaterial({
    color: '#43352A',
    roughness: 0.94,
    metalness: 0.02,
    flatShading: true,
  });
  const oakBarkMat = new THREE.MeshStandardMaterial({
    color: '#524336',
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
  });
  const birchBarkMat = new THREE.MeshStandardMaterial({
    color: '#B8B0A0',
    roughness: 0.88,
    metalness: 0.02,
    flatShading: true,
  });

  const pineNeedleMats = [
    new THREE.MeshStandardMaterial({ color: '#263826', roughness: 0.92, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#2F432C', roughness: 0.92, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#1F3021', roughness: 0.94, flatShading: true }),
  ];

  const oakCanopyMats = [
    new THREE.MeshStandardMaterial({ color: '#465836', roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#56643C', roughness: 0.9, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#3C4D31', roughness: 0.92, flatShading: true }),
  ];

  const birchCanopyMats = [
    new THREE.MeshStandardMaterial({ color: '#6E7842', roughness: 0.88, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#837C46', roughness: 0.88, flatShading: true }),
  ];

  const boulderMat = new THREE.MeshStandardMaterial({
    color: '#5B6063',
    roughness: 0.9,
    metalness: 0.04,
    flatShading: true,
  });
  const mossCapMat = new THREE.MeshStandardMaterial({
    color: '#465839',
    roughness: 0.95,
    flatShading: true,
  });

  materials.push(
    pineBarkMat,
    oakBarkMat,
    birchBarkMat,
    ...pineNeedleMats,
    ...oakCanopyMats,
    ...birchCanopyMats,
    boulderMat,
    mossCapMat,
  );

  // Shared base geometries
  const pineTrunkGeo = new THREE.CylinderGeometry(0.11, 0.28, 3.6, 6);
  const pineTier1Geo = new THREE.ConeGeometry(1.55, 2.05, 7);
  const pineTier2Geo = new THREE.ConeGeometry(1.26, 1.85, 7);
  const pineTier3Geo = new THREE.ConeGeometry(0.95, 1.65, 7);
  const pineTier4Geo = new THREE.ConeGeometry(0.62, 1.35, 6);

  const broadTrunkGeo = new THREE.CylinderGeometry(0.14, 0.3, 2.5, 6);
  const branchGeo = new THREE.CylinderGeometry(0.06, 0.12, 1.25, 5);
  const canopyBallGeo = new THREE.IcosahedronGeometry(1.0, 1);
  const boulderGeo = new THREE.DodecahedronGeometry(0.65, 0);

  geometries.push(
    pineTrunkGeo,
    pineTier1Geo,
    pineTier2Geo,
    pineTier3Geo,
    pineTier4Geo,
    broadTrunkGeo,
    branchGeo,
    canopyBallGeo,
    boulderGeo,
  );

  for (const spec of trees) {
    const rand = seededRand(spec.seed);
    const treeGroup = new THREE.Group();
    treeGroup.position.set(spec.x, spec.y - 0.1, spec.z);
    treeGroup.rotation.y = rand() * Math.PI * 2;
    const tiltX = (rand() - 0.5) * 0.06;
    const tiltZ = (rand() - 0.5) * 0.06;
    treeGroup.rotation.x = tiltX;
    treeGroup.rotation.z = tiltZ;
    treeGroup.scale.setScalar(spec.scale);

    if (spec.kind === 'pine') {
      const trunk = new THREE.Mesh(pineTrunkGeo, pineBarkMat);
      trunk.position.y = 1.75;
      trunk.castShadow = options.castShadow;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      const baseMat = pineNeedleMats[Math.floor(rand() * pineNeedleMats.length)];
      const tiers: Array<{ geo: THREE.BufferGeometry; y: number; rot: number }> = [
        { geo: pineTier1Geo, y: 2.35, rot: rand() * Math.PI },
        { geo: pineTier2Geo, y: 3.45, rot: rand() * Math.PI },
        { geo: pineTier3Geo, y: 4.45, rot: rand() * Math.PI },
        { geo: pineTier4Geo, y: 5.3, rot: rand() * Math.PI },
      ];
      for (const t of tiers) {
        const cone = new THREE.Mesh(t.geo, baseMat);
        cone.position.y = t.y;
        cone.rotation.y = t.rot;
        cone.scale.set(0.95 + rand() * 0.14, 1, 0.95 + rand() * 0.14);
        cone.castShadow = options.castShadow;
        cone.receiveShadow = true;
        treeGroup.add(cone);
      }
    } else {
      const isBirch = spec.kind === 'birch';
      const trunk = new THREE.Mesh(broadTrunkGeo, isBirch ? birchBarkMat : oakBarkMat);
      trunk.position.y = 1.2;
      trunk.castShadow = options.castShadow;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      // Two organic side limbs
      for (let b = 0; b < 2; b++) {
        const limb = new THREE.Mesh(branchGeo, isBirch ? birchBarkMat : oakBarkMat);
        const ang = b * Math.PI + rand() * 0.8;
        limb.position.set(Math.cos(ang) * 0.34, 2.15, Math.sin(ang) * 0.34);
        limb.rotation.z = Math.cos(ang) * -0.58;
        limb.rotation.x = Math.sin(ang) * 0.58;
        limb.castShadow = options.castShadow;
        treeGroup.add(limb);
      }

      // Clustered rounded low-poly canopy (not cubes!)
      const palette = isBirch ? birchCanopyMats : oakCanopyMats;
      const puffs: Array<[number, number, number, number, number]> = [
        [0, 3.05, 0, 1.32, 0.92],
        [0.72, 2.75, 0.35, 0.96, 0.8],
        [-0.68, 2.82, 0.25, 0.94, 0.82],
        [0.18, 2.72, -0.72, 0.92, 0.78],
        [-0.25, 3.55, -0.15, 0.84, 0.74],
      ];
      for (let i = 0; i < puffs.length; i++) {
        const [px, py, pz, r, sy] = puffs[i];
        const puff = new THREE.Mesh(canopyBallGeo, palette[(i + Math.floor(rand() * 2)) % palette.length]);
        puff.position.set(px + (rand() - 0.5) * 0.16, py + (rand() - 0.5) * 0.12, pz + (rand() - 0.5) * 0.16);
        puff.scale.set(r, r * sy, r * (0.92 + rand() * 0.16));
        puff.rotation.set(rand() * 0.8, rand() * Math.PI, rand() * 0.8);
        puff.castShadow = options.castShadow;
        puff.receiveShadow = true;
        treeGroup.add(puff);
      }
    }

    root.add(treeGroup);
  }

  // Grounded shoreline / valley mossy boulders
  if (options.boulders) {
    for (const b of options.boulders) {
      const rand = seededRand(b.seed);
      const rock = new THREE.Mesh(boulderGeo, boulderMat);
      rock.position.set(b.x, b.y + 0.18 * b.scale, b.z);
      rock.scale.set(b.scale * (1.0 + rand() * 0.45), b.scale * (0.65 + rand() * 0.25), b.scale * (0.9 + rand() * 0.4));
      rock.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
      rock.castShadow = options.castShadow;
      rock.receiveShadow = true;
      root.add(rock);

      const moss = new THREE.Mesh(boulderGeo, mossCapMat);
      moss.position.set(b.x, b.y + 0.32 * b.scale, b.z);
      moss.scale.set(b.scale * 0.82, b.scale * 0.34, b.scale * 0.78);
      moss.rotation.y = rock.rotation.y;
      moss.receiveShadow = true;
      root.add(moss);
    }
  }

  // Warm village hearth campfire beside the Awakening Shrine (glows warmly at night)
  if (options.includeVillageCampfire) {
    const { x, y, z } = options.includeVillageCampfire;
    const fireGroup = new THREE.Group();
    fireGroup.position.set(x, y, z);

    const ringStoneGeo = new THREE.DodecahedronGeometry(0.16, 0);
    const logGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.72, 5);
    const flameOuterGeo = new THREE.ConeGeometry(0.22, 0.56, 5);
    const flameCoreGeo = new THREE.ConeGeometry(0.12, 0.36, 5);
    geometries.push(ringStoneGeo, logGeo, flameOuterGeo, flameCoreGeo);

    const flameOuterMat = new THREE.MeshBasicMaterial({ color: '#F07D22' });
    const flameCoreMat = new THREE.MeshBasicMaterial({ color: '#FFE394' });
    materials.push(flameOuterMat, flameCoreMat);

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const st = new THREE.Mesh(ringStoneGeo, boulderMat);
      st.position.set(Math.cos(ang) * 0.45, 0.08, Math.sin(ang) * 0.45);
      st.scale.set(1.15, 0.75, 1.0);
      st.rotation.y = ang;
      fireGroup.add(st);
    }

    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(logGeo, pineBarkMat);
      log.position.y = 0.1;
      log.rotation.z = Math.PI / 2 - 0.22;
      log.rotation.y = (i / 3) * Math.PI;
      fireGroup.add(log);
    }

    const outerFlame = new THREE.Mesh(flameOuterGeo, flameOuterMat);
    outerFlame.position.y = 0.34;
    const coreFlame = new THREE.Mesh(flameCoreGeo, flameCoreMat);
    coreFlame.position.y = 0.28;
    fireGroup.add(outerFlame, coreFlame);
    campfireFlames.push(outerFlame, coreFlame);

    root.add(fireGroup);
  }

  return {
    root,
    campfireFlames,
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
