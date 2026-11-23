import { schema, t } from '@colyseus/schema';
import { ENGINE } from './engine';

export const OwnedItemSchema = schema(
  {
    itemId: t.string().default(''),
    level: t.uint8().default(1),
    modifiers: t.array('string'),
  },
  'OwnedItemSchema',
);
export type OwnedItemState = InstanceType<typeof OwnedItemSchema>;

export const PlayerSchema = schema(
  {
    id: t.string().default(''),
    teamId: t.string().default('team_0'),
    isBot: t.boolean().default(false),
    x: t.float32().default(0),
    y: t.float32().default(0),
    z: t.float32().default(0),
    rotY: t.float32().default(0),
    hp: t.float32().default(ENGINE.playerMaxHp),
    maxHp: t.float32().default(ENGINE.playerMaxHp),
    shieldHp: t.float32().default(0),
    alive: t.boolean().default(true),
    activeWeaponIndex: t.uint8().default(0),
    weaponSlots: t.array(OwnedItemSchema),
    skillSlots: t.array(OwnedItemSchema),
    trapSlots: t.array(OwnedItemSchema),
  },
  'PlayerSchema',
);
export type PlayerState = InstanceType<typeof PlayerSchema>;

export const SocketSchema = schema(
  {
    id: t.string().default(''),
    type: t.string().default('wall'),
    tier: t.uint8().default(0),
    occupied: t.boolean().default(false),
    x: t.float32().default(0),
    z: t.float32().default(0),
  },
  'SocketSchema',
);
export type SocketState = InstanceType<typeof SocketSchema>;

export const BaseSchema = schema(
  {
    teamId: t.string().default('team_0'),
    x: t.float32().default(0),
    z: t.float32().default(0),
    tier: t.uint8().default(1),
    coreHp: t.float32().default(ENGINE.baseCoreMaxHp),
    points: t.int32().default(0),
    sockets: t.map(SocketSchema),
  },
  'BaseSchema',
);
export type BaseState = InstanceType<typeof BaseSchema>;

export const CrateSchema = schema(
  {
    id: t.string().default(''),
    x: t.float32().default(0),
    z: t.float32().default(0),
    tier: t.uint8().default(1),
    opened: t.boolean().default(false),
  },
  'CrateSchema',
);
export type CrateState = InstanceType<typeof CrateSchema>;

export const TrapSchema = schema(
  {
    id: t.string().default(''),
    ownerId: t.string().default(''),
    teamId: t.string().default(''),
    itemId: t.string().default(''),
    x: t.float32().default(0),
    z: t.float32().default(0),
    triggered: t.boolean().default(false),
  },
  'TrapSchema',
);
export type TrapState = InstanceType<typeof TrapSchema>;

export const IslandConfigSchema = schema(
  {
    teamCount: t.uint8().default(2),
    radius: t.float32().default(80),
    centerRadius: t.float32().default(16),
    baseRadius: t.float32().default(56),
  },
  'IslandConfigSchema',
);
export type IslandConfigState = InstanceType<typeof IslandConfigSchema>;

export const IslandState = schema(
  {
    phase: t.string().default('active'),
    winnerTeamId: t.string().default(''),
    matchTimeRemaining: t.float32().default(ENGINE.matchDurationSec),
    islandConfig: t.ref(IslandConfigSchema),
    players: t.map(PlayerSchema),
    bases: t.map(BaseSchema),
    crates: t.map(CrateSchema),
    traps: t.map(TrapSchema),
  },
  'IslandState',
);
export type IslandRoomState = InstanceType<typeof IslandState>;
