import type { AircraftDesign, WingGeometry, WingSection, WingStation } from '../domain/types';
import { parseNaca4Designation } from './airfoil';
import { migrateLegacyFuselage, type LegacyFuselageDefinition } from './fuselageGeometry';
import { migrateLegacyHorizontalTail, migrateLegacyVerticalTail, type LegacyHorizontalTailDefinition, type LegacyVerticalTailDefinition } from './tailGeometry';

export const WING_GEOMETRY_MODEL_VERSION = 2 as const;
const angleLimitDeg = 89;
const tolerance = 1e-9;

export type LegacyWingDefinition = {
  spanM: number;
  rootChordM: number;
  taperRatio: number;
  sweepDeg: number;
  dihedralDeg: number;
  twistDeg: number;
  airfoil: string;
  rootLeadingEdgeXM: number;
  verticalPositionM: number;
};

export type WingGeometryValidation = { valid: boolean; errors: string[] };

export type PhysicalWingStation = WingStation & { verticalPositionM: number };

export type WingSectionProperties = {
  id: string;
  fromStationId: string;
  toStationId: string;
  projectedSpanM: number;
  projectedAreaM2: number;
  taperRatio: number;
  leadingEdgeSweepDeg: number;
  dihedralDeg: number;
  meanAerodynamicChordM: number;
  meanAerodynamicChordSpanPositionM: number;
  meanAerodynamicChordLeadingEdgeXM: number;
  meanAerodynamicChordQuarterChordXM: number;
};

export type WingReferenceProperties = {
  totalSpanM: number;
  projectedAreaM2: number;
  aspectRatio: number;
  meanAerodynamicChordM: number;
  meanAerodynamicChordLeadingEdgeXM: number;
  meanAerodynamicChordQuarterChordXM: number;
  meanAerodynamicChordSpanPositionM: number;
  rootChordM: number;
  tipChordM: number;
  sections: WingSectionProperties[];
};

export type WingSpanwiseLocation = {
  spanPositionM: number;
  chordM: number;
  leadingEdgeXM: number;
  quarterChordXM: number;
  verticalPositionM: number;
  geometricTwistDeg: number;
  airfoilId: string;
};

function finite(value: number): boolean { return Number.isFinite(value); }

export function migrateLegacyWing(legacy: LegacyWingDefinition): WingGeometry {
  const halfSpanM = legacy.spanM / 2;
  return {
    modelVersion: WING_GEOMETRY_MODEL_VERSION,
    symmetry: 'symmetric',
    verticalPositionM: legacy.verticalPositionM,
    stations: [
      { id: 'wing-root', spanPositionM: 0, chordM: legacy.rootChordM, leadingEdgeXM: legacy.rootLeadingEdgeXM, geometricTwistDeg: 0, airfoilId: legacy.airfoil },
      {
        id: 'wing-tip', spanPositionM: halfSpanM, chordM: legacy.rootChordM * legacy.taperRatio,
        leadingEdgeXM: legacy.rootLeadingEdgeXM + halfSpanM * Math.tan(legacy.sweepDeg * Math.PI / 180),
        geometricTwistDeg: legacy.twistDeg, airfoilId: legacy.airfoil,
      },
    ],
    sections: [{ id: 'wing-panel', fromStationId: 'wing-root', toStationId: 'wing-tip', dihedralDeg: legacy.dihedralDeg }],
  };
}

