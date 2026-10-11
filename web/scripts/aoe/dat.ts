// Reader for empires.dat from Age of Empires (1997) and Rise of Rome (1998), file version "VER 3.7".
//
// The layout follows the open-source genieutils library (Tapsa/genieutils, LGPL), read for the AoE/RoR
// branch only. Nothing here comes from the game: it is a file-format reader, and the numbers it returns come
// from the player's own copy of the game at run time.

import { inflateRawSync } from "node:zlib";
import { Reader } from "./reader";

export interface DatSoundItem { file: string; resource: number; probability: number }
export interface DatSound { id: number; playDelay: number; cacheTime: number; items: DatSoundItem[] }

export interface DatGraphicDelta { graphic: number; offsetX: number; offsetY: number; displayAngle: number }
export interface DatGraphic {
  id: number;
  name: string;
  file: string;
  slp: number;
  layer: number;
  playerColor: number;
  transparentSelection: number;
  coordinates: number[];
  sound: number;
  frameCount: number;
  angleCount: number;
  speedMultiplier: number;
  frameDuration: number;
  replayDelay: number;
  sequenceType: number;
  mirroringMode: number;
  deltas: DatGraphicDelta[];
  angleSounds: { frame: number; sound: number; frame2: number; sound2: number; frame3: number; sound3: number }[];
}

export interface DatTerrain {
  index: number;
  enabled: number;
  random: number;
  name: string;
  name2: string;
  slp: number;
  sound: number;
  colors: number[];
  cliffColors: number[];
  passable: number;
  impassable: number;
  animated: { frames: number; pauseFrames: number; interval: number; pauseBetweenLoops: number } | null;
  elevationGraphics: { frames: number; angles: number; shape: number }[];
  terrainToDraw: number;
  dimensions: number[];
  borders: number[];
  units: { unit: number; density: number; centering: number }[];
}

export interface DatTerrainBorder {
  index: number;
  enabled: number;
  name: string;
  name2: string;
  slp: number;
  sound: number;
  colors: number[];
  drawTerrain: number;
  underlayTerrain: number;
  borderStyle: number;
}

export interface DatMap {
  id: number;
  borders: { southWest: number; northWest: number; northEast: number; southEast: number; usage: number };
  waterShape: number;
  baseTerrain: number;
  landCoverage: number;
  lands: Record<string, number>[];
  terrains: Record<string, number>[];
  units: Record<string, number>[];
  elevations: Record<string, number>[];
}

export interface DatEffectCommand { type: number; a: number; b: number; c: number; d: number }
export interface DatEffect { id: number; name: string; commands: DatEffectCommand[] }

export interface DatCost { type: number; amount: number; flag: number }
export interface DatTask {
  taskType: number;
  id: number;
  isDefault: number;
  actionType: number;
  classId: number;
  unitId: number;
  terrainId: number;
  resourceIn: number;
  resourceMultiplier: number;
  resourceOut: number;
  unusedResource: number;
  workValue1: number;
  workValue2: number;
  workRange: number;
  autoSearchTargets: number;
  searchWaitTime: number;
  enableTargeting: number;
  combatLevelFlag: number;
  gatherType: number;
  workFlag2: number;
  targetDiplomacy: number;
  carryCheck: number;
  pickForConstruction: number;
  movingGraphic: number;
  proceedingGraphic: number;
  workingGraphic: number;
  carryingGraphic: number;
  gatherSound: number;
  depositSound: number;
}

