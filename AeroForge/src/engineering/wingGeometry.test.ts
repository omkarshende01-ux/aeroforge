import { describe, expect, it } from 'vitest';
import { defaultDesign, type WingGeometry } from '../domain/types';
import {
  calculateWingReferenceProperties,
  migrateAircraftDesignV1,
  migrateLegacyWing,
  physicalWingStations,
  validateWingGeometry,
  wingLocationAtSpan,
} from './wingGeometry';

function symmetricWing(stations: WingGeometry['stations'], dihedralsDeg?: number[]): WingGeometry {
  return {
    modelVersion: 2,
    symmetry: 'symmetric',
    verticalPositionM: 0,
    stations,
    sections: stations.slice(0, -1).map((station, index) => ({
      id: `section-${index}`,
      fromStationId: station.id,
      toStationId: stations[index + 1].id,
      dihedralDeg: dihedralsDeg?.[index] ?? 0,
    })),
  };
}

describe('M5.1 multi-section wing geometry foundation', () => {
  it('calculates a rectangular symmetric wing analytically', () => {
    const wing = symmetricWing([
      { id: 'root', spanPositionM: 0, chordM: 2, leadingEdgeXM: 1, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'tip', spanPositionM: 5, chordM: 2, leadingEdgeXM: 1, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
    ]);
    const result = calculateWingReferenceProperties(wing);
    expect(result.totalSpanM).toBe(10);
    expect(result.projectedAreaM2).toBe(20);
    expect(result.aspectRatio).toBe(5);
    expect(result.meanAerodynamicChordM).toBe(2);
    expect(result.meanAerodynamicChordLeadingEdgeXM).toBe(1);
    expect(result.meanAerodynamicChordQuarterChordXM).toBe(1.5);
  });

  it('recovers the independent single-trapezoid area, aspect ratio, and MAC solution', () => {
    const wing = migrateLegacyWing({ spanM: 12, rootChordM: 2, taperRatio: 0.5, sweepDeg: 0, dihedralDeg: 0, twistDeg: -2, airfoil: 'NACA 2412', rootLeadingEdgeXM: 0, verticalPositionM: 0 });
    const result = calculateWingReferenceProperties(wing);
    expect(result.projectedAreaM2).toBeCloseTo(18, 12);
    expect(result.aspectRatio).toBeCloseTo(8, 12);
    expect(result.meanAerodynamicChordM).toBeCloseTo(14 / 9, 12);
    expect(result.meanAerodynamicChordLeadingEdgeXM).toBeCloseTo(0, 12);
    expect(result.meanAerodynamicChordQuarterChordXM).toBeCloseTo(7 / 18, 12);
  });

  it('integrates a multi-section tapered symmetric wing and reports section properties', () => {
    const wing = symmetricWing([
      { id: 'root', spanPositionM: 0, chordM: 4, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 2412' },
      { id: 'break', spanPositionM: 2, chordM: 3, leadingEdgeXM: 0.5, geometricTwistDeg: -1, airfoilId: 'NACA 2412' },
      { id: 'tip', spanPositionM: 5, chordM: 1, leadingEdgeXM: 1.5, geometricTwistDeg: -3, airfoilId: 'NACA 0012' },
    ], [4, 7]);
    const result = calculateWingReferenceProperties(wing);
    expect(result.totalSpanM).toBe(10);
    expect(result.projectedAreaM2).toBeCloseTo(26, 12);
    expect(result.aspectRatio).toBeCloseTo(100 / 26, 12);
    expect(result.meanAerodynamicChordM).toBeCloseTo(113 / 39, 12);
    expect(result.sections).toHaveLength(4);
    expect(result.sections.map((section) => section.projectedAreaM2)).toEqual([6, 7, 7, 6]);
    expect(result.sections[2].leadingEdgeSweepDeg).toBeCloseTo(Math.atan(0.25) * 180 / Math.PI, 12);
    expect(result.sections[3].taperRatio).toBeCloseTo(1 / 3, 12);
  });

  it('supports a fully defined asymmetric wing without silently mirroring it', () => {
    const wing: WingGeometry = {
      modelVersion: 2,
      symmetry: 'asymmetric',
      verticalPositionM: 0.4,
      stations: [
        { id: 'port-tip', spanPositionM: -4, chordM: 2, leadingEdgeXM: 1, geometricTwistDeg: -2, airfoilId: 'PORT' },
        { id: 'root', spanPositionM: 0, chordM: 3, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'ROOT' },
        { id: 'starboard-tip', spanPositionM: 6, chordM: 1, leadingEdgeXM: 2, geometricTwistDeg: -4, airfoilId: 'STARBOARD' },
      ],
      sections: [
        { id: 'port', fromStationId: 'port-tip', toStationId: 'root', dihedralDeg: -5 },
        { id: 'starboard', fromStationId: 'root', toStationId: 'starboard-tip', dihedralDeg: 5 },
      ],
    };
    const result = calculateWingReferenceProperties(wing);
    const physical = physicalWingStations(wing);
    expect(result.totalSpanM).toBe(10);
    expect(result.projectedAreaM2).toBe(22);
    expect(result.aspectRatio).toBeCloseTo(100 / 22, 12);
    expect(result.meanAerodynamicChordM).toBeCloseTo(7 / 3, 12);
    expect(physical).toHaveLength(3);
    expect(physical[0].verticalPositionM).toBeCloseTo(0.4 + 4 * Math.tan(5 * Math.PI / 180), 12);
    expect(physical[2].verticalPositionM).toBeCloseTo(0.4 + 6 * Math.tan(5 * Math.PI / 180), 12);
  });

  it('interpolates chord, leading edge, quarter chord, twist, and height at a span station', () => {
    const wing = symmetricWing([
      { id: 'root', spanPositionM: 0, chordM: 4, leadingEdgeXM: 1, geometricTwistDeg: 0, airfoilId: 'ROOT' },
      { id: 'tip', spanPositionM: 5, chordM: 2, leadingEdgeXM: 3, geometricTwistDeg: -5, airfoilId: 'TIP' },
    ], [10]);
    const location = wingLocationAtSpan(wing, 2.5);
    expect(location.chordM).toBe(3);
    expect(location.leadingEdgeXM).toBe(2);
    expect(location.quarterChordXM).toBe(2.75);
    expect(location.geometricTwistDeg).toBe(-2.5);
    expect(location.verticalPositionM).toBeCloseTo(2.5 * Math.tan(10 * Math.PI / 180), 12);
  });

  it('rejects unordered, nonpositive, disconnected, and physically invalid definitions', () => {
    const base = symmetricWing([
      { id: 'root', spanPositionM: 0, chordM: 2, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'ROOT' },
      { id: 'tip', spanPositionM: 5, chordM: 1, leadingEdgeXM: 1, geometricTwistDeg: 0, airfoilId: 'TIP' },
    ]);
    expect(validateWingGeometry({ ...base, stations: [base.stations[1], base.stations[0]] }).valid).toBe(false);
    expect(validateWingGeometry({ ...base, stations: [base.stations[0], { ...base.stations[1], chordM: 0 }] }).valid).toBe(false);
    expect(validateWingGeometry({ ...base, sections: [{ ...base.sections[0], toStationId: 'missing' }] }).valid).toBe(false);
    expect(validateWingGeometry({ ...base, sections: [{ ...base.sections[0], dihedralDeg: 90 }] }).valid).toBe(false);
    expect(validateWingGeometry({ ...base, stations: [base.stations[0], { ...base.stations[1], airfoilId: '' }] }).valid).toBe(false);
    expect(() => calculateWingReferenceProperties({ ...base, stations: [base.stations[0], { ...base.stations[1], chordM: -1 }] })).toThrow(/chord/);
  });

  it('migrates a schema-v1 trapezoid without changing established wing metrics', () => {
    const legacyWing = { spanM: 12, rootChordM: 2, taperRatio: 0.5, sweepDeg: 3, dihedralDeg: 3, twistDeg: -1.5, airfoil: 'NACA 2412', rootLeadingEdgeXM: 2.35, verticalPositionM: 0.48 };
    const legacyDesign = { ...defaultDesign, schemaVersion: 1 as const, wing: legacyWing };
    const migrated = migrateAircraftDesignV1(legacyDesign);
    const result = calculateWingReferenceProperties(migrated.wing);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.wing.modelVersion).toBe(2);
    expect(result.totalSpanM).toBe(12);
    expect(result.projectedAreaM2).toBeCloseTo(18, 12);
    expect(result.aspectRatio).toBeCloseTo(8, 12);
    expect(result.meanAerodynamicChordM).toBeCloseTo(14 / 9, 12);
    expect(migrated.wing.stations[1].leadingEdgeXM).toBeCloseTo(2.35 + 6 * Math.tan(3 * Math.PI / 180), 12);
  });
});
