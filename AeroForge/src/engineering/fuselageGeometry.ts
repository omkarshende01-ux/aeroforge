import type { FuselageCrossSectionShape, FuselageGeometry, FuselageStation } from '../domain/types';
import type { AircraftPoint3 } from './wingLoft';

export const FUSELAGE_MODEL_VERSION = 1 as const;
export const FUSELAGE_DEFAULT_AXIAL_INTERVALS = 8;
export const FUSELAGE_DEFAULT_RADIAL_SEGMENTS = 48;
const tolerance = 1e-9;

export type LegacyFuselageDefinition = { lengthM: number; maxDiameterM: number; noseLengthM: number; cabinLengthM: number };
export type FuselageValidation = { valid: boolean; errors: string[] };
export type FuselageEditResult = { fuselage?: FuselageGeometry; errors: string[]; selectedStationId?: string };
export type FuselageMeshData = { vertices: AircraftPoint3[]; indices: number[] };
export type FuselageCrossSectionArea = { stationId: string; xPositionM: number; areaM2: number };
export type FuselageProperties = {
  totalLengthM: number;
  maximumWidthM: number;
  maximumHeightM: number;
  crossSectionAreas: FuselageCrossSectionArea[];
  enclosedVolumeM3: number;
  wettedSurfaceAreaM2: number;
  volumeCentroidM: AircraftPoint3;
  axialIntervalsPerSection: number;
  radialSegments: number;
};

function finite(value: number): boolean { return Number.isFinite(value); }
function smoothstep(fraction: number): number { return fraction * fraction * (3 - 2 * fraction); }
function interpolate(from: number, to: number, fraction: number): number { return from + fraction * (to - from); }
function stationExponent(station: FuselageStation): number { return station.shape === 'superelliptical' ? station.superellipseExponent : 2; }