export interface DatUnit {
  type: number;
  id: number;
  name: string;
  nameStringId: number;
  creationStringId: number;
  class: number;
  standingGraphic: number;
  dyingGraphic: number;
  undeadGraphic: number;
  undeadMode: number;
  hitPoints: number;
  lineOfSight: number;
  garrisonCapacity: number;
  collisionSize: [number, number, number];
  trainSound: number;
  deadUnitId: number;
  sortNumber: number;
  canBeBuiltOn: number;
  iconId: number;
  hideInEditor: number;
  enabled: number;
  placementSideTerrain: [number, number];
  placementTerrain: [number, number];
  clearanceSize: [number, number];
  hillMode: number;
  fogVisibility: number;
  terrainRestriction: number;
  flyMode: number;
  resourceCapacity: number;
  resourceDecay: number;
  blastDefenseLevel: number;
  combatLevel: number;
  interactionMode: number;
  minimapMode: number;
  interfaceKind: number;
  multipleAttributeMode: number;
  minimapColor: number;
  helpStringId: number;
  hotKeyTextId: number;
  hotKeyId: number;
  recyclable: number;
  enableAutoGather: number;
  createDoppelgangerOnDeath: number;
  resourceGatherGroup: number;
  selectionEffect: number;
  editorSelectionColour: number;
  outlineSize: [number, number, number];
  resourceStorages: DatCost[];
  damageGraphics: { graphic: number; damagePercent: number; oldApplyMode: number; applyMode: number }[];
  selectionSound: number;
  dyingSound: number;
  oldAttackReaction: number;
  convertTerrain: number;
  copyId: number;
  speed?: number;
  moving?: {
    walkingGraphic: number;
    runningGraphic: number;
    rotationSpeed: number;
    oldSizeClass: number;
    trackingUnit: number;
    trackingUnitMode: number;
    trackingUnitDensity: number;
    oldMoveAlgorithm: number;
  };
  action?: {
    defaultTaskId: number;
    searchRadius: number;
    workRate: number;
    dropSites: number[];
    taskSwapGroup: number;
    attackSound: number;
    moveSound: number;
    runPattern: number;
    tasks: DatTask[];
  };
  combat?: {
    baseArmor: number;
    attacks: { class: number; amount: number }[];
    armors: { class: number; amount: number }[];
    defenseTerrainBonus: number;
    maxRange: number;
    blastWidth: number;
    reloadTime: number;
    projectileUnitId: number;
    accuracyPercent: number;
    breakOffCombat: number;
    frameDelay: number;
    graphicDisplacement: number[];
    blastAttackLevel: number;
    minRange: number;
    attackGraphic: number;
    displayedMeleeArmor: number;
    displayedAttack: number;
    displayedRange: number;
    displayedReloadTime: number;
  };
  projectile?: {
    projectileType: number;
    smartMode: number;
    hitMode: number;
    vanishMode: number;
    areaEffectSpecials: number;
    projectileArc: number;
  };
  creatable?: {
    costs: DatCost[];
    trainTime: number;
    trainLocationId: number;
    buttonId: number;
    displayedPierceArmor: number;
  };
  building?: {
    constructionGraphic: number;
    adjacentMode: number;
    graphicsAngle: number;
    disappearsWhenBuilt: number;
    stackUnitId: number;
    foundationTerrainId: number;
    oldOverlayId: number;
    techId: number;
    constructionSound: number;
  };
}

export interface DatCiv {
  index: number;
  playerType: number;
  name: string;
  techTreeEffect: number;
  resources: number[];
  iconSet: number;
  units: (DatUnit | null)[];
}

export interface DatTech {
  id: number;
  name: string;
  requiredTechs: number[];
  costs: DatCost[];
  requiredTechCount: number;
  locationId: number;
  nameStringId: number;
  descriptionStringId: number;
  researchTime: number;
  effectId: number;
  type: number;
  iconId: number;
  buttonId: number;
  helpStringId: number;
  techTreeStringId: number;
  hotKeyId: number;
}

export interface DatFile {
  version: string;
  terrainRestrictions: number[][];
  playerColours: { id: number; name: string; resourceId: number; minimapColour: number; type: number }[];
  sounds: (DatSound | null)[];
  graphics: (DatGraphic | null)[];
  map: {
    mapWidth: number;
    mapHeight: number;
    worldWidth: number;
    worldHeight: number;
    tileSizes: { width: number; height: number; deltaY: number }[];
    terrains: DatTerrain[];
    borders: DatTerrainBorder[];
    terrainsUsed: number;
    bordersUsed: number;
    maxTerrain: number;
    tileWidth: number;
    tileHeight: number;
    tileHalfHeight: number;
    tileHalfWidth: number;
    elevHeight: number;
  };
  randomMaps: DatMap[];
  effects: DatEffect[];
  civs: DatCiv[];
  techs: DatTech[];
}

