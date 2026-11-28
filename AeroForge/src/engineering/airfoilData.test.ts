import { describe, expect, it } from 'vitest';
import { emptyAirfoilLibrary } from '../domain/airfoilData';
import { defaultDesign } from '../domain/types';
import { coordinateCsv, lednicerDat, polarCsv, seligDat, xfoilPolar } from '../validation/fixtures/m6_1AirfoilFixtures';
import { generateAnalysisMesh, isAnalysisMeshStale } from './analysisGeometry';
import {
  cosineSampledAirfoilCoordinates, importAirfoilCoordinates, importPolarData, registerAirfoilGeometry, registerPolarDatasets, removeAirfoilGeometry,
} from './airfoilData';
import { wingMesh } from './geometry';
import { buildWingLoftRings } from './wingLoft';
import { useDesignStore } from '../state/useDesignStore';

const provenance = { sourceKind: 'user-supplied' as const, sourceName: 'AeroForge synthetic M6.1 fixture', license: 'Project test fixture' };
function geometry(raw: string, format: 'selig-dat' | 'lednicer-dat' | 'csv', id = 'AF-SYNTH') {
  return importAirfoilCoordinates(raw, { format, airfoilId: id, displayName: 'Synthetic fixture', provenance });
}

describe('M6.1 airfoil coordinate import and library', () => {
  it.each([['selig-dat', seligDat], ['lednicer-dat', lednicerDat], ['csv', coordinateCsv]] as const)('parses and normalizes %s coordinates without fabricating source metadata', (format, raw) => {
    const result = geometry(raw, format); expect(result.value).toBeDefined(); expect(result.value?.rawSource).toBe(raw);
    expect(result.value?.upperSurface.ordering).toBe('leading-edge-to-trailing-edge'); expect(result.value?.upperSurface.points[0][0]).toBeCloseTo(0, 12); expect(result.value?.upperSurface.points.at(-1)?.[0]).toBeCloseTo(1, 12);
    expect(result.value?.provenance.sourceKind).toBe('user-supplied'); expect(result.value?.provenance.sourceUrl).toBeUndefined();
  });

  it('normalizes dimensional chord coordinates and preserves ordinate ratios', () => {
    const scaled = seligDat.replaceAll('1.0 ', '2.0 ').replaceAll('0.75 ', '1.5 ').replaceAll('0.50 ', '1.0 ').replaceAll('0.25 ', '0.5 ').replaceAll('0.080', '0.160').replaceAll('0.060', '0.120').replaceAll('0.055', '0.110').replaceAll('0.010', '0.020').replaceAll('-0.080', '-0.160').replaceAll('-0.060', '-0.120').replaceAll('-0.055', '-0.110').replaceAll('-0.010', '-0.020');
    const result = geometry(scaled, 'selig-dat'); expect(result.value?.upperSurface.points[2]).toEqual([0.5, 0.08]);
  });

  it('handles consecutive duplicates explicitly but rejects invalid, degenerate, and crossing inputs', () => {
    const duplicate = geometry(seligDat.replace('0.50 0.080', '0.50 0.080\n0.50 0.080'), 'selig-dat'); expect(duplicate.value).toBeDefined(); expect(duplicate.messages.some((item) => item.code === 'duplicate-consecutive-point')).toBe(true);
    expect(geometry('bad\n0 0\n1 0', 'selig-dat').value).toBeUndefined();
    const crossing = coordinateCsv.replace('upper,0.5,0.08', 'upper,0.5,-0.08'); expect(geometry(crossing, 'csv').messages.some((item) => item.severity === 'error')).toBe(true);
    const unordered = coordinateCsv.replace('upper,0.5,0.08', 'upper,0.1,0.08'); expect(geometry(unordered, 'csv').messages.some((item) => item.code === 'invalid-ordering')).toBe(true);
  });

  it('enforces unique identifiers and reference-safe removal', () => {
    const imported = geometry(seligDat, 'selig-dat').value!; const first = registerAirfoilGeometry(emptyAirfoilLibrary(), imported); expect(first.value?.revision).toBe(1);
    expect(registerAirfoilGeometry(first.value!, imported).messages[0].code).toBe('duplicate-airfoil-id');
    expect(removeAirfoilGeometry(first.value!, imported.airfoilId, new Set([imported.airfoilId])).messages[0].code).toBe('airfoil-in-use');
    expect(removeAirfoilGeometry(first.value!, imported.airfoilId, new Set()).value?.geometries).toHaveLength(0);
  });

  it('cosine-resamples imported geometry for lofting and analysis mesh compatibility', () => {
    const imported = geometry(seligDat, 'selig-dat').value!; const library = registerAirfoilGeometry(emptyAirfoilLibrary(), imported).value!; const design = structuredClone(defaultDesign); design.wing.stations.forEach((station) => { station.airfoilId = imported.airfoilId; });
    const local = cosineSampledAirfoilCoordinates(imported.airfoilId, 36, library); expect(local).toHaveLength(72); expect(local.every((point) => point.every(Number.isFinite))).toBe(true);
    const rings = buildWingLoftRings(design.wing, 4, 36, library); expect(rings.every((ring) => ring.points.length === 72)).toBe(true); const rendered = wingMesh(design, library); expect(rendered.getAttribute('position').count).toBeGreaterThan(0);
    const mesh = generateAnalysisMesh(design, undefined, library); expect(mesh.validation.valid).toBe(true); const changed = structuredClone(design); changed.revision += 1; changed.wing.stations[0].airfoilId = 'NACA 0012'; expect(isAnalysisMeshStale(mesh, changed)).toBe(true);
  });

  it('retains existing generated NACA loft behavior', () => {
    const baseline = buildWingLoftRings(defaultDesign.wing); const withEmptyLibrary = buildWingLoftRings(defaultDesign.wing, undefined, undefined, emptyAirfoilLibrary()); expect(withEmptyLibrary).toEqual(baseline);
  });

  it('selects registered geometry through the store and invalidates retained mesh by design revision', () => {
    const original = useDesignStore.getState(); const imported = geometry(seligDat, 'selig-dat', 'AF-STORE').value!;
    try {
      useDesignStore.setState({ design: structuredClone(defaultDesign), airfoilLibrary: emptyAirfoilLibrary(), analysisMesh: generateAnalysisMesh(defaultDesign) });
      expect(useDesignStore.getState().registerAirfoilGeometry(imported)).toEqual([]); const wing = structuredClone(useDesignStore.getState().design.wing); wing.stations[0].airfoilId = imported.airfoilId;
      expect(useDesignStore.getState().commitWingGeometry(wing)).toEqual([]); const state = useDesignStore.getState(); expect(state.design.revision).toBe(1); expect(isAnalysisMeshStale(state.analysisMesh, state.design)).toBe(true); expect(state.removeAirfoilGeometry(imported.airfoilId)[0]).toMatch(/referenced/);
    } finally { useDesignStore.setState({ design: original.design, airfoilLibrary: original.airfoilLibrary, analysisMesh: original.analysisMesh }); }
  });
});