// Lanczos approximation, adequate for the bounded positive arguments used by superellipse areas.
function logGamma(value: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let x = 0.9999999999998099; const shifted = value - 1;
  coefficients.forEach((coefficient, index) => { x += coefficient / (shifted + index + 1); });
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

export function fuselageCrossSectionArea(widthM: number, heightM: number, exponent = 2): number {
  if (!finite(widthM) || !finite(heightM) || !finite(exponent) || widthM < 0 || heightM < 0 || exponent <= 0) throw new RangeError('Cross-section dimensions and exponent must be finite and nonnegative/positive.');
  if (widthM === 0 || heightM === 0) return 0;
  const logFactor = Math.log(widthM * heightM) + 2 * logGamma(1 + 1 / exponent) - logGamma(1 + 2 / exponent);
  return Math.exp(logFactor);
}

export function validateFuselageGeometry(fuselage: FuselageGeometry): FuselageValidation {
  const errors: string[] = [];
  if (fuselage.modelVersion !== FUSELAGE_MODEL_VERSION) errors.push(`Unsupported fuselage model version ${String(fuselage.modelVersion)}.`);
  if (fuselage.stations.length < 2) errors.push('A fuselage requires at least nose and tail stations.');
  const ids = new Set<string>();
  fuselage.stations.forEach((station, index) => {
    const label = station.id.trim() || `station ${index + 1}`;
    if (!station.id.trim() || ids.has(station.id)) errors.push(`Fuselage station ${index + 1} must have a unique nonempty id.`);
    ids.add(station.id);
    if (!finite(station.xPositionM) || station.xPositionM < 0) errors.push(`${label} x position must be finite and nonnegative.`);
    if (index === 0 && Math.abs(station.xPositionM) > tolerance) errors.push('The nose datum station must remain at x = 0 m.');
    if (index > 0 && station.xPositionM <= fuselage.stations[index - 1].xPositionM) errors.push('Fuselage stations must be strictly ordered by increasing x position.');
    if (!finite(station.widthM) || !finite(station.heightM) || station.widthM < 0 || station.heightM < 0) errors.push(`${label} width and height must be finite and nonnegative.`);
    if ((station.widthM <= tolerance) !== (station.heightM <= tolerance)) errors.push(`${label} must collapse width and height together.`);
    if (index > 0 && index < fuselage.stations.length - 1 && (station.widthM <= tolerance || station.heightM <= tolerance)) errors.push(`${label} is an interior station and requires positive width and height.`);
    if (station.shape === 'circular' && station.widthM > tolerance && Math.abs(station.widthM - station.heightM) > tolerance) errors.push(`${label} is circular, so width and height must match.`);
    if (!finite(station.lateralCenterM) || !finite(station.verticalCenterM)) errors.push(`${label} center offsets must be finite.`);
    if (!finite(station.superellipseExponent) || station.superellipseExponent < 1.2 || station.superellipseExponent > 10) errors.push(`${label} superellipse exponent must be within [1.2, 10].`);
  });
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function migrateLegacyFuselage(legacy: LegacyFuselageDefinition): FuselageGeometry {
  if (!finite(legacy.lengthM) || !finite(legacy.maxDiameterM) || !finite(legacy.noseLengthM) || !finite(legacy.cabinLengthM) || legacy.lengthM <= 0 || legacy.maxDiameterM <= 0 || legacy.noseLengthM <= 0 || legacy.cabinLengthM <= 0 || legacy.noseLengthM + legacy.cabinLengthM >= legacy.lengthM) throw new RangeError('Legacy fuselage dimensions must be positive and leave a nonzero tail section.');
  const cabinEnd = legacy.noseLengthM + legacy.cabinLengthM; const tailMid = cabinEnd + 0.55 * (legacy.lengthM - cabinEnd);
  return {
    modelVersion: FUSELAGE_MODEL_VERSION,
    stations: [
      { id: 'fuselage-nose-tip', xPositionM: 0, widthM: 0, heightM: 0, lateralCenterM: 0, verticalCenterM: 0, shape: 'circular', superellipseExponent: 2 },
      { id: 'fuselage-nose-mid', xPositionM: 0.38 * legacy.noseLengthM, widthM: 0.56 * legacy.maxDiameterM, heightM: 0.64 * legacy.maxDiameterM, lateralCenterM: 0, verticalCenterM: 0, shape: 'elliptical', superellipseExponent: 2 },
      { id: 'fuselage-cabin-front', xPositionM: legacy.noseLengthM, widthM: legacy.maxDiameterM, heightM: legacy.maxDiameterM, lateralCenterM: 0, verticalCenterM: 0, shape: 'circular', superellipseExponent: 2 },
      { id: 'fuselage-cabin-rear', xPositionM: cabinEnd, widthM: 0.95 * legacy.maxDiameterM, heightM: 0.95 * legacy.maxDiameterM, lateralCenterM: 0, verticalCenterM: 0.02 * legacy.maxDiameterM, shape: 'circular', superellipseExponent: 2 },
      { id: 'fuselage-tail-mid', xPositionM: tailMid, widthM: 0.5 * legacy.maxDiameterM, heightM: 0.58 * legacy.maxDiameterM, lateralCenterM: 0, verticalCenterM: 0.09 * legacy.maxDiameterM, shape: 'elliptical', superellipseExponent: 2 },
      { id: 'fuselage-tail-tip', xPositionM: legacy.lengthM, widthM: 0, heightM: 0, lateralCenterM: 0, verticalCenterM: 0.16 * legacy.maxDiameterM, shape: 'circular', superellipseExponent: 2 },
    ],
  };
}

export function sampleFuselageAtX(fuselage: FuselageGeometry, xPositionM: number): FuselageStation {
  const validation = validateFuselageGeometry(fuselage); if (!validation.valid) throw new RangeError(validation.errors.join(' '));
  const first = fuselage.stations[0]; const last = fuselage.stations.at(-1)!;
  if (!finite(xPositionM) || xPositionM < first.xPositionM - tolerance || xPositionM > last.xPositionM + tolerance) throw new RangeError('Fuselage sample position lies outside the station range.');
  let index = fuselage.stations.findIndex((station) => station.xPositionM >= xPositionM) - 1;
  if (index < 0) index = 0; if (index >= fuselage.stations.length - 1) index = fuselage.stations.length - 2;
  const from = fuselage.stations[index]; const to = fuselage.stations[index + 1]; const linearFraction = (xPositionM - from.xPositionM) / (to.xPositionM - from.xPositionM); const fraction = smoothstep(Math.min(1, Math.max(0, linearFraction)));
  const exponent = interpolate(stationExponent(from), stationExponent(to), fraction);
  return {
    id: linearFraction <= tolerance ? from.id : linearFraction >= 1 - tolerance ? to.id : `${from.id}--${to.id}@${xPositionM}`,
    xPositionM,
    widthM: interpolate(from.widthM, to.widthM, fraction), heightM: interpolate(from.heightM, to.heightM, fraction),
    lateralCenterM: interpolate(from.lateralCenterM, to.lateralCenterM, fraction), verticalCenterM: interpolate(from.verticalCenterM, to.verticalCenterM, fraction),
    shape: Math.abs(exponent - 2) <= tolerance ? (Math.abs(interpolate(from.widthM, to.widthM, fraction) - interpolate(from.heightM, to.heightM, fraction)) <= tolerance ? 'circular' : 'elliptical') : 'superelliptical',
    superellipseExponent: exponent,
  };
}

export function fuselageStationCrossSection(station: FuselageStation, radialSegments = FUSELAGE_DEFAULT_RADIAL_SEGMENTS): AircraftPoint3[] {
  if (!Number.isInteger(radialSegments) || radialSegments < 8) throw new RangeError('Fuselage radial segments must be an integer of at least eight.');
  if (station.widthM <= tolerance || station.heightM <= tolerance) return [[station.xPositionM, station.lateralCenterM, station.verticalCenterM]];
  const exponent = stationExponent(station); const power = 2 / exponent; const halfWidth = station.widthM / 2; const halfHeight = station.heightM / 2;
  return Array.from({ length: radialSegments }, (_, index) => {
    const angle = 2 * Math.PI * index / radialSegments; const cosine = Math.cos(angle); const sine = Math.sin(angle);
    return [station.xPositionM, station.lateralCenterM + halfWidth * Math.sign(cosine) * Math.abs(cosine) ** power, station.verticalCenterM + halfHeight * Math.sign(sine) * Math.abs(sine) ** power] as AircraftPoint3;
  });
}

export function buildFuselageMeshData(fuselage: FuselageGeometry, axialIntervalsPerSection = FUSELAGE_DEFAULT_AXIAL_INTERVALS, radialSegments = FUSELAGE_DEFAULT_RADIAL_SEGMENTS): FuselageMeshData {
  const validation = validateFuselageGeometry(fuselage); if (!validation.valid) throw new RangeError(validation.errors.join(' '));
  if (!Number.isInteger(axialIntervalsPerSection) || axialIntervalsPerSection < 1) throw new RangeError('Fuselage axial intervals must be a positive integer.');
  const samples: FuselageStation[] = [];
  for (let sectionIndex = 0; sectionIndex < fuselage.stations.length - 1; sectionIndex += 1) {
    const from = fuselage.stations[sectionIndex]; const to = fuselage.stations[sectionIndex + 1];
    for (let interval = sectionIndex === 0 ? 0 : 1; interval <= axialIntervalsPerSection; interval += 1) samples.push(sampleFuselageAtX(fuselage, interpolate(from.xPositionM, to.xPositionM, interval / axialIntervalsPerSection)));
  }
  const vertices: AircraftPoint3[] = []; const indices: number[] = []; const rings: { start: number; count: number }[] = [];
  samples.forEach((sample) => { const points = fuselageStationCrossSection(sample, radialSegments); const start = vertices.length; vertices.push(...points); rings.push({ start, count: points.length }); });
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const from = rings[ringIndex]; const to = rings[ringIndex + 1];
    if (from.count === 1 && to.count > 1) for (let radial = 0; radial < to.count; radial += 1) indices.push(from.start, to.start + (radial + 1) % to.count, to.start + radial);
    else if (from.count > 1 && to.count === 1) for (let radial = 0; radial < from.count; radial += 1) indices.push(from.start + radial, from.start + (radial + 1) % from.count, to.start);
    else if (from.count > 1 && to.count > 1) for (let radial = 0; radial < radialSegments; radial += 1) {
      const next = (radial + 1) % radialSegments; indices.push(from.start + radial, from.start + next, to.start + radial, from.start + next, to.start + next, to.start + radial);
    }
  }
  const first = rings[0]; if (first.count > 1) { const center = vertices.length; vertices.push([samples[0].xPositionM, samples[0].lateralCenterM, samples[0].verticalCenterM]); for (let radial = 0; radial < first.count; radial += 1) indices.push(center, first.start + (radial + 1) % first.count, first.start + radial); }
  const last = rings.at(-1)!; if (last.count > 1) { const sample = samples.at(-1)!; const center = vertices.length; vertices.push([sample.xPositionM, sample.lateralCenterM, sample.verticalCenterM]); for (let radial = 0; radial < last.count; radial += 1) indices.push(center, last.start + radial, last.start + (radial + 1) % last.count); }
  return { vertices, indices };
}

function triangleArea(a: AircraftPoint3, b: AircraftPoint3, c: AircraftPoint3): number {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return 0.5 * Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]);
}

