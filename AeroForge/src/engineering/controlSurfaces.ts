import type {
  AircraftDesign,
  ControlSurfaceDefinition,
  ControlSurfaceKind,
  ControlSurfaceModel,
  ControlSurfaceParent,
  ControlSurfaceSide,
} from '../domain/types';
import { naca4PointAtChordFraction, type AirfoilSurfaceSide } from './airfoil';
import { physicalWingStations } from './wingGeometry';
import { sampleWingSectionAtSpan, transformWingAirfoilPoint, type AircraftPoint3, type AirfoilPoint2, type WingSectionSample } from './wingLoft';
import { sampleHorizontalTailSectionAtDistance, sampleVerticalTailSection, transformVerticalTailAirfoilPoint } from './tailGeometry';

export const CONTROL_SURFACE_MODEL_VERSION = 1 as const;
const tolerance = 1e-9;
const angleLimitDeg = 89;
const chordwiseIntervals = 12;

export type PhysicalControlSide = 'port' | 'starboard' | 'center';
export type ControlSurfaceValidation = { valid: boolean; errors: string[] };
export type ControlSurfaceEditResult = { model?: ControlSurfaceModel; errors: string[]; selectedControlSurfaceId?: string };

export type ControlSurfaceInstanceProperties = {
  key: string;
  side: PhysicalControlSide;
  projectedSpanM: number;
  projectedAreaM2: number;
  physicalDeflectionDeg: number;
  hingeStart: AircraftPoint3;
  hingeEnd: AircraftPoint3;
  hingeStraightnessDeviationM: number;
};

export type ControlSurfaceProperties = {
  id: string;
  totalProjectedSpanM: number;
  projectedAreaM2: number;
  instances: ControlSurfaceInstanceProperties[];
  warnings: string[];
};

export type ControlSurfaceGeometryInstance = ControlSurfaceInstanceProperties & {
  controlSurfaceId: string;
  kind: ControlSurfaceKind;
  neutralVertices: AircraftPoint3[];
  deflectedVertices: AircraftPoint3[];
  indices: number[];
};

function finite(value: number): boolean { return Number.isFinite(value); }
function interpolate(from: number, to: number, fraction: number): number { return from + fraction * (to - from); }

function expectedParent(kind: ControlSurfaceKind): ControlSurfaceParent {
  if (kind === 'aileron' || kind === 'flap') return 'wing';
  if (kind === 'elevator') return 'horizontal-tail';
  return 'vertical-tail';
}

function physicalSides(surface: ControlSurfaceDefinition): PhysicalControlSide[] {
  if (surface.parentSurface === 'vertical-tail') return ['center'];
  if (surface.operation === 'independent') return [surface.side as PhysicalControlSide];
  return ['port', 'starboard'];
}

function wingSideSpan(design: AircraftDesign, side: 'port' | 'starboard'): number {
  const stations = physicalWingStations(design.wing);
  return side === 'port' ? Math.abs(stations[0].spanPositionM) : stations.at(-1)!.spanPositionM;
}

function maximumSpan(design: AircraftDesign, parent: ControlSurfaceParent, side: PhysicalControlSide): number {
  if (parent === 'wing') return side === 'center' ? 0 : wingSideSpan(design, side);
  if (parent === 'horizontal-tail') return design.horizontalTail.stations.at(-1)!.spanPositionM;
  return design.verticalTail.stations.at(-1)!.spanPositionM;
}

function parentPanelBoundaries(design: AircraftDesign, parent: ControlSurfaceParent, side: PhysicalControlSide): number[] {
  if (parent === 'horizontal-tail') return design.horizontalTail.stations.map((station) => station.spanPositionM);
  if (parent === 'vertical-tail') return design.verticalTail.stations.map((station) => station.spanPositionM);
  const distances = physicalWingStations(design.wing)
    .filter((station) => side === 'port' ? station.spanPositionM <= tolerance : station.spanPositionM >= -tolerance)
    .map((station) => Math.abs(station.spanPositionM));
  return [...new Set(distances)].sort((a, b) => a - b);
}

