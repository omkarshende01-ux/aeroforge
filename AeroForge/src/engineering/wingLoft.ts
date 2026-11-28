import type { WingGeometry } from '../domain/types';
import type { AirfoilLibrary } from '../domain/airfoilData';
import { cosineSampledAirfoilCoordinates } from './airfoilData';
import { physicalWingStations, type PhysicalWingStation } from './wingGeometry';

export type AirfoilPoint2 = readonly [xOverChord: number, zOverChord: number];
export type AircraftPoint3 = readonly [xM: number, yM: number, zM: number];

export type WingLoftRing = {
  spanPositionM: number;
  chordM: number;
  leadingEdgeXM: number;
  verticalPositionM: number;
  geometricTwistDeg: number;
  fromAirfoilId: string;
  toAirfoilId: string;
  airfoilBlendFraction: number;
  points: AircraftPoint3[];
};

export type WingSectionSample = {
  station: PhysicalWingStation;
  fromAirfoilId: string;
  toAirfoilId: string;
  airfoilBlendFraction: number;
  physicalSectionIndex: number;
};

export const WING_AIRFOIL_COSINE_INTERVALS = 36;
export const WING_LOFT_INTERVALS_PER_SECTION = 4;

function interpolate(from: number, to: number, fraction: number): number { return from + fraction * (to - from); }

export function sampleWingSectionAtSpan(wing: WingGeometry, spanPositionM: number, airfoilLibrary?: AirfoilLibrary): WingSectionSample {
  const stations = physicalWingStations(wing, airfoilLibrary);
  if (!Number.isFinite(spanPositionM) || spanPositionM < stations[0].spanPositionM || spanPositionM > stations.at(-1)!.spanPositionM) throw new RangeError('Span position lies outside the physical wing.');
  let physicalSectionIndex = stations.findIndex((station) => station.spanPositionM >= spanPositionM) - 1;
  if (physicalSectionIndex < 0) physicalSectionIndex = 0;
  if (physicalSectionIndex >= stations.length - 1) physicalSectionIndex = stations.length - 2;
  const from = stations[physicalSectionIndex]; const to = stations[physicalSectionIndex + 1];
  const fraction = (spanPositionM - from.spanPositionM) / (to.spanPositionM - from.spanPositionM);
  const station: PhysicalWingStation = {
    id: Math.abs(fraction) <= 1e-12 ? from.id : Math.abs(fraction - 1) <= 1e-12 ? to.id : `${from.id}--${to.id}@${spanPositionM}`,
    spanPositionM,
    chordM: interpolate(from.chordM, to.chordM, fraction),
    leadingEdgeXM: interpolate(from.leadingEdgeXM, to.leadingEdgeXM, fraction),
    verticalPositionM: interpolate(from.verticalPositionM, to.verticalPositionM, fraction),
    geometricTwistDeg: interpolate(from.geometricTwistDeg, to.geometricTwistDeg, fraction),
    airfoilId: fraction < 0.5 ? from.airfoilId : to.airfoilId,
  };
  return { station, fromAirfoilId: from.airfoilId, toAirfoilId: to.airfoilId, airfoilBlendFraction: fraction, physicalSectionIndex };
}

/**
 * Converts normalized airfoil x/z coordinates to aircraft x/y/z coordinates.
 * The station quarter-chord is invariant. Positive twist is right-handed about
 * +y and therefore raises the leading edge in the documented x-aft frame.
 * Dihedral is already represented by station.verticalPositionM and is not
 * applied a second time here.
 */
export function transformWingAirfoilPoint(station: PhysicalWingStation, point: AirfoilPoint2): AircraftPoint3 {
  const angleRad = station.geometricTwistDeg * Math.PI / 180;
  const dx = (point[0] - 0.25) * station.chordM;
  const dz = point[1] * station.chordM;
  const quarterChordXM = station.leadingEdgeXM + 0.25 * station.chordM;
  return [
    quarterChordXM + dx * Math.cos(angleRad) + dz * Math.sin(angleRad),
    station.spanPositionM,
    station.verticalPositionM - dx * Math.sin(angleRad) + dz * Math.cos(angleRad),
  ];
}