const gaussNodes = [-0.9602898564975363, -0.7966664774136267, -0.525532409916329, -0.1834346424956498, 0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.9602898564975363];
const gaussWeights = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.362683783378362, 0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];

export function calculateFuselageProperties(fuselage: FuselageGeometry, axialIntervalsPerSection = FUSELAGE_DEFAULT_AXIAL_INTERVALS, radialSegments = FUSELAGE_DEFAULT_RADIAL_SEGMENTS): FuselageProperties {
  const validation = validateFuselageGeometry(fuselage); if (!validation.valid) throw new RangeError(validation.errors.join(' '));
  let volume = 0; let xMoment = 0; let yMoment = 0; let zMoment = 0;
  for (let sectionIndex = 0; sectionIndex < fuselage.stations.length - 1; sectionIndex += 1) {
    const fromX = fuselage.stations[sectionIndex].xPositionM; const toX = fuselage.stations[sectionIndex + 1].xPositionM; const midpoint = (fromX + toX) / 2; const half = (toX - fromX) / 2;
    gaussNodes.forEach((node, index) => {
      const x = midpoint + half * node; const sample = sampleFuselageAtX(fuselage, x); const weightedArea = gaussWeights[index] * fuselageCrossSectionArea(sample.widthM, sample.heightM, stationExponent(sample)) * half;
      volume += weightedArea; xMoment += x * weightedArea; yMoment += sample.lateralCenterM * weightedArea; zMoment += sample.verticalCenterM * weightedArea;
    });
  }
  const mesh = buildFuselageMeshData(fuselage, axialIntervalsPerSection, radialSegments); let wettedSurfaceAreaM2 = 0;
  for (let index = 0; index < mesh.indices.length; index += 3) wettedSurfaceAreaM2 += triangleArea(mesh.vertices[mesh.indices[index]], mesh.vertices[mesh.indices[index + 1]], mesh.vertices[mesh.indices[index + 2]]);
  const first = fuselage.stations[0]; const last = fuselage.stations.at(-1)!;
  return {
    totalLengthM: last.xPositionM - first.xPositionM,
    maximumWidthM: Math.max(...fuselage.stations.map((station) => station.widthM)), maximumHeightM: Math.max(...fuselage.stations.map((station) => station.heightM)),
    crossSectionAreas: fuselage.stations.map((station) => ({ stationId: station.id, xPositionM: station.xPositionM, areaM2: fuselageCrossSectionArea(station.widthM, station.heightM, stationExponent(station)) })),
    enclosedVolumeM3: volume, wettedSurfaceAreaM2, volumeCentroidM: volume > tolerance ? [xMoment / volume, yMoment / volume, zMoment / volume] : [0, 0, 0], axialIntervalsPerSection, radialSegments,
  };
}

