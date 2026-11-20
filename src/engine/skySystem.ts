import * as THREE from 'three';
import { TimeOfDayState, TimePhase } from '../types/blockhaven';

export type SkyBias = 'normal' | 'desert' | 'ice' | 'sky' | 'dark' | 'dungeon';

interface SkyPalette {
  zenith: THREE.Color;
  horizon: THREE.Color;
  fog: THREE.Color;
  sunLight: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  cloud: THREE.Color;
  cloudShadow: THREE.Color;
  ocean: THREE.Color;
  keyIntensity: number;
  hemiIntensity: number;
}

// Valheim-inspired moody Nordic atmosphere: low golden sun, slate skies, misty valleys, cool blue moonlit nights
const PALETTE_DAY: SkyPalette = {
  zenith: new THREE.Color('#394D5E'),
  horizon: new THREE.Color('#B5A68E'),
  fog: new THREE.Color('#A69D8B'),
  sunLight: new THREE.Color('#FFD296'),
  hemiSky: new THREE.Color('#9BB1C4'),
  hemiGround: new THREE.Color('#3F4639'),
  cloud: new THREE.Color('#CFC4B0'),
  cloudShadow: new THREE.Color('#515C66'),
  ocean: new THREE.Color('#1B303B'),
  keyIntensity: 2.05,
  hemiIntensity: 0.68,
};

const PALETTE_DAWN: SkyPalette = {
  zenith: new THREE.Color('#273548'),
  horizon: new THREE.Color('#C48A5A'),
  fog: new THREE.Color('#9D7C62'),
  sunLight: new THREE.Color('#FFB066'),
  hemiSky: new THREE.Color('#9C887C'),
  hemiGround: new THREE.Color('#3B362E'),
  cloud: new THREE.Color('#CFA178'),
  cloudShadow: new THREE.Color('#3D4452'),
  ocean: new THREE.Color('#1D2E3B'),
  keyIntensity: 1.5,
  hemiIntensity: 0.56,
};

const PALETTE_SUNSET: SkyPalette = {
  zenith: new THREE.Color('#212E42'),
  horizon: new THREE.Color('#BD6E46'),
  fog: new THREE.Color('#8E624D'),
  sunLight: new THREE.Color('#FF964F'),
  hemiSky: new THREE.Color('#926E62'),
  hemiGround: new THREE.Color('#362B26'),
  cloud: new THREE.Color('#C98962'),
  cloudShadow: new THREE.Color('#34394A'),
  ocean: new THREE.Color('#1A2736'),
  keyIntensity: 1.4,
  hemiIntensity: 0.52,
};

const PALETTE_NIGHT: SkyPalette = {
  zenith: new THREE.Color('#070F1C'),
  horizon: new THREE.Color('#13243A'),
  fog: new THREE.Color('#0F1D30'),
  sunLight: new THREE.Color('#6F96C2'),
  hemiSky: new THREE.Color('#2A466B'),
  hemiGround: new THREE.Color('#111821'),
  cloud: new THREE.Color('#1E324B'),
  cloudShadow: new THREE.Color('#0B1422'),
  ocean: new THREE.Color('#0B1624'),
  keyIntensity: 0.52,
  hemiIntensity: 0.34,
};

const FULL_DAY_DURATION_SEC = 180;
const ORBIT_RADIUS = 108;
const WORLD_CENTER_X = 16;
const WORLD_CENTER_Z = 16;