export function validateWingGeometry(wing: WingGeometry): WingGeometryValidation {
  const errors: string[] = [];
  if (wing.modelVersion !== WING_GEOMETRY_MODEL_VERSION) errors.push(`Unsupported wing geometry model version ${String(wing.modelVersion)}.`);
  if (!finite(wing.verticalPositionM)) errors.push('Wing vertical position must be finite.');
  if (wing.stations.length < 2) errors.push('A wing requires at least two stations.');
  const stationIds = new Set<string>();
  wing.stations.forEach((station, index) => {
    if (!station.id.trim() || stationIds.has(station.id)) errors.push(`Wing station ${index} must have a unique nonempty id.`);
    stationIds.add(station.id);
    if (!finite(station.spanPositionM)) errors.push(`Wing station ${station.id || index} span position must be finite.`);
    if (!finite(station.chordM) || station.chordM <= 0) errors.push(`Wing station ${station.id || index} chord must be positive and finite.`);
    if (!finite(station.leadingEdgeXM)) errors.push(`Wing station ${station.id || index} leading-edge x must be finite.`);
    if (!finite(station.geometricTwistDeg) || Math.abs(station.geometricTwistDeg) >= angleLimitDeg) errors.push(`Wing station ${station.id || index} twist must be finite and within (-89, 89) deg.`);
    if (!station.airfoilId.trim()) errors.push(`Wing station ${station.id || index} requires an airfoil identifier.`);
    else if (!parseNaca4Designation(station.airfoilId)) errors.push(`Wing station ${station.id || index} airfoil must be a supported positive-thickness NACA four-digit designation.`);
    if (index > 0 && station.spanPositionM <= wing.stations[index - 1].spanPositionM) errors.push('Wing stations must be strictly ordered by increasing span position.');
  });
  if (wing.symmetry === 'symmetric') {
    if (wing.stations[0] && Math.abs(wing.stations[0].spanPositionM) > tolerance) errors.push('A symmetric wing must begin at span position 0.');
    if (wing.stations.some((station) => station.spanPositionM < -tolerance)) errors.push('Symmetric-wing source stations must use nonnegative span positions.');
  } else if (wing.stations.length >= 2) {
    if (wing.stations[0].spanPositionM >= 0 || wing.stations[wing.stations.length - 1].spanPositionM <= 0) errors.push('An asymmetric wing must span negative and positive y positions.');
    if (!wing.stations.some((station) => Math.abs(station.spanPositionM) <= tolerance)) errors.push('An asymmetric wing requires a station at span position 0.');
  }
  if (wing.sections.length !== Math.max(0, wing.stations.length - 1)) errors.push('Wing sections must connect every adjacent station exactly once.');
  const sectionIds = new Set<string>();
  wing.sections.forEach((section, index) => {
    const from = wing.stations[index]; const to = wing.stations[index + 1];
    if (!section.id.trim() || sectionIds.has(section.id)) errors.push(`Wing section ${index} must have a unique nonempty id.`);
    sectionIds.add(section.id);
    if (!from || !to || section.fromStationId !== from.id || section.toStationId !== to.id) errors.push(`Wing section ${section.id || index} must connect adjacent ordered stations.`);
    if (!finite(section.dihedralDeg) || Math.abs(section.dihedralDeg) >= angleLimitDeg) errors.push(`Wing section ${section.id || index} dihedral must be finite and within (-89, 89) deg.`);
  });
  return { valid: errors.length === 0, errors };
}

function sourceStationsWithVerticalPosition(wing: WingGeometry): PhysicalWingStation[] {
  const validation = validateWingGeometry(wing);
  if (!validation.valid) throw new RangeError(validation.errors.join(' '));
  const rootIndex = wing.symmetry === 'symmetric' ? 0 : wing.stations.findIndex((station) => Math.abs(station.spanPositionM) <= tolerance);
  const result = wing.stations.map((station) => ({ ...station, verticalPositionM: wing.verticalPositionM }));
  for (let index = rootIndex; index < result.length - 1; index += 1) {
    const dy = result[index + 1].spanPositionM - result[index].spanPositionM;
    result[index + 1].verticalPositionM = result[index].verticalPositionM + dy * Math.tan(wing.sections[index].dihedralDeg * Math.PI / 180);
  }
  for (let index = rootIndex - 1; index >= 0; index -= 1) {
    const dy = result[index + 1].spanPositionM - result[index].spanPositionM;
    result[index].verticalPositionM = result[index + 1].verticalPositionM - dy * Math.tan(wing.sections[index].dihedralDeg * Math.PI / 180);
  }
  return result;
}