function operationError(surface: ControlSurfaceDefinition): string | undefined {
  if (surface.kind === 'aileron' && surface.operation !== 'differential' && surface.operation !== 'independent') return 'Ailerons require differential or independent operation.';
  if ((surface.kind === 'flap' || surface.kind === 'elevator') && surface.operation !== 'symmetric' && surface.operation !== 'independent') return `${surface.kind === 'flap' ? 'Flaps' : 'Elevators'} require symmetric or independent operation.`;
  if (surface.kind === 'rudder' && surface.operation !== 'independent') return 'Rudders require independent operation.';
  if (surface.parentSurface === 'vertical-tail' && surface.side !== 'center') return 'Vertical-tail controls must use the center side.';
  if (surface.parentSurface !== 'vertical-tail' && surface.operation === 'independent' && surface.side !== 'port' && surface.side !== 'starboard') return 'Independent horizontal controls must select port or starboard.';
  if (surface.parentSurface !== 'vertical-tail' && surface.operation !== 'independent' && surface.side !== 'both') return 'Linked horizontal controls must use both sides.';
  return undefined;
}

export function validateControlSurfaceModel(design: AircraftDesign, model: ControlSurfaceModel = design.controlSurfaces): ControlSurfaceValidation {
  const errors: string[] = [];
  if (model.modelVersion !== CONTROL_SURFACE_MODEL_VERSION) errors.push(`Unsupported control-surface model version ${String(model.modelVersion)}.`);
  const ids = new Set<string>();
  model.surfaces.forEach((surface, index) => {
    const label = surface.name.trim() || surface.id.trim() || `control ${index + 1}`;
    if (!surface.id.trim() || ids.has(surface.id)) errors.push(`Control surface ${index + 1} must have a unique nonempty id.`);
    ids.add(surface.id);
    if (!surface.name.trim()) errors.push(`Control surface ${surface.id || index + 1} requires a name.`);
    if (surface.parentSurface !== expectedParent(surface.kind)) errors.push(`${label} must use parent ${expectedParent(surface.kind)}.`);
    const operation = operationError(surface); if (operation) errors.push(`${label}: ${operation}`);
    if (!finite(surface.spanStartM) || !finite(surface.spanEndM) || surface.spanStartM < 0 || surface.spanEndM <= surface.spanStartM) errors.push(`${label} span limits must be finite with 0 <= start < end.`);
    if (!finite(surface.hingeChordFraction) || !finite(surface.chordFraction) || surface.hingeChordFraction <= 0 || surface.hingeChordFraction >= 1 || surface.chordFraction <= 0 || surface.chordFraction >= 1) errors.push(`${label} hinge and chord fractions must lie within (0, 1).`);
    else if (Math.abs(surface.hingeChordFraction + surface.chordFraction - 1) > tolerance) errors.push(`${label} is a plain trailing-edge surface, so hinge fraction plus chord fraction must equal 1.`);
    if (!finite(surface.minimumDeflectionDeg) || !finite(surface.maximumDeflectionDeg) || surface.minimumDeflectionDeg >= surface.maximumDeflectionDeg || surface.minimumDeflectionDeg > 0 || surface.maximumDeflectionDeg < 0 || Math.abs(surface.minimumDeflectionDeg) >= angleLimitDeg || Math.abs(surface.maximumDeflectionDeg) >= angleLimitDeg) errors.push(`${label} deflection limits must be finite, contain neutral, and remain within (-89, 89) deg.`);
    if (!finite(surface.currentDeflectionDeg) || surface.currentDeflectionDeg < surface.minimumDeflectionDeg || surface.currentDeflectionDeg > surface.maximumDeflectionDeg) errors.push(`${label} current deflection must lie within its minimum and maximum limits.`);
    for (const side of physicalSides(surface)) {
      const limit = maximumSpan(design, surface.parentSurface, side);
      if (finite(surface.spanEndM) && surface.spanEndM > limit + tolerance) errors.push(`${label} end station ${surface.spanEndM.toFixed(3)} m exceeds the ${side} ${surface.parentSurface} limit ${limit.toFixed(3)} m.`);
      const crossesBreak = parentPanelBoundaries(design, surface.parentSurface, side).some((boundary) => boundary > surface.spanStartM + tolerance && boundary < surface.spanEndM - tolerance);
      if (crossesBreak) errors.push(`${label} crosses a ${surface.parentSurface} station break. A rigid control must remain within one parent panel.`);
    }
  });
  const enabled = model.surfaces.filter((surface) => surface.enabled);
  for (let firstIndex = 0; firstIndex < enabled.length; firstIndex += 1) for (let secondIndex = firstIndex + 1; secondIndex < enabled.length; secondIndex += 1) {
    const first = enabled[firstIndex]; const second = enabled[secondIndex];
    if (first.parentSurface !== second.parentSurface) continue;
    const sharedSide = physicalSides(first).some((side) => physicalSides(second).includes(side));
    const spanOverlap = Math.min(first.spanEndM, second.spanEndM) - Math.max(first.spanStartM, second.spanStartM);
    if (sharedSide && spanOverlap > tolerance) errors.push(`${first.name} overlaps ${second.name} on the ${first.parentSurface}. Disable, delete, or separate their span ranges.`);
  }
  const uniqueErrors = [...new Set(errors)];
  return { valid: uniqueErrors.length === 0, errors: uniqueErrors };
}