/** Inflate a compressed empires.dat (raw deflate, no zlib header). */
export function inflateDat(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(inflateRawSync(bytes));
}

const TILE_TYPES = 19;
const TERRAIN_SLOTS = 32;
const TERRAIN_UNITS = 30;
const BORDER_SLOTS = 16;

export function parseDat(raw: Uint8Array): DatFile {
  const r = new Reader(raw);
  const version = r.str(8);
  if (version !== "VER 3.7") throw new Error(`unsupported empires.dat version "${version}" (need VER 3.7)`);

  const restrictionCount = r.u16();
  const terrainsUsed1 = r.u16();
  r.skip(4 * restrictionCount);
  const terrainRestrictions = r.times(restrictionCount, () => r.times(terrainsUsed1, () => r.f32()));

  const playerColours = r.times(r.u16(), () => ({
    name: r.str(30),
    id: r.i16(),
    resourceId: r.i16(),
    minimapColour: r.u8(),
    type: r.u8(),
  }));

  const sounds = r.times(r.u16(), (): DatSound => {
    const id = r.i16();
    const playDelay = r.i16();
    const n = r.u16();
    const cacheTime = r.i32();
    const items = r.times(n, () => ({ file: r.str(13), resource: r.i32(), probability: r.i16() }));
    return { id, playDelay, cacheTime, items };
  });

  const graphicCount = r.u16();
  const graphicPointers = r.times(graphicCount, () => r.i32());
  const graphics = graphicPointers.map((p) => (p ? readGraphic(r) : null));

  const map = readTerrainBlock(r);
  const randomMaps = readRandomMaps(r);

  const effects = r.times(r.i32(), (): DatEffect => {
    const name = r.str(31);
    const commands = r.times(r.i16(), () => ({ type: r.u8(), a: r.i16(), b: r.i16(), c: r.i16(), d: r.f32() }));
    return { id: 0, name, commands };
  });
  effects.forEach((e, i) => (e.id = i));

  const civs = r.times(r.u16(), (): DatCiv => {
    const playerType = r.u8();
    const name = r.str(20);
    const resourceCount = r.u16();
    const techTreeEffect = r.i16();
    const resources = r.times(resourceCount, () => r.f32());
    const iconSet = r.u8();
    const unitCount = r.u16();
    const pointers = r.times(unitCount, () => r.i32());
    const units = pointers.map((p) => (p ? readUnit(r) : null));
    return { index: 0, playerType, name, techTreeEffect, resources, iconSet, units };
  });
  civs.forEach((c, i) => (c.index = i));

  const techs = r.times(r.u16(), (): DatTech => {
    const requiredTechs = r.times(4, () => r.i16());
    const costs = r.times(3, () => ({ type: r.i16(), amount: r.i16(), flag: r.u8() }));
    const requiredTechCount = r.i16();
    const locationId = r.i16();
    const nameStringId = r.u16();
    const descriptionStringId = r.u16();
    const researchTime = r.i16();
    const effectId = r.i16();
    const type = r.i16();
    const iconId = r.i16();
    const buttonId = r.u8();
    const helpStringId = r.i32();
    const techTreeStringId = r.i32();
    const hotKeyId = r.i32();
    const name = r.str(r.u16());
    return {
      id: 0, name, requiredTechs, costs, requiredTechCount, locationId, nameStringId, descriptionStringId,
      researchTime, effectId, type, iconId, buttonId, helpStringId, techTreeStringId, hotKeyId,
    };
  });
  techs.forEach((t, i) => (t.id = i));

  if (r.left !== 0) throw new Error(`empires.dat: ${r.left} bytes left after the tech list`);
  return { version, terrainRestrictions, playerColours, sounds, graphics, map, randomMaps, effects, civs, techs };
}

