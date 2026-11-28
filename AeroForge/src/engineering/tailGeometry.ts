import type { AircraftDesign, HorizontalTailGeometry, VerticalTailGeometry, WingGeometry, WingSection, WingStation } from '../domain/types';
import type { AirfoilLibrary } from '../domain/airfoilData';
import { airfoilExists } from './airfoilData';
import { calculateWingReferenceProperties, physicalWingStations, validateWingGeometry, wingLocationAtSpan, type PhysicalWingStation } from './wingGeometry';
import { buildWingLoftRings, interpolateAirfoilCoordinates, sampleWingSectionAtSpan, transformWingAirfoilPoint, type AircraftPoint3, type AirfoilPoint2, type WingLoftRing, type WingSectionSample } from './wingLoft';

export const TAIL_GEOMETRY_MODEL_VERSION = 1 as const;
const tolerance = 1e-9;
const angleLimitDeg = 89;

export type LegacyHorizontalTailDefinition = { spanM: number; rootChordM: number; taperRatio: number; sweepDeg: number; incidenceDeg: number; rootLeadingEdgeXM: number; verticalPositionM: number };
export type LegacyVerticalTailDefinition = { heightM: number; rootChordM: number; taperRatio: number; sweepDeg: number; rootLeadingEdgeXM: number; basePositionM: number };
export type TailValidation = { valid: boolean; errors: string[] };
export type VerticalTailSectionSample = { station: PhysicalWingStation; fromAirfoilId: string; toAirfoilId: string; airfoilBlendFraction: number; sectionIndex: number };
export type VerticalTailLoftRing = Omit<WingLoftRing, 'spanPositionM' | 'verticalPositionM'> & { heightPositionM: number; lateralPositionM: number; verticalPositionM: number };
export type TailReferenceProperties = {
  projectedAreaM2: number;
  spanM: number;
  aspectRatio: number;
  meanAerodynamicChordM: number;
  meanAerodynamicChordLeadingEdgeXM: number;
  meanAerodynamicChordQuarterChordXM: number;
  meanAerodynamicChordSpanPositionM: number;
  aerodynamicCenterM: AircraftPoint3;
};
export type EmpennageReferenceProperties = {
  horizontal: TailReferenceProperties;
  vertical: TailReferenceProperties;
  horizontalTailMomentArmM: number;
  verticalTailMomentArmM: number;
  horizontalTailVolumeCoefficient: number;
  verticalTailVolumeCoefficient: number;
};

function finite(value: number): boolean { return Number.isFinite(value); }
function interpolate(from: number, to: number, fraction: number): number { return from + fraction * (to - from); }

function validateSourceStations(stations: WingStation[], sections: WingSection[], label: string, allowDihedral: boolean, airfoilLibrary?: AirfoilLibrary, allowUnregisteredAirfoils = false): string[] {
  const errors: string[] = []; const stationIds = new Set<string>(); const sectionIds = new Set<string>();
  if (stations.length < 2) errors.push(`${label} requires at least root and tip stations.`);
  stations.forEach((station, index) => {
    if (!station.id.trim() || stationIds.has(station.id)) errors.push(`${label} station ${index + 1} must have a unique nonempty id.`); stationIds.add(station.id);
    if (!finite(station.spanPositionM) || station.spanPositionM < 0) errors.push(`${label} station ${station.id || index + 1} span position must be finite and nonnegative.`);
    if (index === 0 && Math.abs(station.spanPositionM) > tolerance) errors.push(`${label} root station must be at span position 0.`);
    if (index > 0 && station.spanPositionM <= stations[index - 1].spanPositionM) errors.push(`${label} stations must be strictly ordered root-to-tip.`);
    if (!finite(station.chordM) || station.chordM <= 0) errors.push(`${label} station ${station.id || index + 1} chord must be positive and finite.`);
    if (!finite(station.leadingEdgeXM)) errors.push(`${label} station ${station.id || index + 1} leading-edge x must be finite.`);
    if (!finite(station.geometricTwistDeg) || Math.abs(station.geometricTwistDeg) >= angleLimitDeg) errors.push(`${label} station ${station.id || index + 1} twist must remain within (-89, 89) deg.`);
    if (!allowUnregisteredAirfoils && !airfoilExists(airfoilLibrary, station.airfoilId)) errors.push(`${label} station ${station.id || index + 1} requires a supported NACA four-digit or registered imported airfoil.`);
  });
  if (sections.length !== Math.max(0, stations.length - 1)) errors.push(`${label} sections must connect every adjacent station.`);
  sections.forEach((section, index) => {
    if (!section.id.trim() || sectionIds.has(section.id)) errors.push(`${label} section ${index + 1} must have a unique nonempty id.`); sectionIds.add(section.id);
    if (section.fromStationId !== stations[index]?.id || section.toStationId !== stations[index + 1]?.id) errors.push(`${label} section ${section.id || index + 1} must connect its adjacent stations in order.`);
    if (!finite(section.dihedralDeg) || Math.abs(section.dihedralDeg) >= angleLimitDeg) errors.push(`${label} section ${section.id || index + 1} dihedral must remain within (-89, 89) deg.`);
    if (!allowDihedral && Math.abs(section.dihedralDeg) > tolerance) errors.push(`${label} conventional vertical sections do not support cant/dihedral; use 0 deg.`);
  });
  return errors;
}