function accepted(design: AircraftDesign, model: ControlSurfaceModel, selectedControlSurfaceId?: string): ControlSurfaceEditResult {
  const validation = validateControlSurfaceModel({ ...design, controlSurfaces: model }, model);
  return validation.valid ? { model, errors: [], selectedControlSurfaceId } : { errors: validation.errors };
}

function uniqueControlId(model: ControlSurfaceModel, kind: ControlSurfaceKind): string {
  const ids = new Set(model.surfaces.map((surface) => surface.id)); let index = 1;
  while (ids.has(`${kind}-${index}`)) index += 1;
  return `${kind}-${index}`;
}

function defaultSpanRange(design: AircraftDesign, kind: ControlSurfaceKind): [number, number] {
  if (kind === 'rudder' || kind === 'elevator') {
    const boundaries = kind === 'rudder' ? design.verticalTail.stations.map((station) => station.spanPositionM) : design.horizontalTail.stations.map((station) => station.spanPositionM);
    const from = boundaries[0]; const to = boundaries[1]; return [Number(interpolate(from, to, 0.1).toFixed(6)), Number(interpolate(from, to, 0.9).toFixed(6))];
  }
  const boundaries = parentPanelBoundaries(design, 'wing', 'starboard');
  const panelIndex = kind === 'aileron' ? boundaries.length - 2 : 0;
  const from = boundaries[Math.max(0, panelIndex)]; const to = boundaries[Math.max(1, panelIndex + 1)];
  const singlePanel = boundaries.length === 2;
  const range: [number, number] = kind === 'aileron'
    ? [interpolate(from, to, singlePanel ? 0.6 : 0.25), interpolate(from, to, 0.9)]
    : [interpolate(from, to, 0.1), interpolate(from, to, singlePanel ? 0.5 : 0.55)];
  return range.map((value) => Number(value.toFixed(6))) as [number, number];
}

