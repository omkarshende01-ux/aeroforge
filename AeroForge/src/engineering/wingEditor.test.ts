import { describe, expect, it } from 'vitest';
import { defaultDesign } from '../domain/types';
import { wingMesh } from './geometry';
import { calculateWingReferenceProperties, validateWingGeometry } from './wingGeometry';
import {
  addOutboardWingStation,
  changeWingSymmetry,
  duplicateWingStation,
  editWingSection,
  editWingSectionSweep,
  editWingStation,
  insertWingStationAfter,
  removeWingStation,
} from './wingEditor';

describe('M5.2 wing station editing', () => {
  it('inserts an interpolated station without changing the analytical planform', () => {
    const before = calculateWingReferenceProperties(defaultDesign.wing);
    const result = insertWingStationAfter(defaultDesign.wing, 'wing-root');
    expect(result.errors).toEqual([]);
    expect(result.wing?.stations).toHaveLength(3);
    expect(result.wing?.sections).toHaveLength(2);
    expect(result.wing?.stations[1].spanPositionM).toBe(3);
    expect(result.wing?.stations[1].chordM).toBe(1.5);
    const after = calculateWingReferenceProperties(result.wing!);
    expect(after.projectedAreaM2).toBeCloseTo(before.projectedAreaM2, 12);
    expect(after.meanAerodynamicChordM).toBeCloseTo(before.meanAerodynamicChordM, 12);
  });

  it('edits station and section values with immediate metric changes', () => {
    const chordEdit = editWingStation(defaultDesign.wing, 'wing-tip', { chordM: 1.2, geometricTwistDeg: -3, airfoilId: 'NACA 0012' });
    expect(chordEdit.wing?.stations[1]).toMatchObject({ chordM: 1.2, geometricTwistDeg: -3, airfoilId: 'NACA 0012' });
    expect(calculateWingReferenceProperties(chordEdit.wing!).projectedAreaM2).toBeCloseTo(19.2, 12);
    const sweepEdit = editWingSectionSweep(chordEdit.wing!, 'wing-panel', 10);
    expect(sweepEdit.wing?.stations[1].leadingEdgeXM).toBeCloseTo(defaultDesign.wing.stations[0].leadingEdgeXM + 6 * Math.tan(10 * Math.PI / 180), 12);
    const dihedralEdit = editWingSection(sweepEdit.wing!, 'wing-panel', { dihedralDeg: 6 });
    expect(dihedralEdit.wing?.sections[0].dihedralDeg).toBe(6);
  });

  it('duplicates, adds and removes stations while preserving valid connectivity', () => {
    const duplicated = duplicateWingStation(defaultDesign.wing, 'wing-root');
    expect(duplicated.wing?.stations).toHaveLength(3);
    expect(duplicated.wing?.stations[1].chordM).toBe(defaultDesign.wing.stations[0].chordM);
    const added = addOutboardWingStation(duplicated.wing!);
    expect(added.wing?.stations).toHaveLength(4);
    expect(validateWingGeometry(added.wing!).valid).toBe(true);
    const removed = removeWingStation(added.wing!, duplicated.selectedStationId!);
    expect(removed.wing?.stations).toHaveLength(3);
    expect(validateWingGeometry(removed.wing!).valid).toBe(true);
  });

  it('converts symmetric geometry to editable asymmetric geometry and back', () => {
    const baseline = calculateWingReferenceProperties(defaultDesign.wing);
    const asymmetric = changeWingSymmetry(defaultDesign.wing, 'asymmetric');
    expect(asymmetric.wing?.symmetry).toBe('asymmetric');
    expect(asymmetric.wing?.stations.map((station) => station.spanPositionM)).toEqual([-6, 0, 6]);
    expect(calculateWingReferenceProperties(asymmetric.wing!).projectedAreaM2).toBeCloseTo(baseline.projectedAreaM2, 12);
    const portEdit = editWingStation(asymmetric.wing!, 'wing-tip-mirrored', { chordM: 1.4 });
    expect(calculateWingReferenceProperties(portEdit.wing!).projectedAreaM2).toBeCloseTo(19.2, 12);
    const symmetric = changeWingSymmetry(portEdit.wing!, 'symmetric');
    expect(symmetric.wing?.symmetry).toBe('symmetric');
    expect(symmetric.wing?.stations.map((station) => station.spanPositionM)).toEqual([0, 6]);
  });

  it('rejects negative chords, intersecting order, root removal and inconsistent topology', () => {
    expect(editWingStation(defaultDesign.wing, 'wing-tip', { chordM: -1 }).wing).toBeUndefined();
    expect(editWingStation(defaultDesign.wing, 'wing-tip', { spanPositionM: 0 }).errors.join(' ')).toMatch(/strictly ordered/);
    expect(editWingStation(defaultDesign.wing, 'wing-root', { spanPositionM: 1 }).errors.join(' ')).toMatch(/root station/);
    expect(removeWingStation(defaultDesign.wing, 'wing-root').errors.join(' ')).toMatch(/cannot be removed/);
    expect(removeWingStation(defaultDesign.wing, 'wing-tip').errors.join(' ')).toMatch(/at least root and tip/);
  });

  it('keeps viewport loft bounds consistent with edited engineering stations', () => {
    const inserted = insertWingStationAfter(defaultDesign.wing, 'wing-root').wing!;
    const edited = editWingStation(inserted, inserted.stations[1].id, { chordM: 2.4, leadingEdgeXM: 3.1 }).wing!;
    const design = { ...defaultDesign, wing: edited };
    const geometry = wingMesh(design); geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.y).toBeCloseTo(-edited.stations.at(-1)!.spanPositionM, 5);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(edited.stations.at(-1)!.spanPositionM, 5);
    expect(geometry.getAttribute('position').count).toBeGreaterThan(defaultDesign.wing.stations.length * 50);
    geometry.dispose();
  });
});
