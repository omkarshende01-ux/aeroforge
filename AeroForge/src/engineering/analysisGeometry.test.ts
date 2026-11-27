import { describe, expect, it } from 'vitest';
import type { AnalysisMeshConfiguration } from '../domain/analysisGeometry';
import type { AircraftDesign, WingGeometry } from '../domain/types';
import { defaultDesign } from '../domain/types';
import { calculateWingReferenceProperties } from './wingGeometry';
import { DEFAULT_ANALYSIS_MESH_CONFIGURATION, generateAnalysisMesh, isAnalysisMeshStale } from './analysisGeometry';

function configuration(patch: Partial<AnalysisMeshConfiguration> = {}): AnalysisMeshConfiguration {
  return { ...DEFAULT_ANALYSIS_MESH_CONFIGURATION, surfaceIds: ['wing'], chordwisePanels: 2, spanwisePanelsPerSection: 2, chordwiseSpacing: 'uniform', spanwiseSpacing: 'uniform', ...patch };
}

function rectangularWing(patch: Partial<WingGeometry> = {}): WingGeometry {
  return {
    modelVersion: 2, symmetry: 'symmetric', verticalPositionM: 0,
    stations: [
      { id: 'root', spanPositionM: 0, chordM: 2, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'tip', spanPositionM: 5, chordM: 2, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
    ],
    sections: [{ id: 'panel', fromStationId: 'root', toStationId: 'tip', dihedralDeg: 0 }],
    ...patch,
  };
}

function designWithWing(wing: WingGeometry): AircraftDesign { return { ...structuredClone(defaultDesign), revision: 7, wing }; }
function panelArea(mesh: ReturnType<typeof generateAnalysisMesh>): number { return mesh.panels.reduce((sum, panel) => sum + panel.areaM2, 0); }

describe('analysis-ready geometry discretization', () => {
  it('creates deterministic rectangular-wing panels with exact area and upward normals', () => {
    const design = designWithWing(rectangularWing()); const config = configuration();
    const first = generateAnalysisMesh(design, config); const second = generateAnalysisMesh(design, config);
    expect(first).toEqual(second); expect(first.validation.valid).toBe(true); expect(first.panels).toHaveLength(8);
    expect(panelArea(first)).toBeCloseTo(20, 12);
    first.panels.forEach((panel) => {
      expect(panel.areaM2).toBeCloseTo(2.5, 12); expect(panel.unitNormal).toEqual([0, 0, 1]);
      expect(Math.hypot(...panel.localChordDirection)).toBeCloseTo(1, 12); expect(Math.hypot(...panel.localSpanDirection)).toBeCloseTo(1, 12);
      expect(panel.centroidM.every(Number.isFinite)).toBe(true);
    });
  });

  it('places panel-local bound vortices at quarter chord and collocation points at three-quarter chord', () => {
    const mesh = generateAnalysisMesh(designWithWing(rectangularWing()), configuration({ chordwisePanels: 1, spanwisePanelsPerSection: 1 }));
    const starboard = mesh.panels.find((panel) => panel.parentSectionId === 'panel-starboard')!;
    expect(starboard.boundVortexStartM[0]).toBeCloseTo(0.5, 12);
    expect(starboard.boundVortexEndM[0]).toBeCloseTo(0.5, 12);
    expect(starboard.collocationPointM[0]).toBeCloseTo(1.5, 12);
    expect(starboard.collocationPointM[1]).toBeCloseTo(2.5, 12);
    expect(starboard.trailingEdge).toBe(true);
  });

  it('supports uniform and cosine spacing without moving engineering station boundaries', () => {
    const design = designWithWing(rectangularWing());
    const uniform = generateAnalysisMesh(design, configuration({ chordwisePanels: 4, spanwisePanelsPerSection: 4 }));
    const cosine = generateAnalysisMesh(design, configuration({ chordwisePanels: 4, spanwisePanelsPerSection: 4, chordwiseSpacing: 'cosine', spanwiseSpacing: 'cosine' }));
    expect(uniform.surfaces[0].spanBreakCoordinatesM).toEqual([-5, -3.75, -2.5, -1.25, 0, 1.25, 2.5, 3.75, 5]);
    expect(cosine.surfaces[0].spanBreakCoordinatesM).toContain(0);
    expect(cosine.surfaces[0].spanBreakCoordinatesM[1]).not.toBeCloseTo(uniform.surfaces[0].spanBreakCoordinatesM[1], 6);
    expect(cosine.surfaces[0].chordBreakFractions[1]).toBeCloseTo((1 - Math.cos(Math.PI / 4)) / 2, 12);
  });

  it('preserves every station boundary on a tapered multi-section wing', () => {
    const wing: WingGeometry = {
      modelVersion: 2, symmetry: 'symmetric', verticalPositionM: 0,
      stations: [
        { id: 'root', spanPositionM: 0, chordM: 4, leadingEdgeXM: 1, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
        { id: 'break', spanPositionM: 2, chordM: 3, leadingEdgeXM: 1.4, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
        { id: 'tip', spanPositionM: 5, chordM: 1, leadingEdgeXM: 2.2, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      ],
      sections: [{ id: 'inner', fromStationId: 'root', toStationId: 'break', dihedralDeg: 0 }, { id: 'outer', fromStationId: 'break', toStationId: 'tip', dihedralDeg: 0 }],
    };
    const design = designWithWing(wing); const mesh = generateAnalysisMesh(design, configuration({ chordwisePanels: 3, spanwisePanelsPerSection: 3 }));
    expect(mesh.surfaces[0].stationBoundaryCoordinatesM).toEqual([-5, -2, 0, 2, 5]);
    expect(mesh.surfaces[0].stationBoundaryCoordinatesM.every((boundary) => mesh.surfaces[0].spanBreakCoordinatesM.includes(boundary))).toBe(true);
    expect(panelArea(mesh)).toBeCloseTo(calculateWingReferenceProperties(wing).projectedAreaM2, 11);
    expect(new Set(mesh.panels.map((panel) => panel.parentSectionId))).toEqual(new Set(['outer-port', 'inner-port', 'inner-starboard', 'outer-starboard']));
  });

  it('uses finite mean-camber geometry for swept, dihedral and twisted sections', () => {
    const wing = rectangularWing({
      stations: [
        { id: 'root', spanPositionM: 0, chordM: 2.4, leadingEdgeXM: 1, geometricTwistDeg: 4, airfoilId: 'NACA 2412' },
        { id: 'tip', spanPositionM: 5, chordM: 1.1, leadingEdgeXM: 2.3, geometricTwistDeg: -5, airfoilId: 'NACA 4412' },
      ],
      sections: [{ id: 'panel', fromStationId: 'root', toStationId: 'tip', dihedralDeg: 7 }],
    });
    const mesh = generateAnalysisMesh(designWithWing(wing), configuration({ chordwisePanels: 5, spanwisePanelsPerSection: 6, chordwiseSpacing: 'cosine', spanwiseSpacing: 'cosine' }));
    expect(mesh.validation.valid).toBe(true);
    expect(mesh.panels.flatMap((panel) => Object.values(panel.corners)).every((point) => point.every(Number.isFinite))).toBe(true);
    expect(mesh.panels.some((panel) => Math.abs(panel.collocationPointM[2]) > 0.05)).toBe(true);
    expect(mesh.panels.every((panel) => panel.unitNormal[2] > 0)).toBe(true);
  });

  it('generates explicit asymmetric geometry without implicit mirroring', () => {
    const wing: WingGeometry = {
      modelVersion: 2, symmetry: 'asymmetric', verticalPositionM: 0,
      stations: [
        { id: 'port', spanPositionM: -3, chordM: 1, leadingEdgeXM: 0.7, geometricTwistDeg: -2, airfoilId: 'NACA 0012' },
        { id: 'root', spanPositionM: 0, chordM: 2, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
        { id: 'starboard', spanPositionM: 5, chordM: 1.5, leadingEdgeXM: 1.1, geometricTwistDeg: 1, airfoilId: 'NACA 2412' },
      ],
      sections: [{ id: 'port-panel', fromStationId: 'port', toStationId: 'root', dihedralDeg: -3 }, { id: 'starboard-panel', fromStationId: 'root', toStationId: 'starboard', dihedralDeg: 4 }],
    };
    const mesh = generateAnalysisMesh(designWithWing(wing), configuration({ chordwisePanels: 1, spanwisePanelsPerSection: 2 }));
    expect(mesh.surfaces[0].stationBoundaryCoordinatesM).toEqual([-3, 0, 5]);
    expect(mesh.panels).toHaveLength(4);
    expect(new Set(mesh.panels.map((panel) => panel.parentSectionId))).toEqual(new Set(['port-panel', 'starboard-panel']));
  });

  it('orients horizontal-tail normals upward and vertical-tail normals starboard', () => {
    const mesh = generateAnalysisMesh(structuredClone(defaultDesign), configuration({ surfaceIds: ['horizontal-tail', 'vertical-tail'], chordwisePanels: 2, spanwisePanelsPerSection: 2 }));
    expect(mesh.validation.valid).toBe(true);
    const horizontal = mesh.panels.filter((panel) => panel.parentSurfaceId === 'horizontal-tail'); const vertical = mesh.panels.filter((panel) => panel.parentSurfaceId === 'vertical-tail');
    expect(horizontal.length).toBeGreaterThan(0); expect(vertical.length).toBeGreaterThan(0);
    expect(horizontal.every((panel) => panel.unitNormal[2] > 0)).toBe(true);
    expect(vertical.every((panel) => panel.unitNormal[1] > 0)).toBe(true);
  });

  it('inserts control span and hinge boundaries and identifies movable panels while staying neutral', () => {
    const design = designWithWing(rectangularWing());
    design.controlSurfaces = { modelVersion: 1, surfaces: [{ id: 'aileron', name: 'Test aileron', kind: 'aileron', parentSurface: 'wing', enabled: true, spanStartM: 1, spanEndM: 4, chordFraction: 0.3, hingeChordFraction: 0.7, minimumDeflectionDeg: -20, maximumDeflectionDeg: 20, currentDeflectionDeg: 12, operation: 'differential', side: 'both' }] };
    const mesh = generateAnalysisMesh(design, configuration({ chordwisePanels: 2, spanwisePanelsPerSection: 1 }));
    expect(mesh.surfaces[0].spanBreakCoordinatesM).toEqual(expect.arrayContaining([-4, -1, 1, 4]));
    expect(mesh.surfaces[0].chordBreakFractions).toContain(0.7);
    expect(mesh.panels.filter((panel) => panel.parentControlSurfaceId === 'aileron').length).toBeGreaterThan(0);
    expect(mesh.geometryState).toBe('neutral');
    expect(mesh.validation.warnings.some((warning) => warning.code === 'unsupported-configuration' && warning.message.includes('12.00 deg'))).toBe(true);
  });

  it('keeps rectangular reference area invariant under mesh refinement', () => {
    const design = designWithWing(rectangularWing());
    const coarse = generateAnalysisMesh(design, configuration({ chordwisePanels: 2, spanwisePanelsPerSection: 2 }));
    const fine = generateAnalysisMesh(design, configuration({ chordwisePanels: 12, spanwisePanelsPerSection: 18, chordwiseSpacing: 'cosine', spanwiseSpacing: 'cosine' }));
    expect(panelArea(coarse)).toBeCloseTo(20, 12); expect(panelArea(fine)).toBeCloseTo(20, 10);
    expect(panelArea(fine)).toBeCloseTo(panelArea(coarse), 10);
  });

  it('reports invalid settings and invalid parent geometry without silently correcting them', () => {
    const design = designWithWing(rectangularWing());
    const invalidSettings = generateAnalysisMesh(design, configuration({ chordwisePanels: 0 }));
    expect(invalidSettings.validation.valid).toBe(false); expect(invalidSettings.panels).toEqual([]);
    expect(invalidSettings.validation.errors.some((error) => error.code === 'invalid-configuration')).toBe(true);
    design.wing.stations[1].chordM = 0;
    const invalidGeometry = generateAnalysisMesh(design, configuration());
    expect(invalidGeometry.validation.errors.some((error) => error.code === 'invalid-parent-geometry' && error.message.includes('positive'))).toBe(true);
  });

  it('reports excessive panel aspect ratio as a quality warning without invalidating finite topology', () => {
    const mesh = generateAnalysisMesh(designWithWing(rectangularWing()), configuration({ chordwisePanels: 1, spanwisePanelsPerSection: 1, maximumPanelAspectRatio: 2 }));
    expect(mesh.validation.valid).toBe(true);
    expect(mesh.validation.warnings.some((warning) => warning.code === 'excessive-aspect-ratio')).toBe(true);
  });

  it('excludes the fuselage and tracks staleness by authoritative design revision', () => {
    const design = designWithWing(rectangularWing()); const mesh = generateAnalysisMesh(design, configuration());
    expect(mesh.surfaces.map((surface) => surface.id)).toEqual(['wing']);
    expect(isAnalysisMeshStale(mesh, design)).toBe(false);
    expect(isAnalysisMeshStale(mesh, { ...design, revision: design.revision + 1 })).toBe(true);
  });
});