export function physicalWingStations(wing: WingGeometry): PhysicalWingStation[] {
  const source = sourceStationsWithVerticalPosition(wing);
  if (wing.symmetry === 'asymmetric') return source;
  const mirrored = source.slice(1).reverse().map((station) => ({ ...station, id: `${station.id}-mirrored`, spanPositionM: -station.spanPositionM }));
  return [...mirrored, ...source];
}

function sectionProperties(from: PhysicalWingStation, to: PhysicalWingStation, section: WingSection, id = section.id): WingSectionProperties {
  const dy = to.spanPositionM - from.spanPositionM;
  const area = dy * (from.chordM + to.chordM) / 2;
  const chordDelta = to.chordM - from.chordM;
  const chordSquaredIntegral = dy * (from.chordM ** 2 + from.chordM * to.chordM + to.chordM ** 2) / 3;
  const mac = chordSquaredIntegral / area;
  const chordFirstMoment = dy ** 2 * (from.chordM / 2 + chordDelta / 3);
  const macY = from.spanPositionM + chordFirstMoment / area;
  const fraction = (macY - from.spanPositionM) / dy;
  const leadingEdge = from.leadingEdgeXM + fraction * (to.leadingEdgeXM - from.leadingEdgeXM);
  const quarterChordIntegral = dy * (
    from.chordM * (from.leadingEdgeXM + 0.25 * from.chordM) +
    (from.chordM * (to.leadingEdgeXM + 0.25 * to.chordM) + to.chordM * (from.leadingEdgeXM + 0.25 * from.chordM)) / 2 +
    to.chordM * (to.leadingEdgeXM + 0.25 * to.chordM)
  ) / 3;
  const quarterChord = quarterChordIntegral / area;
  return {
    id, fromStationId: from.id, toStationId: to.id, projectedSpanM: dy, projectedAreaM2: area,
    taperRatio: to.chordM / from.chordM,
    leadingEdgeSweepDeg: Math.atan2(to.leadingEdgeXM - from.leadingEdgeXM, dy) * 180 / Math.PI,
    dihedralDeg: section.dihedralDeg, meanAerodynamicChordM: mac,
    meanAerodynamicChordSpanPositionM: macY, meanAerodynamicChordLeadingEdgeXM: leadingEdge,
    meanAerodynamicChordQuarterChordXM: quarterChord,
  };
}

export function calculateWingReferenceProperties(wing: WingGeometry): WingReferenceProperties {
  const stations = physicalWingStations(wing);
  const sourceSectionByPair = new Map(wing.sections.map((section) => [`${section.fromStationId}|${section.toStationId}`, section]));
  const sections: WingSectionProperties[] = [];
  for (let index = 0; index < stations.length - 1; index += 1) {
    const from = stations[index]; const to = stations[index + 1];
    let section = sourceSectionByPair.get(`${from.id}|${to.id}`);
    if (!section && wing.symmetry === 'symmetric') {
      const sourceIndex = wing.stations.length - 2 - index;
      const source = wing.sections[sourceIndex];
      section = { ...source, dihedralDeg: -source.dihedralDeg };
    }
    if (!section) throw new RangeError('Physical wing stations are not connected by a defined section.');
    sections.push(sectionProperties(from, to, section, index < wing.stations.length - 1 && wing.symmetry === 'symmetric' ? `${section.id}-mirrored` : section.id));
  }
  const area = sections.reduce((sum, section) => sum + section.projectedAreaM2, 0);
  const span = stations[stations.length - 1].spanPositionM - stations[0].spanPositionM;
  const mac = sections.reduce((sum, section) => sum + section.meanAerodynamicChordM * section.projectedAreaM2, 0) / area;
  const quarterChord = sections.reduce((sum, section) => sum + section.meanAerodynamicChordQuarterChordXM * section.projectedAreaM2, 0) / area;
  const macY = sections.reduce((sum, section) => sum + (wing.symmetry === 'symmetric' ? Math.abs(section.meanAerodynamicChordSpanPositionM) : section.meanAerodynamicChordSpanPositionM) * section.projectedAreaM2, 0) / area;
  const root = wing.stations.find((station) => Math.abs(station.spanPositionM) <= tolerance)!;
  const tips = [wing.stations[0], wing.stations[wing.stations.length - 1]].filter((station) => station !== root);
  return {
    totalSpanM: span, projectedAreaM2: area, aspectRatio: span ** 2 / area,
    meanAerodynamicChordM: mac, meanAerodynamicChordLeadingEdgeXM: quarterChord - 0.25 * mac,
    meanAerodynamicChordQuarterChordXM: quarterChord, meanAerodynamicChordSpanPositionM: macY,
    rootChordM: root.chordM, tipChordM: tips.reduce((sum, station) => sum + station.chordM, 0) / tips.length,
    sections,
  };
}