export function addControlSurface(design: AircraftDesign, kind: ControlSurfaceKind): ControlSurfaceEditResult {
  const model = design.controlSurfaces; const [spanStartM, spanEndM] = defaultSpanRange(design, kind);
  const operation = kind === 'aileron' ? 'differential' : kind === 'rudder' ? 'independent' : 'symmetric';
  const side = kind === 'rudder' ? 'center' : 'both';
  const chordFraction = kind === 'aileron' ? 0.25 : 0.3;
  const id = uniqueControlId(model, kind);
  const surface: ControlSurfaceDefinition = {
    id, name: `${kind[0].toUpperCase()}${kind.slice(1)} ${model.surfaces.filter((item) => item.kind === kind).length + 1}`,
    kind, parentSurface: expectedParent(kind), enabled: true, spanStartM, spanEndM,
    chordFraction, hingeChordFraction: 1 - chordFraction,
    minimumDeflectionDeg: kind === 'flap' ? 0 : -25, maximumDeflectionDeg: kind === 'flap' ? 40 : 25,
    currentDeflectionDeg: 0, operation, side,
  };
  return accepted(design, { ...model, surfaces: [...model.surfaces.map((item) => ({ ...item })), surface] }, id);
}

export function editControlSurface(design: AircraftDesign, id: string, patch: Partial<Omit<ControlSurfaceDefinition, 'id' | 'kind' | 'parentSurface'>>): ControlSurfaceEditResult {
  const index = design.controlSurfaces.surfaces.findIndex((surface) => surface.id === id);
  if (index < 0) return { errors: [`Control surface "${id}" was not found.`] };
  const current = design.controlSurfaces.surfaces[index]; const synchronizedPatch = { ...patch };
  if (patch.chordFraction !== undefined && patch.hingeChordFraction === undefined) synchronizedPatch.hingeChordFraction = 1 - patch.chordFraction;
  if (patch.hingeChordFraction !== undefined && patch.chordFraction === undefined) synchronizedPatch.chordFraction = 1 - patch.hingeChordFraction;
  if (patch.operation !== undefined) {
    if (patch.operation === 'independent' && current.parentSurface !== 'vertical-tail' && (patch.side === undefined || patch.side === 'both')) synchronizedPatch.side = 'starboard';
    if (patch.operation !== 'independent' && current.parentSurface !== 'vertical-tail') synchronizedPatch.side = 'both';
  }
  const surfaces = design.controlSurfaces.surfaces.map((surface, surfaceIndex) => surfaceIndex === index ? { ...surface, ...synchronizedPatch } : { ...surface });
  return accepted(design, { ...design.controlSurfaces, surfaces }, id);
}

export function deleteControlSurface(design: AircraftDesign, id: string): ControlSurfaceEditResult {
  if (!design.controlSurfaces.surfaces.some((surface) => surface.id === id)) return { errors: [`Control surface "${id}" was not found.`] };
  const surfaces = design.controlSurfaces.surfaces.filter((surface) => surface.id !== id).map((surface) => ({ ...surface }));
  return accepted(design, { ...design.controlSurfaces, surfaces }, surfaces[0]?.id);
}

export function neutralizeControlSurfaces(design: AircraftDesign): ControlSurfaceEditResult {
  const surfaces = design.controlSurfaces.surfaces.map((surface) => ({ ...surface, currentDeflectionDeg: 0 }));
  return accepted(design, { ...design.controlSurfaces, surfaces }, undefined);
}

type ParentSample = {
  chordM: number;
  point: (xOverChord: number, zOverChord: number) => AircraftPoint3;
  profilePoint: (xOverChord: number, side: AirfoilSurfaceSide) => AircraftPoint3;
};

function blendAirfoilPoint(sample: Pick<WingSectionSample, 'fromAirfoilId' | 'toAirfoilId' | 'airfoilBlendFraction'>, xOverChord: number, side: AirfoilSurfaceSide): AirfoilPoint2 {
  const from = naca4PointAtChordFraction(sample.fromAirfoilId, xOverChord, side);
  const to = naca4PointAtChordFraction(sample.toAirfoilId, xOverChord, side);
  return [interpolate(from[0], to[0], sample.airfoilBlendFraction), interpolate(from[1], to[1], sample.airfoilBlendFraction)];
}