function createGlowDiscTexture(innerHex: string, midHex: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, innerHex);
  grad.addColorStop(0.32, midHex);
  grad.addColorStop(0.68, 'rgba(255, 200, 130, 0.14)');
  grad.addColorStop(1, 'rgba(255, 200, 130, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Dynamic Valheim-style Nordic skybox with dramatic layered procedural clouds,
 * low golden sun casting long shadows, moody horizon mist, and cool blue moonlit nights.
 */
export class SkySystem {
  private scene: THREE.Scene;
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private cloudMat: THREE.MeshStandardMaterial;
  private oceanMat: THREE.MeshStandardMaterial;

  private skyDome: THREE.Mesh;
  private skyUniforms: {
    uZenith: { value: THREE.Color };
    uHorizon: { value: THREE.Color };
    uCloudLight: { value: THREE.Color };
    uCloudDark: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uTime: { value: number };
    uNightFactor: { value: number };
    uOvercast: { value: number };
  };
  private sunSprite: THREE.Sprite;
  private moonSprite: THREE.Sprite;
  private starField: THREE.Points;
  private starMat: THREE.PointsMaterial;

  private tmpZenith = new THREE.Color();
  private tmpHorizon = new THREE.Color();
  private tmpFog = new THREE.Color();
  private tmpSunLight = new THREE.Color();
  private tmpHemiSky = new THREE.Color();
  private tmpHemiGround = new THREE.Color();
  private tmpCloud = new THREE.Color();
  private tmpCloudShadow = new THREE.Color();
  private tmpOcean = new THREE.Color();
  private sunDir = new THREE.Vector3(0.65, 0.35, -0.5);

  /** Start at low golden afternoon sun so long atmospheric shadows greet the player immediately */
  private cycle = 0.095;
  private elapsed = 0;
  private paused = false;
  private lastReportedPhase: TimePhase = 'Day';
  private bias: SkyBias = 'normal';
  private currentNightFactor = 0;

  constructor(
    scene: THREE.Scene,
    keyLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight,
    cloudMat: THREE.MeshStandardMaterial,
    oceanMat: THREE.MeshStandardMaterial,
  ) {
    this.scene = scene;
    this.keyLight = keyLight;
    this.hemiLight = hemiLight;
    this.cloudMat = cloudMat;
    this.oceanMat = oceanMat;

    // 1. Atmospheric Nordic Sky Dome with layered drifting clouds & sun halo
    this.skyUniforms = {
      uZenith: { value: PALETTE_DAY.zenith.clone() },
      uHorizon: { value: PALETTE_DAY.horizon.clone() },
      uCloudLight: { value: PALETTE_DAY.cloud.clone() },
      uCloudDark: { value: PALETTE_DAY.cloudShadow.clone() },
      uSunDir: { value: this.sunDir.clone() },
      uTime: { value: 0 },
      uNightFactor: { value: 0 },
      uOvercast: { value: 0.52 },
    };

    const skyGeo = new THREE.SphereGeometry(200, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uCloudLight;
        uniform vec3 uCloudDark;
        uniform vec3 uSunDir;
        uniform float uTime;
        uniform float uNightFactor;
        uniform float uOvercast;
        varying vec3 vWorldDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.06 + vec2(13.7, 9.2);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float elev = clamp(dir.y, 0.0, 1.0);
          float skyGrad = pow(elev, 0.52);
          vec3 col = mix(uHorizon, uZenith, skyGrad);

          // Low golden sun scattering glow along the moody horizon
          vec3 sDir = normalize(uSunDir);
          float sunDot = max(dot(dir, sDir), 0.0);
          float sunGlow = pow(sunDot, 7.0) * (1.0 - uNightFactor * 0.85) * 0.42;
          float horizonBand = exp(-abs(dir.y) * 6.5) * (1.0 - uNightFactor * 0.7) * 0.24;
          col += vec3(1.0, 0.76, 0.46) * (sunGlow + horizonBand * pow(sunDot, 2.0));

          // Dramatic layered Nordic clouds projected across the upper dome
          if (dir.y > 0.015) {
            vec2 cloudUv = dir.xz / (dir.y + 0.24);
            float n1 = fbm(cloudUv * 1.15 + vec2(uTime * 0.014, uTime * 0.006));
            float n2 = fbm(cloudUv * 2.45 - vec2(uTime * 0.022, -uTime * 0.011));
            float layer1 = smoothstep(0.42, 0.78, n1 * 0.72 + n2 * 0.34);
            float layer2 = smoothstep(0.54, 0.84, n2);

            // Fade clouds softly into horizon mist
            float horizonFade = smoothstep(0.02, 0.24, dir.y);
            float cloudAlpha = clamp((layer1 * 0.75 + layer2 * 0.35) * uOvercast * horizonFade, 0.0, 0.88);

            // Warm sunlit rim on cloud edges, moody slate underside
            float rim = clamp(pow(sunDot, 3.0) * 0.85 + (1.0 - layer1) * 0.25, 0.0, 1.0);
            vec3 cCol = mix(uCloudDark, uCloudLight, clamp(layer2 * 0.65 + rim * 0.55, 0.0, 1.0));
            cCol += vec3(0.95, 0.68, 0.38) * pow(sunDot, 5.0) * (1.0 - uNightFactor) * 0.35;

            col = mix(col, cCol, cloudAlpha);
          }

          // Dense moody valley mist belt right at the horizon
          float mistBelt = exp(-abs(dir.y) * 14.0) * 0.55;
          col = mix(col, uHorizon, mistBelt);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.skyDome.position.set(WORLD_CENTER_X, 0, WORLD_CENTER_Z);
    this.scene.add(this.skyDome);

    // 2. Low Golden Sun Disc Sprite
    const sunTex = createGlowDiscTexture('#FFF5DC', '#FFC878');
    const sunMat = new THREE.SpriteMaterial({
      map: sunTex,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.sunSprite = new THREE.Sprite(sunMat);
    this.sunSprite.scale.set(28, 28, 1);
    this.scene.add(this.sunSprite);

    // 3. Cool Pale Nordic Moon Sprite
    const moonTex = createGlowDiscTexture('#E2EEFA', '#8CB4DB');
    const moonMat = new THREE.SpriteMaterial({
      map: moonTex,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.moonSprite = new THREE.Sprite(moonMat);
    this.moonSprite.scale.set(17, 17, 1);
    this.scene.add(this.moonSprite);

    // 4. Crisp Nordic Night Starfield
    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.18 + Math.random() * 0.82);
      const r = 172;
      starPositions[i * 3] = WORLD_CENTER_X + r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = WORLD_CENTER_Z + r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMat = new THREE.PointsMaterial({
      color: '#CFE0F5',
      size: 1.5,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.starField = new THREE.Points(starGeo, this.starMat);
    this.scene.add(this.starField);

    this.applyAtmosphere();
  }

  public setRealmAtmosphere(bias: SkyBias): void {
    this.bias = bias;
    const isDungeon = bias === 'dungeon';
    this.skyDome.visible = !isDungeon;
    this.sunSprite.visible = !isDungeon && bias !== 'dark';
    this.moonSprite.visible = !isDungeon;
    this.starField.visible = !isDungeon;
    this.applyAtmosphere();
  }

  public getPhase(): TimePhase {
    if (this.bias === 'dungeon') return 'Night';
    if (this.cycle < 0.08 || this.cycle >= 0.94) return 'Dawn';
    if (this.cycle < 0.44) return 'Day';
    if (this.cycle < 0.56) return 'Sunset';
    return 'Night';
  }

  public isNighttime(): boolean {
    return this.bias === 'dark' || this.bias === 'dungeon' || this.getPhase() === 'Night';
  }

  public getNightFactor(): number {
    return this.bias === 'dungeon' ? 1 : this.bias === 'dark' ? 0.9 : this.currentNightFactor;
  }

  public getDaylightFactor(): number {
    return 1 - this.getNightFactor();
  }

  public getSunDirection(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.sunDir);
  }

  public getState(): TimeOfDayState {
    return {
      cycle: this.cycle,
      phase: this.getPhase(),
      paused: this.paused,
    };
  }

  public cyclePresetPhase(): TimeOfDayState {
    const phase = this.getPhase();
    if (phase === 'Day') this.cycle = 0.49;
    else if (phase === 'Sunset') this.cycle = 0.72;
    else if (phase === 'Night') this.cycle = 0.03;
    else this.cycle = 0.11;
    this.applyAtmosphere();
    this.lastReportedPhase = this.getPhase();
    return this.getState();
  }

  public togglePaused(): TimeOfDayState {
    this.paused = !this.paused;
    return this.getState();
  }

  public update(dt: number): TimeOfDayState | null {
    this.elapsed += dt;
    this.skyUniforms.uTime.value = this.elapsed;

    if (!this.paused && this.bias !== 'dungeon') {
      this.cycle = (this.cycle + dt / FULL_DAY_DURATION_SEC) % 1;
      this.applyAtmosphere();
    }

    const phase = this.getPhase();
    if (phase !== this.lastReportedPhase) {
      this.lastReportedPhase = phase;
      return this.getState();
    }
    return null;
  }

  private blendPalettes(a: SkyPalette, b: SkyPalette, t: number): void {
    const s = THREE.MathUtils.smoothstep(t, 0, 1);
    this.tmpZenith.lerpColors(a.zenith, b.zenith, s);
    this.tmpHorizon.lerpColors(a.horizon, b.horizon, s);
    this.tmpFog.lerpColors(a.fog, b.fog, s);
    this.tmpSunLight.lerpColors(a.sunLight, b.sunLight, s);
    this.tmpHemiSky.lerpColors(a.hemiSky, b.hemiSky, s);
    this.tmpHemiGround.lerpColors(a.hemiGround, b.hemiGround, s);
    this.tmpCloud.lerpColors(a.cloud, b.cloud, s);
    this.tmpCloudShadow.lerpColors(a.cloudShadow, b.cloudShadow, s);
    this.tmpOcean.lerpColors(a.ocean, b.ocean, s);
    this.keyLight.intensity = THREE.MathUtils.lerp(a.keyIntensity, b.keyIntensity, s);
    this.hemiLight.intensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, s);
  }

  private applyAtmosphere(): void {
    if (this.bias === 'dungeon') {
      this.scene.background = new THREE.Color('#090C12');
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.set('#090C12');
        this.scene.fog.density = 0.044;
      }
      this.keyLight.intensity = 0.2;
      this.keyLight.color.set('#7A88A8');
      this.hemiLight.intensity = 0.28;
      this.hemiLight.color.set('#3A455A');
      this.hemiLight.groundColor.set('#14171D');
      this.currentNightFactor = 1;
      return;
    }

    const c = this.cycle;
    let nightFactor = 0;

    if (c < 0.08) {
      this.blendPalettes(PALETTE_DAWN, PALETTE_DAY, c / 0.08);
      nightFactor = (1 - c / 0.08) * 0.22;
    } else if (c < 0.42) {
      this.blendPalettes(PALETTE_DAY, PALETTE_DAY, 0);
      nightFactor = 0;
    } else if (c < 0.52) {
      this.blendPalettes(PALETTE_DAY, PALETTE_SUNSET, (c - 0.42) / 0.1);
      nightFactor = ((c - 0.42) / 0.1) * 0.25;
    } else if (c < 0.62) {
      const t = (c - 0.52) / 0.1;
      this.blendPalettes(PALETTE_SUNSET, PALETTE_NIGHT, t);
      nightFactor = 0.25 + t * 0.75;
    } else if (c < 0.90) {
      this.blendPalettes(PALETTE_NIGHT, PALETTE_NIGHT, 0);
      nightFactor = 1;
    } else {
      const t = (c - 0.9) / 0.1;
      this.blendPalettes(PALETTE_NIGHT, PALETTE_DAWN, t);
      nightFactor = 1 - t * 0.78;
    }

    this.currentNightFactor = nightFactor;

    // Realm-specific muted tints (preserving Valheim mood)
    let fogDensity = THREE.MathUtils.lerp(0.0175, 0.0235, nightFactor);
    this.skyUniforms.uOvercast.value = 0.58;

    if (this.bias === 'desert') {
      this.tmpHorizon.lerp(new THREE.Color('#B89668'), 0.45);
      this.tmpFog.lerp(new THREE.Color('#A88B64'), 0.45);
      this.tmpSunLight.lerp(new THREE.Color('#FFD299'), 0.35);
      this.skyUniforms.uOvercast.value = 0.35;
    } else if (this.bias === 'ice') {
      this.tmpZenith.lerp(new THREE.Color('#475F75'), 0.45);
      this.tmpHorizon.lerp(new THREE.Color('#9AAEB8'), 0.48);
      this.tmpFog.lerp(new THREE.Color('#91A5B0'), 0.5);
      fogDensity = 0.021;
      this.skyUniforms.uOvercast.value = 0.72;
    } else if (this.bias === 'sky') {
      this.tmpZenith.lerp(new THREE.Color('#3C5070'), 0.4);
      this.tmpHorizon.lerp(new THREE.Color('#9E9DB0'), 0.4);
      fogDensity = 0.012;
    } else if (this.bias === 'dark') {
      this.tmpZenith.lerp(new THREE.Color('#130A18'), 0.82);
      this.tmpHorizon.lerp(new THREE.Color('#321524'), 0.78);
      this.tmpFog.lerp(new THREE.Color('#1A0D1A'), 0.85);
      this.tmpSunLight.set('#B46A7A');
      this.keyLight.intensity *= 0.55;
      fogDensity = 0.026;
      nightFactor = Math.max(nightFactor, 0.82);
    }

    // Low Nordic sun arc (keeps sun lower on the horizon for long Valheim shadows!)
    const sunAngle = c * Math.PI * 2;
    const sunX = Math.cos(sunAngle) * ORBIT_RADIUS;
    const sunY = Math.sin(sunAngle) * (ORBIT_RADIUS * 0.46) + 8; // Low golden elevation!
    const sunZ = -ORBIT_RADIUS * 0.42;

    this.sunSprite.position.set(WORLD_CENTER_X + sunX, sunY, WORLD_CENTER_Z + sunZ);
    this.moonSprite.position.set(WORLD_CENTER_X - sunX, -sunY + 18, WORLD_CENTER_Z - sunZ);

    this.sunSprite.material.opacity = THREE.MathUtils.clamp((sunY + 14) / 28, 0, 1);
    this.moonSprite.material.opacity = THREE.MathUtils.clamp((-sunY + 26) / 28, 0, 1);

    // Direction toward the active celestial body (sun during day, moon at night)
    if (sunY >= 2) {
      this.sunDir.set(sunX, Math.max(16, sunY), sunZ).normalize();
      this.keyLight.position.set(
        WORLD_CENTER_X + this.sunDir.x * 58,
        Math.max(18, this.sunDir.y * 58),
        WORLD_CENTER_Z + this.sunDir.z * 58,
      );
    } else {
      this.sunDir.set(-sunX, Math.max(18, -sunY + 18), -sunZ).normalize();
      this.keyLight.position.set(
        WORLD_CENTER_X + this.sunDir.x * 52,
        Math.max(18, this.sunDir.y * 52),
        WORLD_CENTER_Z + this.sunDir.z * 52,
      );
    }

    this.skyUniforms.uZenith.value.copy(this.tmpZenith);
    this.skyUniforms.uHorizon.value.copy(this.tmpHorizon);
    this.skyUniforms.uCloudLight.value.copy(this.tmpCloud);
    this.skyUniforms.uCloudDark.value.copy(this.tmpCloudShadow);
    this.skyUniforms.uSunDir.value.copy(this.sunDir);
    this.skyUniforms.uNightFactor.value = nightFactor;

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.tmpFog);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.tmpFog);
      this.scene.fog.density = fogDensity;
    }

    this.keyLight.color.copy(this.tmpSunLight);
    this.hemiLight.color.copy(this.tmpHemiSky);
    this.hemiLight.groundColor.copy(this.tmpHemiGround);
    this.cloudMat.color.copy(this.tmpCloud);
    this.oceanMat.color.copy(this.tmpOcean);
    this.starMat.opacity = nightFactor * 0.88;
  }

  public dispose(): void {
    this.scene.remove(this.skyDome, this.sunSprite, this.moonSprite, this.starField);
    this.skyDome.geometry.dispose();
    (this.skyDome.material as THREE.Material).dispose();
    (this.sunSprite.material as THREE.SpriteMaterial).map?.dispose();
    this.sunSprite.material.dispose();
    (this.moonSprite.material as THREE.SpriteMaterial).map?.dispose();
    this.moonSprite.material.dispose();
    this.starField.geometry.dispose();
    this.starMat.dispose();
  }
}