function accepted(fuselage: FuselageGeometry, selectedStationId?: string): FuselageEditResult { const validation = validateFuselageGeometry(fuselage); return validation.valid ? { fuselage, errors: [], selectedStationId } : { errors: validation.errors }; }
function uniqueId(fuselage: FuselageGeometry): string { const ids = new Set(fuselage.stations.map((station) => station.id)); let index = 1; while (ids.has(`fuselage-station-${index}`)) index += 1; return `fuselage-station-${index}`; }

export function editFuselageStation(fuselage: FuselageGeometry, stationId: string, patch: Partial<Omit<FuselageStation, 'id'>>): FuselageEditResult {
  const index = fuselage.stations.findIndex((station) => station.id === stationId); if (index < 0) return { errors: [`Fuselage station "${stationId}" was not found.`] };
  if (index === 0 && patch.xPositionM !== undefined && Math.abs(patch.xPositionM) > tolerance) return { errors: ['The nose datum station is fixed at x = 0 m.'] };
  const stations = fuselage.stations.map((station, stationIndex) => stationIndex === index ? { ...station, ...patch } : { ...station });
  if (patch.shape === 'circular') { const dimension = patch.widthM ?? patch.heightM ?? stations[index].widthM; stations[index].widthM = dimension; stations[index].heightM = dimension; stations[index].superellipseExponent = 2; }
  if (patch.shape === 'elliptical') stations[index].superellipseExponent = 2;
  return accepted({ ...fuselage, stations }, stationId);
}