function readGraphic(r: Reader): DatGraphic {
  const name = r.str(21);
  const file = r.str(13);
  const slp = r.i32();
  r.u8(); // is loaded
  r.u8(); // old colour flag
  const layer = r.u8();
  const playerColor = r.i16();
  const transparentSelection = r.u8();
  const coordinates = r.times(4, () => r.i16());
  const deltaCount = r.u16();
  const sound = r.i16();
  const angleSoundsUsed = r.u8();
  const frameCount = r.u16();
  const angleCount = r.u16();
  const speedMultiplier = r.f32();
  const frameDuration = r.f32();
  const replayDelay = r.f32();
  const sequenceType = r.u8();
  const id = r.i16();
  const mirroringMode = r.u8();
  const deltas = r.times(deltaCount, () => {
    const graphic = r.i16();
    r.skip(2 + 4);
    const offsetX = r.i16();
    const offsetY = r.i16();
    const displayAngle = r.i16();
    r.skip(2);
    return { graphic, offsetX, offsetY, displayAngle };
  });
  const angleSounds = angleSoundsUsed
    ? r.times(angleCount, () => ({
        frame: r.i16(), sound: r.i16(), frame2: r.i16(), sound2: r.i16(), frame3: r.i16(), sound3: r.i16(),
      }))
    : [];
  return {
    id, name, file, slp, layer, playerColor, transparentSelection, coordinates, sound, frameCount, angleCount,
    speedMultiplier, frameDuration, replayDelay, sequenceType, mirroringMode, deltas, angleSounds,
  };
}

function readTerrainBlock(r: Reader): DatFile["map"] {
  r.u32(); // virtual function pointer
  r.u32(); // map pointer
  const mapWidth = r.i32();
  const mapHeight = r.i32();
  const worldWidth = r.i32();
  const worldHeight = r.i32();
  const tileSizes = r.times(TILE_TYPES, () => ({ width: r.i16(), height: r.i16(), deltaY: r.i16() }));
  r.i16(); // padding
  const terrains = r.times(TERRAIN_SLOTS, (): DatTerrain => {
    const enabled = r.u8();
    const random = r.u8();
    const name = r.str(13);
    const name2 = r.str(13);
    const slp = r.i32();
    r.i32(); // shape pointer
    const sound = r.i32();
    const colors = r.times(3, () => r.u8());
    const cliffColors = r.times(2, () => r.u8());
    const passable = r.u8();
    const impassable = r.u8();
    const isAnimated = r.u8();
    const frames = r.i16();
    const pauseFrames = r.i16();
    const interval = r.f32();
    const pauseBetweenLoops = r.f32();
    r.i16(); // frame
    r.i16(); // draw frame
    r.f32(); // animate last
    r.u8(); // frame changed
    r.u8(); // drawn
    const elevationGraphics = r.times(TILE_TYPES, () => ({ frames: r.i16(), angles: r.i16(), shape: r.i16() }));
    const terrainToDraw = r.i16();
    const dimensions = [r.i16(), r.i16()];
    const borders = r.times(TERRAIN_SLOTS, () => r.i16());
    const unitIds = r.times(TERRAIN_UNITS, () => r.i16());
    const densities = r.times(TERRAIN_UNITS, () => r.i16());
    const centering = r.times(TERRAIN_UNITS, () => r.u8());
    const used = r.i16();
    r.i16(); // phantom
    const units = unitIds.slice(0, Math.max(0, used)).map((unit, i) => ({
      unit, density: densities[i], centering: centering[i],
    }));
    return {
      index: 0, enabled, random, name, name2, slp, sound, colors, cliffColors, passable, impassable,
      animated: isAnimated ? { frames, pauseFrames, interval, pauseBetweenLoops } : null,
      elevationGraphics, terrainToDraw, dimensions, borders, units,
    };
  });
  terrains.forEach((t, i) => (t.index = i));

  const borders = r.times(BORDER_SLOTS, (): DatTerrainBorder => {
    const enabled = r.u8();
    r.u8(); // random
    const name = r.str(13);
    const name2 = r.str(13);
    const slp = r.i32();
    r.i32(); // shape pointer
    const sound = r.i32();
    const colors = r.times(3, () => r.u8());
    r.u8(); // is animated
    r.skip(2 + 2 + 4 + 4 + 2 + 2 + 4 + 1 + 1); // animation state
    r.skip(TILE_TYPES * 12 * 6); // frame data per tile type and border shape
    const drawTerrain = r.i16();
    const underlayTerrain = r.i16();
    const borderStyle = r.i16();
    return { index: 0, enabled, name, name2, slp, sound, colors, drawTerrain, underlayTerrain, borderStyle };
  });
  borders.forEach((b, i) => (b.index = i));

  r.u32(); // map row offset
  const terrainsUsed = r.i16();
  const bordersUsed = r.i16();
  const maxTerrain = r.i16();
  const tileWidth = r.i16();
  const tileHeight = r.i16();
  const tileHalfHeight = r.i16();
  const tileHalfWidth = r.i16();
  const elevHeight = r.i16();
  r.skip(2 * 6); // current row/col and block bounds
  r.skip(4 * 3); // any-frame-change, search map pointers
  r.u8(); // map visible flag
  r.u8(); // fog flag
  r.skip(2); // padding
  r.skip(4 * 5); // pointers
  return {
    mapWidth, mapHeight, worldWidth, worldHeight, tileSizes, terrains, borders, terrainsUsed, bordersUsed,
    maxTerrain, tileWidth, tileHeight, tileHalfHeight, tileHalfWidth, elevHeight,
  };
}