function parentSample(design: AircraftDesign, parent: ControlSurfaceParent, side: PhysicalControlSide, distanceM: number): ParentSample {
  if (parent === 'wing') {
    const spanPositionM = side === 'port' ? -distanceM : distanceM; const sample = sampleWingSectionAtSpan(design.wing, spanPositionM);
    return {
      chordM: sample.station.chordM,
      point: (x, z) => transformWingAirfoilPoint(sample.station, [x, z]),
      profilePoint: (x, surfaceSide) => transformWingAirfoilPoint(sample.station, blendAirfoilPoint(sample, x, surfaceSide)),
    };
  }
  if (parent === 'horizontal-tail') {
    const sample = sampleHorizontalTailSectionAtDistance(design.horizontalTail, side as 'port' | 'starboard', distanceM);
    return { chordM: sample.station.chordM, point: (x, z) => transformWingAirfoilPoint(sample.station, [x, z]), profilePoint: (x, surfaceSide) => transformWingAirfoilPoint(sample.station, blendAirfoilPoint(sample, x, surfaceSide)) };
  }
  const sample = sampleVerticalTailSection(design.verticalTail, distanceM);
  return {
    chordM: sample.station.chordM,
    point: (x, y) => transformVerticalTailAirfoilPoint(design.verticalTail, sample.station, [x, y]),
    profilePoint: (x, surfaceSide) => transformVerticalTailAirfoilPoint(design.verticalTail, sample.station, blendAirfoilPoint(sample, x, surfaceSide)),
  };
}

function physicalDeflection(surface: ControlSurfaceDefinition, side: PhysicalControlSide): number {
  if (!surface.enabled) return 0;
  if (side === 'center' || side === 'starboard') return surface.currentDeflectionDeg;
  return surface.operation === 'differential' ? surface.currentDeflectionDeg : -surface.currentDeflectionDeg;
}