export function validateHorizontalTailGeometry(tail: HorizontalTailGeometry, airfoilLibrary?: AirfoilLibrary, allowUnregisteredAirfoils = false): TailValidation {
  const errors = tail.modelVersion === TAIL_GEOMETRY_MODEL_VERSION ? [] : [`Unsupported horizontal-tail model version ${String(tail.modelVersion)}.`];
  if (!finite(tail.lateralPositionM) || !finite(tail.verticalPositionM)) errors.push('Horizontal-tail placement coordinates must be finite.');
  if (!finite(tail.incidenceDeg) || Math.abs(tail.incidenceDeg) >= angleLimitDeg) errors.push('Horizontal-tail incidence must remain within (-89, 89) deg.');
  errors.push(...validateSourceStations(tail.stations, tail.sections, 'Horizontal tail', true, airfoilLibrary, allowUnregisteredAirfoils));
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateVerticalTailGeometry(tail: VerticalTailGeometry, airfoilLibrary?: AirfoilLibrary, allowUnregisteredAirfoils = false): TailValidation {
  const errors = tail.modelVersion === TAIL_GEOMETRY_MODEL_VERSION ? [] : [`Unsupported vertical-tail model version ${String(tail.modelVersion)}.`];
  if (!finite(tail.lateralPositionM) || !finite(tail.baseVerticalPositionM)) errors.push('Vertical-tail placement coordinates must be finite.');
  errors.push(...validateSourceStations(tail.stations, tail.sections, 'Vertical tail', false, airfoilLibrary, allowUnregisteredAirfoils));
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function migrateLegacyHorizontalTail(legacy: LegacyHorizontalTailDefinition): HorizontalTailGeometry {
  const halfSpan = legacy.spanM / 2;
  return {
    modelVersion: TAIL_GEOMETRY_MODEL_VERSION, lateralPositionM: 0, verticalPositionM: legacy.verticalPositionM, incidenceDeg: legacy.incidenceDeg,
    stations: [
      { id: 'horizontal-tail-root', spanPositionM: 0, chordM: legacy.rootChordM, leadingEdgeXM: legacy.rootLeadingEdgeXM, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'horizontal-tail-tip', spanPositionM: halfSpan, chordM: legacy.rootChordM * legacy.taperRatio, leadingEdgeXM: legacy.rootLeadingEdgeXM + halfSpan * Math.tan(legacy.sweepDeg * Math.PI / 180), geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
    ],
    sections: [{ id: 'horizontal-tail-panel', fromStationId: 'horizontal-tail-root', toStationId: 'horizontal-tail-tip', dihedralDeg: 0 }],
  };
}

export function migrateLegacyVerticalTail(legacy: LegacyVerticalTailDefinition): VerticalTailGeometry {
  return {
    modelVersion: TAIL_GEOMETRY_MODEL_VERSION, lateralPositionM: 0, baseVerticalPositionM: legacy.basePositionM,
    stations: [
      { id: 'vertical-tail-root', spanPositionM: 0, chordM: legacy.rootChordM, leadingEdgeXM: legacy.rootLeadingEdgeXM, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'vertical-tail-tip', spanPositionM: legacy.heightM, chordM: legacy.rootChordM * legacy.taperRatio, leadingEdgeXM: legacy.rootLeadingEdgeXM + legacy.heightM * Math.tan(legacy.sweepDeg * Math.PI / 180), geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
    ],
    sections: [{ id: 'vertical-tail-panel', fromStationId: 'vertical-tail-root', toStationId: 'vertical-tail-tip', dihedralDeg: 0 }],
  };
}

export function horizontalTailAsWing(tail: HorizontalTailGeometry, includeIncidence = false): WingGeometry {
  return { modelVersion: 2, symmetry: 'symmetric', verticalPositionM: tail.verticalPositionM, stations: tail.stations.map((station) => ({ ...station, geometricTwistDeg: station.geometricTwistDeg + (includeIncidence ? tail.incidenceDeg : 0) })), sections: tail.sections.map((section) => ({ ...section })) };
}

export function verticalTailAsEditorWing(tail: VerticalTailGeometry): WingGeometry {
  return { modelVersion: 2, symmetry: 'symmetric', verticalPositionM: tail.baseVerticalPositionM, stations: tail.stations.map((station) => ({ ...station })), sections: tail.sections.map((section) => ({ ...section })) };
}

export function horizontalTailFromWing(tail: HorizontalTailGeometry, wing: WingGeometry): HorizontalTailGeometry { return { ...tail, stations: wing.stations.map((station) => ({ ...station })), sections: wing.sections.map((section) => ({ ...section })) }; }
export function verticalTailFromWing(tail: VerticalTailGeometry, wing: WingGeometry): VerticalTailGeometry { return { ...tail, stations: wing.stations.map((station) => ({ ...station })), sections: wing.sections.map((section) => ({ ...section, dihedralDeg: 0 })) }; }

export function horizontalTailPhysicalStations(tail: HorizontalTailGeometry, airfoilLibrary?: AirfoilLibrary): PhysicalWingStation[] {
  return physicalWingStations(horizontalTailAsWing(tail, true), airfoilLibrary).map((station) => ({ ...station, spanPositionM: station.spanPositionM + tail.lateralPositionM }));
}

export function sampleHorizontalTailSectionAtDistance(tail: HorizontalTailGeometry, side: 'port' | 'starboard', distanceM: number, airfoilLibrary?: AirfoilLibrary): WingSectionSample {
  const sample = sampleWingSectionAtSpan(horizontalTailAsWing(tail, true), side === 'port' ? -distanceM : distanceM, airfoilLibrary);
  return { ...sample, station: { ...sample.station, spanPositionM: sample.station.spanPositionM + tail.lateralPositionM } };
}

export function sampleVerticalTailSection(tail: VerticalTailGeometry, heightPositionM: number): VerticalTailSectionSample {
  if (!finite(heightPositionM) || heightPositionM < 0 || heightPositionM > tail.stations.at(-1)!.spanPositionM) throw new RangeError('Vertical-tail sample lies outside its station range.');
  let sectionIndex = tail.stations.findIndex((station) => station.spanPositionM >= heightPositionM) - 1; if (sectionIndex < 0) sectionIndex = 0; if (sectionIndex >= tail.stations.length - 1) sectionIndex = tail.stations.length - 2;
  const from = tail.stations[sectionIndex]; const to = tail.stations[sectionIndex + 1]; const fraction = (heightPositionM - from.spanPositionM) / (to.spanPositionM - from.spanPositionM);
  return {
    station: { id: fraction <= tolerance ? from.id : fraction >= 1 - tolerance ? to.id : `${from.id}--${to.id}@${heightPositionM}`, spanPositionM: heightPositionM, chordM: interpolate(from.chordM, to.chordM, fraction), leadingEdgeXM: interpolate(from.leadingEdgeXM, to.leadingEdgeXM, fraction), geometricTwistDeg: interpolate(from.geometricTwistDeg, to.geometricTwistDeg, fraction), airfoilId: fraction < 0.5 ? from.airfoilId : to.airfoilId, verticalPositionM: tail.baseVerticalPositionM + heightPositionM },
    fromAirfoilId: from.airfoilId, toAirfoilId: to.airfoilId, airfoilBlendFraction: fraction, sectionIndex,
  };
}

export function transformVerticalTailAirfoilPoint(tail: VerticalTailGeometry, station: PhysicalWingStation, point: AirfoilPoint2): AircraftPoint3 {
  const angle = station.geometricTwistDeg * Math.PI / 180; const dx = (point[0] - 0.25) * station.chordM; const dy = point[1] * station.chordM; const quarterChordX = station.leadingEdgeXM + 0.25 * station.chordM;
  return [quarterChordX + dx * Math.cos(angle) - dy * Math.sin(angle), tail.lateralPositionM + dx * Math.sin(angle) + dy * Math.cos(angle), station.verticalPositionM];
}

export function buildHorizontalTailLoftRings(tail: HorizontalTailGeometry, airfoilLibrary?: AirfoilLibrary): WingLoftRing[] {
  return buildWingLoftRings(horizontalTailAsWing(tail, true), undefined, undefined, airfoilLibrary).map((ring) => ({ ...ring, spanPositionM: ring.spanPositionM + tail.lateralPositionM, points: ring.points.map((point) => [point[0], point[1] + tail.lateralPositionM, point[2]] as AircraftPoint3) }));
}

export function buildVerticalTailLoftRings(tail: VerticalTailGeometry, intervalsPerSection = 4, airfoilLibrary?: AirfoilLibrary): VerticalTailLoftRing[] {
  const rings: VerticalTailLoftRing[] = [];
  for (let sectionIndex = 0; sectionIndex < tail.stations.length - 1; sectionIndex += 1) {
    const from = tail.stations[sectionIndex]; const to = tail.stations[sectionIndex + 1];
    for (let interval = sectionIndex === 0 ? 0 : 1; interval <= intervalsPerSection; interval += 1) {
      const fraction = interval / intervalsPerSection; const height = interpolate(from.spanPositionM, to.spanPositionM, fraction); const sample = sampleVerticalTailSection(tail, height); const local = interpolateAirfoilCoordinates(from.airfoilId, to.airfoilId, fraction, undefined, airfoilLibrary);
      rings.push({ heightPositionM: height, chordM: sample.station.chordM, leadingEdgeXM: sample.station.leadingEdgeXM, lateralPositionM: tail.lateralPositionM, verticalPositionM: sample.station.verticalPositionM, geometricTwistDeg: sample.station.geometricTwistDeg, fromAirfoilId: from.airfoilId, toAirfoilId: to.airfoilId, airfoilBlendFraction: fraction, points: local.map((point) => transformVerticalTailAirfoilPoint(tail, sample.station, point)) });
    }
  }
  return rings;
}

export function horizontalTailStationCrossSection(tail: HorizontalTailGeometry, stationId: string, airfoilLibrary?: AirfoilLibrary): AircraftPoint3[] {
  const station = horizontalTailPhysicalStations(tail, airfoilLibrary).find((item) => item.id.replace(/-mirrored$/, '') === stationId); if (!station) throw new RangeError(`Horizontal-tail station "${stationId}" was not found.`);
  return interpolateAirfoilCoordinates(station.airfoilId, station.airfoilId, 0, undefined, airfoilLibrary).map((point) => transformWingAirfoilPoint(station, point));
}

export function verticalTailStationCrossSection(tail: VerticalTailGeometry, stationId: string, airfoilLibrary?: AirfoilLibrary): AircraftPoint3[] {
  const source = tail.stations.find((station) => station.id === stationId); if (!source) throw new RangeError(`Vertical-tail station "${stationId}" was not found.`); const station = sampleVerticalTailSection(tail, source.spanPositionM).station;
  return interpolateAirfoilCoordinates(source.airfoilId, source.airfoilId, 0, undefined, airfoilLibrary).map((point) => transformVerticalTailAirfoilPoint(tail, station, point));
}

function integrateVerticalTail(tail: VerticalTailGeometry): TailReferenceProperties {
  let area = 0; let chordSquared = 0; let xQuarterMoment = 0; let spanMoment = 0;
  tail.stations.slice(0, -1).forEach((from, index) => {
    const to = tail.stations[index + 1]; const delta = to.spanPositionM - from.spanPositionM;
    area += delta * (from.chordM + to.chordM) / 2;
    chordSquared += delta * (from.chordM ** 2 + from.chordM * to.chordM + to.chordM ** 2) / 3;
    const q0 = from.leadingEdgeXM + 0.25 * from.chordM; const q1 = to.leadingEdgeXM + 0.25 * to.chordM;
    xQuarterMoment += delta * (2 * from.chordM * q0 + from.chordM * q1 + to.chordM * q0 + 2 * to.chordM * q1) / 6;
    const y0 = from.spanPositionM; const y1 = to.spanPositionM; spanMoment += delta * (2 * from.chordM * y0 + from.chordM * y1 + to.chordM * y0 + 2 * to.chordM * y1) / 6;
  });
  const span = tail.stations.at(-1)!.spanPositionM; const mac = chordSquared / area; const quarterX = xQuarterMoment / area; const spanRef = spanMoment / area;
  return { projectedAreaM2: area, spanM: span, aspectRatio: span ** 2 / area, meanAerodynamicChordM: mac, meanAerodynamicChordLeadingEdgeXM: quarterX - 0.25 * mac, meanAerodynamicChordQuarterChordXM: quarterX, meanAerodynamicChordSpanPositionM: spanRef, aerodynamicCenterM: [quarterX, tail.lateralPositionM, tail.baseVerticalPositionM + spanRef] };
}

export function calculateHorizontalTailReferenceProperties(tail: HorizontalTailGeometry): TailReferenceProperties {
  const validation = validateHorizontalTailGeometry(tail, undefined, true); if (!validation.valid) throw new RangeError(validation.errors.join(' ')); const equivalentWing = horizontalTailAsWing(tail); const properties = calculateWingReferenceProperties(equivalentWing); const referenceLocation = wingLocationAtSpan(equivalentWing, properties.meanAerodynamicChordSpanPositionM);
  return { projectedAreaM2: properties.projectedAreaM2, spanM: properties.totalSpanM, aspectRatio: properties.aspectRatio, meanAerodynamicChordM: properties.meanAerodynamicChordM, meanAerodynamicChordLeadingEdgeXM: properties.meanAerodynamicChordLeadingEdgeXM, meanAerodynamicChordQuarterChordXM: properties.meanAerodynamicChordQuarterChordXM, meanAerodynamicChordSpanPositionM: properties.meanAerodynamicChordSpanPositionM, aerodynamicCenterM: [properties.meanAerodynamicChordQuarterChordXM, tail.lateralPositionM, referenceLocation.verticalPositionM] };
}

export function calculateVerticalTailReferenceProperties(tail: VerticalTailGeometry): TailReferenceProperties { const validation = validateVerticalTailGeometry(tail, undefined, true); if (!validation.valid) throw new RangeError(validation.errors.join(' ')); return integrateVerticalTail(tail); }

export function calculateEmpennageReferenceProperties(design: AircraftDesign): EmpennageReferenceProperties {
  const horizontal = calculateHorizontalTailReferenceProperties(design.horizontalTail); const vertical = calculateVerticalTailReferenceProperties(design.verticalTail); const wing = calculateWingReferenceProperties(design.wing);
  const horizontalTailMomentArmM = horizontal.meanAerodynamicChordQuarterChordXM - wing.meanAerodynamicChordQuarterChordXM; const verticalTailMomentArmM = vertical.meanAerodynamicChordQuarterChordXM - wing.meanAerodynamicChordQuarterChordXM;
  return { horizontal, vertical, horizontalTailMomentArmM, verticalTailMomentArmM, horizontalTailVolumeCoefficient: horizontal.projectedAreaM2 * horizontalTailMomentArmM / (wing.projectedAreaM2 * wing.meanAerodynamicChordM), verticalTailVolumeCoefficient: vertical.projectedAreaM2 * verticalTailMomentArmM / (wing.projectedAreaM2 * wing.totalSpanM) };
}

export function validateTailAsWing(tail: HorizontalTailGeometry | VerticalTailGeometry): TailValidation {
  const wing = 'incidenceDeg' in tail ? horizontalTailAsWing(tail) : verticalTailAsEditorWing(tail); const validation = validateWingGeometry(wing); return { valid: validation.valid, errors: validation.errors };
}