export function wingLocationAtSpan(wing: WingGeometry, spanPositionM: number): WingSpanwiseLocation {
  const stations = physicalWingStations(wing);
  if (!finite(spanPositionM) || spanPositionM < stations[0].spanPositionM - tolerance || spanPositionM > stations[stations.length - 1].spanPositionM + tolerance) throw new RangeError('Span position lies outside the wing.');
  const exact = stations.find((station) => Math.abs(station.spanPositionM - spanPositionM) <= tolerance);
  if (exact) return { ...exact, quarterChordXM: exact.leadingEdgeXM + 0.25 * exact.chordM };
  const index = stations.findIndex((station) => station.spanPositionM > spanPositionM) - 1;
  const from = stations[index]; const to = stations[index + 1]; const fraction = (spanPositionM - from.spanPositionM) / (to.spanPositionM - from.spanPositionM);
  const interpolate = (a: number, b: number) => a + fraction * (b - a);
  return {
    spanPositionM, chordM: interpolate(from.chordM, to.chordM), leadingEdgeXM: interpolate(from.leadingEdgeXM, to.leadingEdgeXM),
    quarterChordXM: interpolate(from.leadingEdgeXM + 0.25 * from.chordM, to.leadingEdgeXM + 0.25 * to.chordM),
    verticalPositionM: interpolate(from.verticalPositionM, to.verticalPositionM), geometricTwistDeg: interpolate(from.geometricTwistDeg, to.geometricTwistDeg),
    airfoilId: fraction < 0.5 ? from.airfoilId : to.airfoilId,
  };
}

export type LegacyWingEdit = keyof LegacyWingDefinition;

export function legacyWingView(wing: WingGeometry): LegacyWingDefinition {
  const properties = calculateWingReferenceProperties(wing);
  const root = wing.stations.find((station) => Math.abs(station.spanPositionM) <= tolerance)!;
  const tip = wing.symmetry === 'symmetric' ? wing.stations[wing.stations.length - 1] : wing.stations[wing.stations.length - 1];
  return {
    spanM: properties.totalSpanM, rootChordM: root.chordM, taperRatio: tip.chordM / root.chordM,
    sweepDeg: Math.round(Math.atan2(tip.leadingEdgeXM - root.leadingEdgeXM, Math.abs(tip.spanPositionM)) * 180 / Math.PI * 1e12) / 1e12,
    dihedralDeg: wing.sections.find((section) => wing.stations.find((station) => station.id === section.fromStationId)?.spanPositionM! >= 0)?.dihedralDeg ?? 0,
    twistDeg: tip.geometricTwistDeg, airfoil: root.airfoilId, rootLeadingEdgeXM: root.leadingEdgeXM, verticalPositionM: wing.verticalPositionM,
  };
}