export function insertFuselageStationAfter(fuselage: FuselageGeometry, stationId: string): FuselageEditResult {
  const index = fuselage.stations.findIndex((station) => station.id === stationId); if (index < 0) return { errors: [`Fuselage station "${stationId}" was not found.`] };
  if (index >= fuselage.stations.length - 1) return { errors: ['Select a fuselage station with an aft neighbor.'] };
  const x = (fuselage.stations[index].xPositionM + fuselage.stations[index + 1].xPositionM) / 2; const station = { ...sampleFuselageAtX(fuselage, x), id: uniqueId(fuselage) };
  return accepted({ ...fuselage, stations: [...fuselage.stations.slice(0, index + 1).map((item) => ({ ...item })), station, ...fuselage.stations.slice(index + 1).map((item) => ({ ...item }))] }, station.id);
}

export function duplicateFuselageStation(fuselage: FuselageGeometry, stationId: string): FuselageEditResult {
  const index = fuselage.stations.findIndex((station) => station.id === stationId); if (index < 0) return { errors: [`Fuselage station "${stationId}" was not found.`] };
  if (index === fuselage.stations.length - 1) return { errors: ['The closed tail-tip station cannot be duplicated; select an interior station.'] };
  const inserted = insertFuselageStationAfter(fuselage, stationId); if (!inserted.fuselage || !inserted.selectedStationId) return inserted;
  const source = fuselage.stations[index]; return editFuselageStation(inserted.fuselage, inserted.selectedStationId, { widthM: source.widthM, heightM: source.heightM, lateralCenterM: source.lateralCenterM, verticalCenterM: source.verticalCenterM, shape: source.shape, superellipseExponent: source.superellipseExponent });
}

export function addFuselageStation(fuselage: FuselageGeometry): FuselageEditResult {
  const last = fuselage.stations.at(-1); const previous = fuselage.stations.at(-2); if (!last || !previous) return { errors: ['At least two fuselage stations are required.'] };
  const spacing = last.xPositionM - previous.xPositionM; const stations = fuselage.stations.map((station) => ({ ...station }));
  if (last.widthM <= tolerance) { stations[stations.length - 1] = { ...last, widthM: Math.max(previous.widthM * 0.45, 0.01), heightM: Math.max(previous.heightM * 0.45, 0.01), shape: previous.shape, superellipseExponent: previous.superellipseExponent }; }
  const station: FuselageStation = { ...last, id: uniqueId(fuselage), xPositionM: last.xPositionM + spacing };
  return accepted({ ...fuselage, stations: [...stations, station] }, station.id);
}

export function removeFuselageStation(fuselage: FuselageGeometry, stationId: string): FuselageEditResult {
  const index = fuselage.stations.findIndex((station) => station.id === stationId); if (index < 0) return { errors: [`Fuselage station "${stationId}" was not found.`] };
  if (index === 0 || index === fuselage.stations.length - 1) return { errors: ['Nose and tail closure stations cannot be removed.'] };
  const stations = fuselage.stations.filter((_, stationIndex) => stationIndex !== index).map((station) => ({ ...station }));
  return accepted({ ...fuselage, stations }, stations[Math.min(index, stations.length - 1)].id);
}