export function interpolateAirfoilCoordinates(fromAirfoilId: string, toAirfoilId: string, fraction: number, cosineIntervals = WING_AIRFOIL_COSINE_INTERVALS, airfoilLibrary?: AirfoilLibrary): AirfoilPoint2[] {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new RangeError('Airfoil blend fraction must be within [0, 1].');
  const from = cosineSampledAirfoilCoordinates(fromAirfoilId, cosineIntervals, airfoilLibrary);
  const to = cosineSampledAirfoilCoordinates(toAirfoilId, cosineIntervals, airfoilLibrary);
  return from.map((point, index) => [interpolate(point[0], to[index][0], fraction), interpolate(point[1], to[index][1], fraction)]);
}

export function wingStationCrossSection(station: PhysicalWingStation, cosineIntervals = WING_AIRFOIL_COSINE_INTERVALS, airfoilLibrary?: AirfoilLibrary): AircraftPoint3[] {
  return cosineSampledAirfoilCoordinates(station.airfoilId, cosineIntervals, airfoilLibrary).map((point) => transformWingAirfoilPoint(station, point));
}

export function buildWingLoftRings(wing: WingGeometry, intervalsPerSection = WING_LOFT_INTERVALS_PER_SECTION, cosineIntervals = WING_AIRFOIL_COSINE_INTERVALS, airfoilLibrary?: AirfoilLibrary): WingLoftRing[] {
  if (!Number.isInteger(intervalsPerSection) || intervalsPerSection < 1) throw new RangeError('Wing loft intervals per section must be a positive integer.');
  if (!Number.isInteger(cosineIntervals) || cosineIntervals < 4) throw new RangeError('Airfoil cosine intervals must be an integer of at least four.');
  const stations = physicalWingStations(wing, airfoilLibrary);
  const rings: WingLoftRing[] = [];
  for (let sectionIndex = 0; sectionIndex < stations.length - 1; sectionIndex += 1) {
    const from = stations[sectionIndex]; const to = stations[sectionIndex + 1];
    const startInterval = sectionIndex === 0 ? 0 : 1;
    for (let interval = startInterval; interval <= intervalsPerSection; interval += 1) {
      const fraction = interval / intervalsPerSection;
      const station: PhysicalWingStation = {
        id: fraction === 0 ? from.id : fraction === 1 ? to.id : `${from.id}--${to.id}-${interval}`,
        spanPositionM: interpolate(from.spanPositionM, to.spanPositionM, fraction),
        chordM: interpolate(from.chordM, to.chordM, fraction),
        leadingEdgeXM: interpolate(from.leadingEdgeXM, to.leadingEdgeXM, fraction),
        verticalPositionM: interpolate(from.verticalPositionM, to.verticalPositionM, fraction),
        geometricTwistDeg: interpolate(from.geometricTwistDeg, to.geometricTwistDeg, fraction),
        airfoilId: fraction < 0.5 ? from.airfoilId : to.airfoilId,
      };
      const localPoints = interpolateAirfoilCoordinates(from.airfoilId, to.airfoilId, fraction, cosineIntervals, airfoilLibrary);
      rings.push({
        spanPositionM: station.spanPositionM,
        chordM: station.chordM,
        leadingEdgeXM: station.leadingEdgeXM,
        verticalPositionM: station.verticalPositionM,
        geometricTwistDeg: station.geometricTwistDeg,
        fromAirfoilId: from.airfoilId,
        toAirfoilId: to.airfoilId,
        airfoilBlendFraction: fraction,
        points: localPoints.map((point) => transformWingAirfoilPoint(station, point)),
      });
    }
  }
  return rings;
}