/** Preserves the original simple inspector by transforming the authoritative station model in place. */
export function updateWingFromLegacyField(wing: WingGeometry, field: LegacyWingEdit, value: number | string): WingGeometry {
  const view = legacyWingView(wing);
  if (field === 'verticalPositionM') {
    const updated = { ...wing, verticalPositionM: value as number };
    return validateWingGeometry(updated).valid ? updated : wing;
  }
  const stations = wing.stations.map((station) => ({ ...station }));
  const sections = wing.sections.map((section) => ({ ...section }));
  const root = stations.find((station) => Math.abs(station.spanPositionM) <= tolerance)!;
  const maximumAbsY = Math.max(...stations.map((station) => Math.abs(station.spanPositionM)));
  if (field === 'spanM') {
    const scale = (value as number) / view.spanM;
    stations.forEach((station) => { station.spanPositionM *= scale; });
  } else if (field === 'rootChordM') {
    const scale = (value as number) / root.chordM;
    stations.forEach((station) => { station.chordM *= scale; });
  } else if (field === 'taperRatio') {
    const targetTipChord = root.chordM * (value as number); const currentTipChord = root.chordM * view.taperRatio;
    stations.forEach((station) => { station.chordM += Math.abs(station.spanPositionM) / maximumAbsY * (targetTipChord - currentTipChord); });
  } else if (field === 'sweepDeg') {
    const tangent = Math.tan((value as number) * Math.PI / 180);
    stations.forEach((station) => { station.leadingEdgeXM = root.leadingEdgeXM + Math.abs(station.spanPositionM) * tangent; });
  } else if (field === 'dihedralDeg') {
    sections.forEach((section, index) => { section.dihedralDeg = wing.stations[index].spanPositionM < 0 ? -(value as number) : value as number; });
  } else if (field === 'twistDeg') {
    stations.forEach((station) => { station.geometricTwistDeg = root.geometricTwistDeg + Math.abs(station.spanPositionM) / maximumAbsY * ((value as number) - root.geometricTwistDeg); });
  } else if (field === 'rootLeadingEdgeXM') {
    const delta = (value as number) - root.leadingEdgeXM;
    stations.forEach((station) => { station.leadingEdgeXM += delta; });
  } else if (field === 'airfoil') {
    stations.forEach((station) => { station.airfoilId = value as string; });
  }
  const updated = { ...wing, stations, sections };
  return validateWingGeometry(updated).valid ? updated : wing;
}

type LegacyGeometryComponents = {
  fuselage: AircraftDesign['fuselage'] | LegacyFuselageDefinition;
  horizontalTail: AircraftDesign['horizontalTail'] | LegacyHorizontalTailDefinition;
  verticalTail: AircraftDesign['verticalTail'] | LegacyVerticalTailDefinition;
};

export type LegacyAircraftDesignV1 = Omit<AircraftDesign, 'schemaVersion' | 'wing' | 'controlSurfaces' | keyof LegacyGeometryComponents> & LegacyGeometryComponents & { schemaVersion: 1; wing: LegacyWingDefinition; controlSurfaces?: AircraftDesign['controlSurfaces'] };
export type LegacyAircraftDesignV2 = Omit<AircraftDesign, 'schemaVersion' | keyof LegacyGeometryComponents> & LegacyGeometryComponents & { schemaVersion: 2 };

function migrateGeometryComponents(design: LegacyGeometryComponents) {
  return {
    fuselage: 'modelVersion' in design.fuselage ? design.fuselage : migrateLegacyFuselage(design.fuselage),
    horizontalTail: 'modelVersion' in design.horizontalTail ? design.horizontalTail : migrateLegacyHorizontalTail(design.horizontalTail),
    verticalTail: 'modelVersion' in design.verticalTail ? design.verticalTail : migrateLegacyVerticalTail(design.verticalTail),
  };
}

export function migrateAircraftDesignV1(design: LegacyAircraftDesignV1): AircraftDesign {
  return { ...design, ...migrateGeometryComponents(design), schemaVersion: 3, wing: migrateLegacyWing(design.wing), controlSurfaces: design.controlSurfaces ?? { modelVersion: 1, surfaces: [] } };
}

export function migrateAircraftDesignV2(design: LegacyAircraftDesignV2): AircraftDesign {
  return { ...design, ...migrateGeometryComponents(design), schemaVersion: 3 };
}