describe('M6.1 aerodynamic polar import', () => {
  it('parses CSV into multiple Reynolds datasets while keeping missing coefficients unknown', () => {
    const result = importPolarData(polarCsv, { format: 'csv', datasetId: 'AF-POLAR', airfoilId: 'NACA 0012', provenance, momentReference: { axis: 'airfoil-quarter-chord', chordFraction: 0.25, signConvention: 'positive-nose-up' } });
    expect(result.value).toHaveLength(2); expect(result.value?.map((item) => item.reynoldsNumber)).toEqual([1_000_000, 2_000_000]); expect(result.value?.[0].points[0].pitchingMomentCoefficient).toBeUndefined(); expect(result.value?.[0].points[2].converged).toBe(false); expect(result.value?.[0].rawSource).toBe(polarCsv);
  });

  it('parses XFOIL text and preserves computational provenance without claiming experiment', () => {
    const result = importPolarData(xfoilPolar, { format: 'xfoil', datasetId: 'XF-1', airfoilId: 'NACA 0012', provenance: { sourceKind: 'computational', sourceName: 'Synthetic XFOIL fixture' }, momentReference: { axis: 'airfoil-quarter-chord', chordFraction: 0.25, signConvention: 'positive-nose-up' } });
    expect(result.value?.[0]).toMatchObject({ reynoldsNumber: 1_500_000, machNumber: 0.05, generationMethod: 'xfoil' }); expect(result.value?.[0].points).toHaveLength(3); expect(result.value?.[0].provenance.sourceKind).toBe('computational');
  });

  it('rejects duplicate points, invalid conditions, negative drag, and incompatible moment references', () => {
    const duplicate = polarCsv.replace('2,1000000', '0,1000000'); expect(importPolarData(duplicate, { format: 'csv', datasetId: 'bad', airfoilId: 'NACA 0012', provenance }).value).toBeUndefined();
    const negative = polarCsv.replace('0.018', '-0.018'); expect(importPolarData(negative, { format: 'csv', datasetId: 'bad', airfoilId: 'NACA 0012', provenance }).messages.some((item) => item.code === 'negative-drag')).toBe(true);
    const invalidRe = polarCsv.replaceAll('1000000', '-1'); expect(importPolarData(invalidRe, { format: 'csv', datasetId: 'bad', airfoilId: 'NACA 0012', provenance }).messages.some((item) => item.code === 'invalid-reynolds')).toBe(true);
    const moment = importPolarData(polarCsv, { format: 'csv', datasetId: 'bad', airfoilId: 'NACA 0012', provenance, momentReference: { axis: 'airfoil-quarter-chord', chordFraction: 0.5, signConvention: 'unknown' } }); expect(moment.messages.some((item) => item.code === 'incompatible-moment-reference')).toBe(true);
  });

  it('registers multiple condition datasets for one airfoil with unique IDs', () => {
    const datasets = importPolarData(polarCsv, { format: 'csv', datasetId: 'AF-POLAR', airfoilId: 'NACA 0012', provenance }).value!; const registered = registerPolarDatasets(emptyAirfoilLibrary(), datasets); expect(registered.value?.polarDatasets.map((item) => item.id)).toEqual(['AF-POLAR-1', 'AF-POLAR-2']);
  });
});
