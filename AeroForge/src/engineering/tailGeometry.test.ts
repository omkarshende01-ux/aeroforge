import { describe, expect, it } from 'vitest';
import { defaultDesign, type HorizontalTailGeometry, type VerticalTailGeometry } from '../domain/types';
import { insertWingStationAfter, removeWingStation } from './wingEditor';
import {
  buildHorizontalTailLoftRings, buildVerticalTailLoftRings,
  calculateEmpennageReferenceProperties, calculateHorizontalTailReferenceProperties,
  calculateVerticalTailReferenceProperties, horizontalTailAsWing, horizontalTailFromWing,
  migrateLegacyHorizontalTail, migrateLegacyVerticalTail, sampleVerticalTailSection,
  validateHorizontalTailGeometry, validateVerticalTailGeometry, verticalTailAsEditorWing,
  verticalTailFromWing,
} from './tailGeometry';
import { calculateWingReferenceProperties } from './wingGeometry';

describe('M5.5 multi-station empennage geometry', () => {
  it('recovers analytical trapezoid metrics and legacy placements', () => {
    const horizontal = migrateLegacyHorizontalTail({ spanM: 4, rootChordM: 2, taperRatio: 0.5, sweepDeg: 0, incidenceDeg: 2, rootLeadingEdgeXM: 7, verticalPositionM: 0.5 });
    const vertical = migrateLegacyVerticalTail({ heightM: 2, rootChordM: 2, taperRatio: 0.5, sweepDeg: 0, rootLeadingEdgeXM: 7, basePositionM: 0.4 });
    const h = calculateHorizontalTailReferenceProperties(horizontal); const v = calculateVerticalTailReferenceProperties(vertical);
    expect(h.projectedAreaM2).toBe(6); expect(h.spanM).toBe(4); expect(h.aspectRatio).toBeCloseTo(8 / 3, 12); expect(h.meanAerodynamicChordM).toBeCloseTo(14 / 9, 12);
    expect(v.projectedAreaM2).toBe(3); expect(v.spanM).toBe(2); expect(v.aspectRatio).toBeCloseTo(4 / 3, 12); expect(v.meanAerodynamicChordM).toBeCloseTo(14 / 9, 12);
    expect(h.aerodynamicCenterM[2]).toBe(0.5); expect(v.aerodynamicCenterM[2]).toBeCloseTo(0.4 + 8 / 9, 12);
  });

  it('integrates multi-section horizontal and vertical tails and reference coefficients', () => {
    const horizontal: HorizontalTailGeometry = { ...structuredClone(defaultDesign.horizontalTail), stations: [
      { id: 'h-root', spanPositionM: 0, chordM: 2, leadingEdgeXM: 7, geometricTwistDeg: 1, airfoilId: 'NACA 0012' },
      { id: 'h-break', spanPositionM: 1, chordM: 1.5, leadingEdgeXM: 7.2, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'h-tip', spanPositionM: 2, chordM: 1, leadingEdgeXM: 7.6, geometricTwistDeg: -2, airfoilId: 'NACA 0009' },
    ], sections: [
      { id: 'h-inner', fromStationId: 'h-root', toStationId: 'h-break', dihedralDeg: 2 },
      { id: 'h-outer', fromStationId: 'h-break', toStationId: 'h-tip', dihedralDeg: 4 },
    ] };
    const vertical: VerticalTailGeometry = { ...structuredClone(defaultDesign.verticalTail), stations: horizontal.stations.map((item) => ({ ...item, id: item.id.replace('h-', 'v-') })), sections: [
      { id: 'v-inner', fromStationId: 'v-root', toStationId: 'v-break', dihedralDeg: 0 },
      { id: 'v-outer', fromStationId: 'v-break', toStationId: 'v-tip', dihedralDeg: 0 },
    ] };
    const h = calculateHorizontalTailReferenceProperties(horizontal); const v = calculateVerticalTailReferenceProperties(vertical);
    expect(h.projectedAreaM2).toBe(6); expect(v.projectedAreaM2).toBe(3); expect(h.meanAerodynamicChordM).toBeCloseTo(v.meanAerodynamicChordM, 12);
    const design = { ...defaultDesign, horizontalTail: horizontal, verticalTail: vertical };
    const references = calculateEmpennageReferenceProperties(design); const wing = calculateWingReferenceProperties(design.wing);
    expect(references.horizontalTailMomentArmM).toBeCloseTo(h.meanAerodynamicChordQuarterChordXM - wing.meanAerodynamicChordQuarterChordXM, 12);
    expect(references.horizontalTailVolumeCoefficient).toBeCloseTo(h.projectedAreaM2 * references.horizontalTailMomentArmM / (wing.projectedAreaM2 * wing.meanAerodynamicChordM), 12);
    expect(references.verticalTailVolumeCoefficient).toBeCloseTo(v.projectedAreaM2 * references.verticalTailMomentArmM / (wing.projectedAreaM2 * wing.totalSpanM), 12);
  });

  it('reuses station insertion and deletion without creating a second editor model', () => {
    const inserted = insertWingStationAfter(horizontalTailAsWing(defaultDesign.horizontalTail), 'horizontal-tail-root');
    expect(inserted.errors).toEqual([]);
    const tail = horizontalTailFromWing(defaultDesign.horizontalTail, inserted.wing!);
    expect(tail.stations).toHaveLength(3); expect(validateHorizontalTailGeometry(tail).valid).toBe(true);
    const removed = removeWingStation(horizontalTailAsWing(tail), inserted.selectedStationId!);
    const restored = horizontalTailFromWing(tail, removed.wing!);
    expect(restored.stations).toEqual(defaultDesign.horizontalTail.stations);
    expect(calculateHorizontalTailReferenceProperties(restored)).toEqual(calculateHorizontalTailReferenceProperties(defaultDesign.horizontalTail));
    const verticalInserted = insertWingStationAfter(verticalTailAsEditorWing(defaultDesign.verticalTail), 'vertical-tail-root');
    expect(validateVerticalTailGeometry(verticalTailFromWing(defaultDesign.verticalTail, verticalInserted.wing!)).valid).toBe(true);
  });

  it('interpolates vertical stations and produces finite lofts for both tails', () => {
    const sample = sampleVerticalTailSection(defaultDesign.verticalTail, 0.95);
    expect(sample.station.chordM).toBeCloseTo((1.7 + 0.68) / 2, 12);
    const points = [...buildHorizontalTailLoftRings(defaultDesign.horizontalTail), ...buildVerticalTailLoftRings(defaultDesign.verticalTail)].flatMap((ring) => ring.points.flat());
    expect(points.every(Number.isFinite)).toBe(true);
  });

  it('rejects ordering, chord, airfoil, and unsupported conventional vertical-tail cant', () => {
    const horizontal = structuredClone(defaultDesign.horizontalTail); horizontal.stations[1].spanPositionM = 0;
    expect(validateHorizontalTailGeometry(horizontal).errors.join(' ')).toMatch(/ordered/);
    const badChord = structuredClone(defaultDesign.horizontalTail); badChord.stations[1].chordM = 0;
    expect(validateHorizontalTailGeometry(badChord).errors.join(' ')).toMatch(/chord/);
    const badAirfoil = structuredClone(defaultDesign.horizontalTail); badAirfoil.stations[1].airfoilId = 'CUSTOM';
    expect(validateHorizontalTailGeometry(badAirfoil).errors.join(' ')).toMatch(/NACA/);
    const canted = structuredClone(defaultDesign.verticalTail); canted.sections[0].dihedralDeg = 10;
    expect(validateVerticalTailGeometry(canted).errors.join(' ')).toMatch(/do not support cant/);
  });
});