function subtract(a: AircraftPoint3, b: AircraftPoint3): [number, number, number] { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a: AircraftPoint3, b: readonly [number, number, number]): AircraftPoint3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a: readonly [number, number, number], factor: number): [number, number, number] { return [a[0] * factor, a[1] * factor, a[2] * factor]; }
function dot(a: readonly [number, number, number], b: readonly [number, number, number]): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a: readonly [number, number, number], b: readonly [number, number, number]): [number, number, number] { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function magnitude(a: readonly [number, number, number]): number { return Math.hypot(a[0], a[1], a[2]); }

export function rotatePointAboutAxis(point: AircraftPoint3, axisStart: AircraftPoint3, axisEnd: AircraftPoint3, angleDeg: number): AircraftPoint3 {
  const axis = subtract(axisEnd, axisStart); const length = magnitude(axis);
  if (length <= tolerance) throw new RangeError('Control-surface hinge axis must have nonzero length.');
  const unit = scale(axis, 1 / length); const relative = subtract(point, axisStart); const angle = angleDeg * Math.PI / 180;
  const rotated = add(add(scale(relative, Math.cos(angle)), scale(cross(unit, relative), Math.sin(angle))), scale(unit, dot(unit, relative) * (1 - Math.cos(angle))));
  return add(axisStart, rotated);
}

function pointLineDistance(point: AircraftPoint3, lineStart: AircraftPoint3, lineEnd: AircraftPoint3): number {
  const line = subtract(lineEnd, lineStart); return magnitude(cross(subtract(point, lineStart), line)) / magnitude(line);
}

function trailingEdgeRing(sample: ParentSample, hingeChordFraction: number): AircraftPoint3[] {
  const fractions = Array.from({ length: chordwiseIntervals + 1 }, (_, index) => hingeChordFraction + (1 - hingeChordFraction) * (1 - Math.cos(Math.PI * index / chordwiseIntervals)) / 2);
  return [...fractions.slice().reverse().map((fraction) => sample.profilePoint(fraction, 'upper')), ...fractions.map((fraction) => sample.profilePoint(fraction, 'lower'))];
}

function instanceProperties(design: AircraftDesign, surface: ControlSurfaceDefinition, side: PhysicalControlSide): ControlSurfaceInstanceProperties {
  const start = parentSample(design, surface.parentSurface, side, surface.spanStartM); const end = parentSample(design, surface.parentSurface, side, surface.spanEndM);
  const hingeStart = start.point(surface.hingeChordFraction, 0); const hingeEnd = end.point(surface.hingeChordFraction, 0);
  const middle = parentSample(design, surface.parentSurface, side, (surface.spanStartM + surface.spanEndM) / 2).point(surface.hingeChordFraction, 0);
  return {
    key: `${surface.id}-${side}`, side, projectedSpanM: surface.spanEndM - surface.spanStartM,
    projectedAreaM2: (surface.spanEndM - surface.spanStartM) * (start.chordM + end.chordM) * surface.chordFraction / 2,
    physicalDeflectionDeg: physicalDeflection(surface, side), hingeStart, hingeEnd,
    hingeStraightnessDeviationM: pointLineDistance(middle, hingeStart, hingeEnd),
  };
}

export function calculateControlSurfaceProperties(design: AircraftDesign, surface: ControlSurfaceDefinition): ControlSurfaceProperties {
  const validation = validateControlSurfaceModel(design);
  if (!validation.valid) throw new RangeError(validation.errors.join(' '));
  const instances = physicalSides(surface).map((side) => instanceProperties(design, surface, side));
  const warnings = instances.filter((instance) => instance.hingeStraightnessDeviationM > 1e-6).map((instance) => `${instance.side} hinge uses a straight endpoint-axis approximation; midpoint deviation is ${(instance.hingeStraightnessDeviationM * 1000).toFixed(2)} mm.`);
  return {
    id: surface.id,
    totalProjectedSpanM: instances.reduce((sum, instance) => sum + instance.projectedSpanM, 0),
    projectedAreaM2: instances.reduce((sum, instance) => sum + instance.projectedAreaM2, 0),
    instances,
    warnings,
  };
}

export function buildControlSurfaceGeometry(design: AircraftDesign, surface: ControlSurfaceDefinition): ControlSurfaceGeometryInstance[] {
  const properties = calculateControlSurfaceProperties(design, surface);
  return properties.instances.map((instance) => {
    const start = parentSample(design, surface.parentSurface, instance.side, surface.spanStartM); const end = parentSample(design, surface.parentSurface, instance.side, surface.spanEndM);
    const startRing = trailingEdgeRing(start, surface.hingeChordFraction); const endRing = trailingEdgeRing(end, surface.hingeChordFraction); const ringSize = startRing.length;
    const neutralVertices: AircraftPoint3[] = [...startRing, ...endRing]; const indices: number[] = [];
    for (let index = 0; index < ringSize; index += 1) {
      const next = (index + 1) % ringSize; indices.push(index, ringSize + index, next, next, ringSize + index, ringSize + next);
    }
    for (const ringOffset of [0, ringSize]) {
      const centerIndex = neutralVertices.length;
      const ring = neutralVertices.slice(ringOffset, ringOffset + ringSize);
      const center = ring.reduce<[number, number, number]>((sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]], [0, 0, 0]).map((value) => value / ringSize) as [number, number, number];
      neutralVertices.push(center);
      for (let index = 0; index < ringSize; index += 1) { const next = (index + 1) % ringSize; if (ringOffset === 0) indices.push(centerIndex, index, next); else indices.push(centerIndex, ringOffset + next, ringOffset + index); }
    }
    if (instance.side === 'port') for (let index = 0; index < indices.length; index += 3) [indices[index + 1], indices[index + 2]] = [indices[index + 2], indices[index + 1]];
    const deflectedVertices = neutralVertices.map((point) => rotatePointAboutAxis(point, instance.hingeStart, instance.hingeEnd, instance.physicalDeflectionDeg));
    return { ...instance, controlSurfaceId: surface.id, kind: surface.kind, neutralVertices, deflectedVertices, indices };
  });
}