function readRandomMaps(r: Reader): DatMap[] {
  const count = r.u32();
  r.i32(); // pointer
  const ids: number[] = [];
  const counts: number[][] = [];
  for (let i = 0; i < count; i++) {
    ids.push(r.i32());
    r.skip(4 * 9);
    const c: number[] = [];
    for (let k = 0; k < 4; k++) {
      c.push(r.u32());
      r.i32();
    }
    counts.push(c);
  }
  const maps: DatMap[] = [];
  for (let i = 0; i < count; i++) {
    const southWest = r.i32();
    const northWest = r.i32();
    const northEast = r.i32();
    const southEast = r.i32();
    const usage = r.i32();
    const waterShape = r.i32();
    const baseTerrain = r.i32();
    const landCoverage = r.i32();
    r.i32(); // unused id
    const n = [0, 0, 0, 0];
    const count = (k: number): number => {
      n[k] = r.u32();
      r.i32(); // pointer
      return n[k];
    };
    const lands = r.times(count(0), () => ({
      landId: r.i32(), terrain: r.u32(), landSpacing: r.i32(), baseSize: r.i32(), zone: r.u8(),
      placementType: r.u8(), _p1: r.i16(), baseX: r.i32(), baseY: r.i32(), landProportion: r.u8(),
      byPlayerFlag: r.u8(), _p2: r.i16(), startAreaRadius: r.i32(), terrainEdgeFade: r.i32(), clumpiness: r.i32(),
    }));
    for (const l of lands) delete (l as Record<string, number>)._p1, delete (l as Record<string, number>)._p2;
    const terrains = r.times(count(1), () => ({
      proportion: r.i32(), terrain: r.i32(), clumpCount: r.i32(), edgeSpacing: r.i32(),
      placementTerrain: r.i32(), clumpiness: r.i32(),
    }));
    const units = r.times(count(2), () => {
      const u = {
        unit: r.i32(), hostTerrain: r.i32(), groupPlacing: r.u8(), scaleFlag: r.u8(), _p: r.i16(),
        objectsPerGroup: r.i32(), fluctuation: r.i32(), groupsPerPlayer: r.i32(), groupArea: r.i32(),
        playerId: r.i32(), setPlaceForAllPlayers: r.i32(), minDistanceToPlayers: r.i32(),
        maxDistanceToPlayers: r.i32(),
      };
      delete (u as Record<string, number>)._p;
      return u;
    });
    const elevations = r.times(count(3), () => ({
      proportion: r.i32(), terrain: r.i32(), clumpCount: r.i32(), baseTerrain: r.i32(),
      baseElevation: r.i32(), tileSpacing: r.i32(),
    }));
    if (n.some((v, k) => v !== counts[i][k])) throw new Error(`random map ${i}: header and body counts differ`);
    maps.push({
      id: ids[i], borders: { southWest, northWest, northEast, southEast, usage }, waterShape, baseTerrain,
      landCoverage, lands, terrains, units, elevations,
    });
  }
  return maps;
}

function readUnit(r: Reader): DatUnit {
  const type = r.u8();
  const nameLen = r.u16();
  const id = r.i16();
  const nameStringId = r.u16();
  const creationStringId = r.u16();
  const cls = r.i16();
  const standingGraphic = r.i16();
  const dyingGraphic = r.i16();
  const undeadGraphic = r.i16();
  const undeadMode = r.u8();
  const hitPoints = r.i16();
  const lineOfSight = r.f32();
  const garrisonCapacity = r.u8();
  const collisionSize: [number, number, number] = [r.f32(), r.f32(), r.f32()];
  const trainSound = r.i16();
  const deadUnitId = r.i16();
  const sortNumber = r.u8();
  const canBeBuiltOn = r.u8();
  const iconId = r.i16();
  const hideInEditor = r.u8();
  r.i16(); // old portrait picture
  const enabled = r.u8();
  const placementSideTerrain: [number, number] = [r.i16(), r.i16()];
  const placementTerrain: [number, number] = [r.i16(), r.i16()];
  const clearanceSize: [number, number] = [r.f32(), r.f32()];
  const hillMode = r.u8();
  const fogVisibility = r.u8();
  const terrainRestriction = r.i16();
  const flyMode = r.u8();
  const resourceCapacity = r.i16();
  const resourceDecay = r.f32();
  const blastDefenseLevel = r.u8();
  const combatLevel = r.u8();
  const interactionMode = r.u8();
  const minimapMode = r.u8();
  const interfaceKind = r.u8();
  const multipleAttributeMode = r.f32();
  const minimapColor = r.u8();
  const helpStringId = r.i32();
  const hotKeyTextId = r.i32();
  const hotKeyId = r.i32();
  const recyclable = r.u8();
  const enableAutoGather = r.u8();
  const createDoppelgangerOnDeath = r.u8();
  const resourceGatherGroup = r.u8();
  const selectionEffect = r.u8();
  const editorSelectionColour = r.u8();
  const outlineSize: [number, number, number] = [r.f32(), r.f32(), r.f32()];
  const resourceStorages = r.times(3, () => ({ type: r.i16(), amount: r.f32(), flag: r.u8() }));
  const damageGraphics = r.times(r.u8(), () => ({
    graphic: r.i16(), damagePercent: r.u8(), oldApplyMode: r.u8(), applyMode: r.u8(),
  }));
  const selectionSound = r.i16();
  const dyingSound = r.i16();
  const oldAttackReaction = r.u8();
  const convertTerrain = r.u8();
  const name = r.str(nameLen);
  const copyId = r.i16();

  const unit: DatUnit = {
    type, id, name, nameStringId, creationStringId, class: cls, standingGraphic, dyingGraphic, undeadGraphic,
    undeadMode, hitPoints, lineOfSight, garrisonCapacity, collisionSize, trainSound, deadUnitId, sortNumber,
    canBeBuiltOn, iconId, hideInEditor, enabled, placementSideTerrain, placementTerrain, clearanceSize, hillMode,
    fogVisibility, terrainRestriction, flyMode, resourceCapacity, resourceDecay, blastDefenseLevel, combatLevel,
    interactionMode, minimapMode, interfaceKind, multipleAttributeMode, minimapColor, helpStringId, hotKeyTextId,
    hotKeyId, recyclable, enableAutoGather, createDoppelgangerOnDeath, resourceGatherGroup, selectionEffect,
    editorSelectionColour, outlineSize, resourceStorages, damageGraphics, selectionSound, dyingSound,
    oldAttackReaction, convertTerrain, copyId,
  };
  if (type === 90 || type < 20) return unit;

  unit.speed = r.f32();
  if (type >= 30) {
    unit.moving = {
      walkingGraphic: r.i16(), runningGraphic: r.i16(), rotationSpeed: r.f32(), oldSizeClass: r.u8(),
      trackingUnit: r.i16(), trackingUnitMode: r.u8(), trackingUnitDensity: r.f32(), oldMoveAlgorithm: r.u8(),
    };
  }
  if (type >= 40) {
    const defaultTaskId = r.i16();
    const searchRadius = r.f32();
    const workRate = r.f32();
    const dropSites = [r.i16(), r.i16()];
    const taskSwapGroup = r.u8();
    const attackSound = r.i16();
    const moveSound = r.i16();
    const runPattern = r.u8();
    const tasks = r.times(r.u16(), (): DatTask => ({
      taskType: r.i16(), id: r.i16(), isDefault: r.u8(), actionType: r.i16(), classId: r.i16(), unitId: r.i16(),
      terrainId: r.i16(), resourceIn: r.i16(), resourceMultiplier: r.i16(), resourceOut: r.i16(),
      unusedResource: r.i16(), workValue1: r.f32(), workValue2: r.f32(), workRange: r.f32(),
      autoSearchTargets: r.u8(), searchWaitTime: r.f32(), enableTargeting: r.u8(), combatLevelFlag: r.u8(),
      gatherType: r.i16(), workFlag2: r.i16(), targetDiplomacy: r.u8(), carryCheck: r.u8(),
      pickForConstruction: r.u8(), movingGraphic: r.i16(), proceedingGraphic: r.i16(), workingGraphic: r.i16(),
      carryingGraphic: r.i16(), gatherSound: r.i16(), depositSound: r.i16(),
    }));
    unit.action = {
      defaultTaskId, searchRadius, workRate, dropSites, taskSwapGroup, attackSound, moveSound, runPattern, tasks,
    };
  }
  if (type >= 50) {
    const baseArmor = r.u8();
    const attacks = r.times(r.u16(), () => ({ class: r.i16(), amount: r.i16() }));
    const armors = r.times(r.u16(), () => ({ class: r.i16(), amount: r.i16() }));
    unit.combat = {
      baseArmor, attacks, armors, defenseTerrainBonus: r.i16(), maxRange: r.f32(), blastWidth: r.f32(),
      reloadTime: r.f32(), projectileUnitId: r.i16(), accuracyPercent: r.i16(), breakOffCombat: r.u8(),
      frameDelay: r.i16(), graphicDisplacement: [r.f32(), r.f32(), r.f32()], blastAttackLevel: r.u8(),
      minRange: r.f32(), attackGraphic: r.i16(), displayedMeleeArmor: r.i16(), displayedAttack: r.i16(),
      displayedRange: r.f32(), displayedReloadTime: r.f32(),
    };
  }
  if (type === 60) {
    unit.projectile = {
      projectileType: r.u8(), smartMode: r.u8(), hitMode: r.u8(), vanishMode: r.u8(),
      areaEffectSpecials: r.u8(), projectileArc: r.f32(),
    };
  }
  if (type >= 70) {
    const costs = r.times(3, () => ({ type: r.i16(), amount: r.i16(), flag: r.i16() }));
    const trainTime = r.i16();
    const trainLocationId = r.i16();
    const buttonId = r.u8();
    const displayedPierceArmor = r.i16();
    unit.creatable = { costs, trainTime, trainLocationId, buttonId, displayedPierceArmor };
  }
  if (type === 80) {
    unit.building = {
      constructionGraphic: r.i16(), adjacentMode: r.u8(), graphicsAngle: r.i16(), disappearsWhenBuilt: r.u8(),
      stackUnitId: r.i16(), foundationTerrainId: r.i16(), oldOverlayId: r.i16(), techId: r.i16(),
      constructionSound: r.i16(),
    };
  }
  return unit;
}
