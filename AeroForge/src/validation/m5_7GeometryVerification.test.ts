import { describe, expect, it } from 'vitest';
import type { AnalysisMeshConfiguration, AnalysisPoint3 } from '../domain/analysisGeometry';
import { defaultDesign, type AircraftDesign, type FuselageGeometry, type WingGeometry } from '../domain/types';
import { DEFAULT_ANALYSIS_MESH_CONFIGURATION, generateAnalysisMesh, isAnalysisMeshStale } from '../engineering/analysisGeometry';
import { calculateControlSurfaceProperties, buildControlSurfaceGeometry } from '../engineering/controlSurfaces';
import { buildFuselageMeshData, calculateFuselageProperties, fuselageCrossSectionArea } from '../engineering/fuselageGeometry';
import { wingMesh } from '../engineering/geometry';
import { calculateEmpennageReferenceProperties } from '../engineering/tailGeometry';
import { calculateWingReferenceProperties, migrateAircraftDesignV1, migrateAircraftDesignV2, type LegacyAircraftDesignV1, type LegacyAircraftDesignV2 } from '../engineering/wingGeometry';
import { transformWingAirfoilPoint } from '../engineering/wingLoft';
import { M5_7_GEOMETRY_BENCHMARKS as benchmark } from './fixtures/m5_7GeometryBenchmarks';

const radians = (degrees: number) => degrees * Math.PI / 180;
const magnitude = (v: readonly number[]) => Math.hypot(...v);
const subtract = (a: AnalysisPoint3, b: AnalysisPoint3): AnalysisPoint3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: AnalysisPoint3, b: AnalysisPoint3): AnalysisPoint3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: AnalysisPoint3, b: AnalysisPoint3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const distance = (a: AnalysisPoint3, b: AnalysisPoint3) => magnitude(subtract(a, b));
const relativeError = (actual: number, expected: number) => Math.abs(actual - expected) / Math.abs(expected);

function meshConfiguration(patch: Partial<AnalysisMeshConfiguration> = {}): AnalysisMeshConfiguration {
  return {
    ...DEFAULT_ANALYSIS_MESH_CONFIGURATION,
    surfaceIds: ['wing'],
    chordwisePanels: 1,
    spanwisePanelsPerSection: 1,
    chordwiseSpacing: 'uniform',
    spanwiseSpacing: 'uniform',
    maximumPanelAspectRatio: 100,
    ...patch,
  };
}

function wing(stations: WingGeometry['stations'], symmetry: WingGeometry['symmetry'] = 'symmetric', dihedrals: number[] = stations.slice(1).map(() => 0)): WingGeometry {
  return {
    modelVersion: 2,
    symmetry,
    verticalPositionM: 0,
    stations,
    sections: stations.slice(0, -1).map((station, index) => ({ id: `section-${index}`, fromStationId: station.id, toStationId: stations[index + 1].id, dihedralDeg: dihedrals[index] })),
  };
}

function designWithWing(value: WingGeometry): AircraftDesign {
  const design = structuredClone(defaultDesign);
  design.wing = value;
  design.controlSurfaces.surfaces = [];
  return design;
}

function triangleArea(a: AnalysisPoint3, b: AnalysisPoint3, c: AnalysisPoint3): number {
  return magnitude(cross(subtract(b, a), subtract(c, a))) / 2;
}

function cylinder(lengthM: number, diameterM: number): FuselageGeometry {
  const station = (id: string, xPositionM: number) => ({ id, xPositionM, widthM: diameterM, heightM: diameterM, lateralCenterM: 0, verticalCenterM: 0, shape: 'circular' as const, superellipseExponent: 2 });
  return { modelVersion: 1, stations: [station('front', 0), station('rear', lengthM)] };
}

function ellipsoid(lengthM: number, diameterM: number, intervalCount: number): FuselageGeometry {
  return {
    modelVersion: 1,
    stations: Array.from({ length: intervalCount + 1 }, (_, index) => {
      const xPositionM = lengthM * index / intervalCount;
      const normalized = 2 * xPositionM / lengthM - 1;
      const sectionDiameter = diameterM * Math.sqrt(Math.max(0, 1 - normalized ** 2));
      return { id: `ellipsoid-${index}`, xPositionM, widthM: sectionDiameter, heightM: sectionDiameter, lateralCenterM: 0, verticalCenterM: 0, shape: 'circular' as const, superellipseExponent: 2 };
    }),
  };
}

function meshIsWatertight(mesh: ReturnType<typeof buildFuselageMeshData>): boolean {
  const key = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
  const owners = new Map<string, number>();
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const [a, b, c] = mesh.indices.slice(index, index + 3);
    for (const edge of [key(a, b), key(b, c), key(c, a)]) owners.set(edge, (owners.get(edge) ?? 0) + 1);
  }
  return [...owners.values()].every((count) => count === 2);
}

describe('M5.7 independent geometry verification', () => {
  it('recovers independent rectangular, trapezoidal, multi-section, and asymmetric planform benchmarks', () => {
    const rectangle = benchmark.rectangularWing;
    const rectangular = calculateWingReferenceProperties(wing([
      { id: 'root', spanPositionM: 0, chordM: rectangle.chordM, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'tip', spanPositionM: rectangle.spanM / 2, chordM: rectangle.chordM, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
    ]));
    expect(rectangular.totalSpanM).toBe(rectangle.spanM);
    expect(rectangular.projectedAreaM2).toBe(rectangle.expected.areaM2);
    expect(rectangular.aspectRatio).toBe(rectangle.expected.aspectRatio);
    expect(rectangular.meanAerodynamicChordM).toBe(rectangle.expected.macM);
    expect(rectangular.meanAerodynamicChordQuarterChordXM).toBe(rectangle.expected.quarterChordXM);

    const trapezoid = benchmark.trapezoidalWing;
    const trapezoidal = calculateWingReferenceProperties(wing([
      { id: 'root', spanPositionM: 0, chordM: trapezoid.rootChordM, leadingEdgeXM: trapezoid.rootLeadingEdgeXM, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'tip', spanPositionM: trapezoid.halfSpanM, chordM: trapezoid.tipChordM, leadingEdgeXM: trapezoid.tipLeadingEdgeXM, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
    ]));
    expect(trapezoidal.totalSpanM).toBeCloseTo(trapezoid.expected.spanM, 13);
    expect(trapezoidal.projectedAreaM2).toBeCloseTo(trapezoid.expected.areaM2, 13);
    expect(trapezoidal.aspectRatio).toBeCloseTo(trapezoid.expected.aspectRatio, 13);
    expect(trapezoidal.meanAerodynamicChordM).toBeCloseTo(trapezoid.expected.macM, 13);
    expect(trapezoidal.meanAerodynamicChordSpanPositionM).toBeCloseTo(trapezoid.expected.macSpanM, 13);
    expect(trapezoidal.meanAerodynamicChordQuarterChordXM).toBeCloseTo(trapezoid.expected.quarterChordXM, 13);

    const multi = benchmark.multiSectionWing;
    const multiSection = calculateWingReferenceProperties(wing(multi.spanStationsM.map((spanPositionM, index) => ({ id: `m${index}`, spanPositionM, chordM: multi.chordsM[index], leadingEdgeXM: multi.leadingEdgesXM[index], geometricTwistDeg: 0, airfoilId: 'NACA 0012' }))));
    expect(multiSection.totalSpanM).toBe(multi.expected.spanM);
    expect(multiSection.projectedAreaM2).toBeCloseTo(multi.expected.areaM2, 13);
    expect(multiSection.aspectRatio).toBeCloseTo(multi.expected.aspectRatio, 13);
    expect(multiSection.meanAerodynamicChordM).toBeCloseTo(multi.expected.macM, 13);

    const asymmetric = benchmark.asymmetricWing;
    const asymmetricProperties = calculateWingReferenceProperties(wing(asymmetric.spanStationsM.map((spanPositionM, index) => ({ id: `a${index}`, spanPositionM, chordM: asymmetric.chordsM[index], leadingEdgeXM: 0.2 * index, geometricTwistDeg: 0, airfoilId: 'NACA 0012' })), 'asymmetric'));
    expect(asymmetricProperties.totalSpanM).toBe(asymmetric.expected.spanM);
    expect(asymmetricProperties.projectedAreaM2).toBeCloseTo(asymmetric.expected.areaM2, 13);
    expect(asymmetricProperties.aspectRatio).toBeCloseTo(asymmetric.expected.aspectRatio, 13);
    expect(asymmetricProperties.meanAerodynamicChordM).toBeCloseTo(asymmetric.expected.macM, 13);
  });

  it('reproduces the published NASA/OpenVSP rectangular-wing dimensions within source rounding', () => {
    const nasa = benchmark.nasaRectangularWing;
    const geometry = wing([
      { id: 'root', spanPositionM: 0, chordM: nasa.chordM, leadingEdgeXM: nasa.publishedLeadingEdgeCenterXM, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'tip', spanPositionM: nasa.spanM / 2, chordM: nasa.chordM, leadingEdgeXM: nasa.publishedLeadingEdgeCenterXM, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
    ]);
    const actual = calculateWingReferenceProperties(geometry);
    expect(actual.projectedAreaM2).toBeCloseTo(nasa.expectedProductAreaM2, 13);
    expect(Math.abs(actual.projectedAreaM2 - nasa.publishedAreaM2)).toBeLessThanOrEqual(0.00013);
    expect(Math.abs(actual.meanAerodynamicChordQuarterChordXM - nasa.publishedQuarterChordCenterXM)).toBeLessThanOrEqual(0.0003);
  });

  it('applies sweep, dihedral, and positive/negative twist once while preserving the quarter-chord axis', () => {
    const dihedralDeg = 7;
    const geometry = wing([
      { id: 'root', spanPositionM: 0, chordM: 2, leadingEdgeXM: 1, geometricTwistDeg: 10, airfoilId: 'NACA 0012' },
      { id: 'tip', spanPositionM: 5, chordM: 1, leadingEdgeXM: 2.25, geometricTwistDeg: -6, airfoilId: 'NACA 0012' },
    ], 'symmetric', [dihedralDeg]);
    const root = transformWingAirfoilPoint({ ...geometry.stations[0], verticalPositionM: 0 }, [0.25, 0]);
    const rootLeading = transformWingAirfoilPoint({ ...geometry.stations[0], verticalPositionM: 0 }, [0, 0]);
    const tip = transformWingAirfoilPoint({ ...geometry.stations[1], verticalPositionM: 5 * Math.tan(radians(dihedralDeg)) }, [0.25, 0]);
    const tipTrailing = transformWingAirfoilPoint({ ...geometry.stations[1], verticalPositionM: 5 * Math.tan(radians(dihedralDeg)) }, [1, 0]);
    expect(root).toEqual([1.5, 0, 0]);
    expect(rootLeading[0]).toBeCloseTo(1.5 - 0.5 * Math.cos(radians(10)), 13);
    expect(rootLeading[2]).toBeCloseTo(0.5 * Math.sin(radians(10)), 13);
    expect(tip).toEqual([2.5, 5, 5 * Math.tan(radians(dihedralDeg))]);
    expect(tipTrailing[2]).toBeCloseTo(tip[2] + 0.75 * Math.sin(radians(6)), 13);
  });

  it('matches circular/elliptical sections, cylinder volume/centroid, and watertight surface convergence', () => {
    expect(fuselageCrossSectionArea(2, 2)).toBeCloseTo(Math.PI, 13);
    expect(fuselageCrossSectionArea(4, 2)).toBeCloseTo(2 * Math.PI, 13);
    const body = cylinder(4, 2);
    const coarse = calculateFuselageProperties(body, 2, 12);
    const medium = calculateFuselageProperties(body, 4, 24);
    const fine = calculateFuselageProperties(body, 8, 96);
    const expectedVolume = 4 * Math.PI;
    const expectedClosedArea = 10 * Math.PI;
    expect(coarse.enclosedVolumeM3).toBeCloseTo(expectedVolume, 12);
    expect(fine.volumeCentroidM).toEqual([2, 0, 0]);
    expect(Math.abs(fine.wettedSurfaceAreaM2 - expectedClosedArea)).toBeLessThan(Math.abs(medium.wettedSurfaceAreaM2 - expectedClosedArea));
    expect(Math.abs(medium.wettedSurfaceAreaM2 - expectedClosedArea)).toBeLessThan(Math.abs(coarse.wettedSurfaceAreaM2 - expectedClosedArea));
    expect(relativeError(fine.wettedSurfaceAreaM2, expectedClosedArea)).toBeLessThan(0.0005);
    expect(meshIsWatertight(buildFuselageMeshData(body, 3, 24))).toBe(true);
  });

  it('converges station-defined spheroids toward the independent ellipsoid volume and centroid', () => {
    const lengthM = 6;
    const diameterM = 2;
    const expectedVolume = 4 * Math.PI / 3 * (lengthM / 2) * (diameterM / 2) ** 2;
    const coarse = calculateFuselageProperties(ellipsoid(lengthM, diameterM, 16), 4, 24);
    const medium = calculateFuselageProperties(ellipsoid(lengthM, diameterM, 32), 4, 24);
    const fine = calculateFuselageProperties(ellipsoid(lengthM, diameterM, 128), 4, 24);
    expect(Math.abs(fine.enclosedVolumeM3 - expectedVolume)).toBeLessThan(Math.abs(medium.enclosedVolumeM3 - expectedVolume));
    expect(Math.abs(medium.enclosedVolumeM3 - expectedVolume)).toBeLessThan(Math.abs(coarse.enclosedVolumeM3 - expectedVolume));
    expect(relativeError(fine.enclosedVolumeM3, expectedVolume)).toBeLessThan(0.001);
    expect(fine.volumeCentroidM[0]).toBeCloseTo(lengthM / 2, 10);
  });

  it('matches independently integrated tail references, moment arms, and volume coefficients', () => {
    const design = designWithWing(wing([
      { id: 'wr', spanPositionM: 0, chordM: 2, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'wt', spanPositionM: 5, chordM: 2, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
    ]));
    design.horizontalTail = {
      modelVersion: 1, lateralPositionM: 0, verticalPositionM: 1, incidenceDeg: 0,
      stations: [
        { id: 'hr', spanPositionM: 0, chordM: 1.5, leadingEdgeXM: 6, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
        { id: 'ht', spanPositionM: 2, chordM: 1, leadingEdgeXM: 6.5, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      ], sections: [{ id: 'hs', fromStationId: 'hr', toStationId: 'ht', dihedralDeg: 0 }],
    };
    design.verticalTail = {
      modelVersion: 1, lateralPositionM: 0, baseVerticalPositionM: 0,
      stations: [
        { id: 'vr', spanPositionM: 0, chordM: 2, leadingEdgeXM: 6, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
        { id: 'vt', spanPositionM: 2, chordM: 1, leadingEdgeXM: 6.5, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      ], sections: [{ id: 'vs', fromStationId: 'vr', toStationId: 'vt', dihedralDeg: 0 }],
    };
    const actual = calculateEmpennageReferenceProperties(design);
    const weightedQuarterChord = (span: number, c0: number, c1: number, q0: number, q1: number) => span * (2 * c0 * q0 + c0 * q1 + c1 * q0 + 2 * c1 * q1) / 6 / (span * (c0 + c1) / 2);
    const horizontalQuarterX = weightedQuarterChord(2, 1.5, 1, 6.375, 6.75);
    const verticalQuarterX = weightedQuarterChord(2, 2, 1, 6.5, 6.75);
    expect(actual.horizontal.projectedAreaM2).toBeCloseTo(5, 13);
    expect(actual.horizontal.aspectRatio).toBeCloseTo(3.2, 13);
    expect(actual.vertical.projectedAreaM2).toBeCloseTo(3, 13);
    expect(actual.vertical.aspectRatio).toBeCloseTo(4 / 3, 13);
    expect(actual.horizontalTailMomentArmM).toBeCloseTo(horizontalQuarterX - 0.5, 13);
    expect(actual.verticalTailMomentArmM).toBeCloseTo(verticalQuarterX - 0.5, 13);
    expect(actual.horizontalTailVolumeCoefficient).toBeCloseTo(5 * (horizontalQuarterX - 0.5) / (20 * 2), 13);
    expect(actual.verticalTailVolumeCoefficient).toBeCloseTo(3 * (verticalQuarterX - 0.5) / (20 * 10), 13);
  });

  it('preserves control area, differential signs, and every hinge-axis point under rotation', () => {
    const design = designWithWing(wing([
      { id: 'root', spanPositionM: 0, chordM: 2, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'tip', spanPositionM: 5, chordM: 2, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
    ]));
    const control = { id: 'aileron', name: 'Benchmark aileron', kind: 'aileron' as const, parentSurface: 'wing' as const, enabled: true, spanStartM: 1, spanEndM: 4, chordFraction: 0.25, hingeChordFraction: 0.75, minimumDeflectionDeg: -20, maximumDeflectionDeg: 20, currentDeflectionDeg: 15, operation: 'differential' as const, side: 'both' as const };
    design.controlSurfaces.surfaces = [control];
    const properties = calculateControlSurfaceProperties(design, control);
    const geometry = buildControlSurfaceGeometry(design, control);
    expect(properties.totalProjectedSpanM).toBe(6);
    expect(properties.projectedAreaM2).toBe(3);
    expect(properties.instances.find((instance) => instance.side === 'starboard')?.physicalDeflectionDeg).toBe(15);
    expect(properties.instances.find((instance) => instance.side === 'port')?.physicalDeflectionDeg).toBe(15);
    const trailingEdgeDisplacements = new Map(geometry.map((instance) => {
      const trailingEdgeIndex = instance.neutralVertices.reduce((best, point, index, points) => point[0] > points[best][0] ? index : best, 0);
      return [instance.side, instance.deflectedVertices[trailingEdgeIndex][2] - instance.neutralVertices[trailingEdgeIndex][2]];
    }));
    expect(trailingEdgeDisplacements.get('port')! * trailingEdgeDisplacements.get('starboard')!).toBeLessThan(0);
    geometry.forEach((instance) => {
      expect(instance.hingeStart[0]).toBeCloseTo(1.5, 13);
      expect(instance.hingeEnd[0]).toBeCloseTo(1.5, 13);
      expect(distance(instance.hingeStart, instance.hingeStart)).toBe(0);
      instance.neutralVertices.forEach((point, index) => {
        const axis = subtract(instance.hingeEnd, instance.hingeStart);
        const neutralRadius = magnitude(cross(subtract(point, instance.hingeStart), axis)) / magnitude(axis);
        const deflectedRadius = magnitude(cross(subtract(instance.deflectedVertices[index], instance.hingeStart), axis)) / magnitude(axis);
        expect(deflectedRadius).toBeCloseTo(neutralRadius, 11);
      });
    });
  });

  it('independently verifies panel geometry, frames, reference points, winding, and mirrored circulation orientation', () => {
    const design = designWithWing(wing([
      { id: 'root', spanPositionM: 0, chordM: 2, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'tip', spanPositionM: 5, chordM: 2, leadingEdgeXM: 0, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
    ]));
    const mesh = generateAnalysisMesh(design, meshConfiguration());
    expect(mesh.validation.valid).toBe(true);
    expect(mesh.panels.map((panel) => panel.id)).toEqual(['wing:s0:c0', 'wing:s1:c0']);
    const [port, starboard] = mesh.panels;
    expect(port.corners).toEqual({ leadingSpanStart: [0, -5, 0], trailingSpanStart: [2, -5, 0], trailingSpanEnd: [2, 0, 0], leadingSpanEnd: [0, 0, 0] });
    expect(starboard.corners).toEqual({ leadingSpanStart: [0, 0, 0], trailingSpanStart: [2, 0, 0], trailingSpanEnd: [2, 5, 0], leadingSpanEnd: [0, 5, 0] });
    for (const panel of mesh.panels) {
      const independentArea = triangleArea(panel.corners.leadingSpanStart, panel.corners.trailingSpanStart, panel.corners.trailingSpanEnd) + triangleArea(panel.corners.leadingSpanStart, panel.corners.trailingSpanEnd, panel.corners.leadingSpanEnd);
      expect(panel.areaM2).toBeCloseTo(independentArea, 13);
      expect(panel.areaM2).toBe(10);
      expect(magnitude(panel.unitNormal)).toBeCloseTo(1, 13);
      expect(panel.unitNormal).toEqual([0, 0, 1]);
      expect(panel.localChordDirection).toEqual([1, 0, 0]);
      expect(panel.localSpanDirection).toEqual([0, 1, 0]);
      expect(panel.boundVortexStartM[0]).toBeCloseTo(0.5, 13);
      expect(panel.boundVortexEndM[0]).toBeCloseTo(0.5, 13);
      expect(panel.boundVortexEndM[1]).toBeGreaterThan(panel.boundVortexStartM[1]);
      expect(panel.collocationPointM[0]).toBeCloseTo(1.5, 13);
      expect(panel.trailingEdge).toBe(true);
      expect(dot(subtract(panel.boundVortexEndM, panel.boundVortexStartM), panel.localSpanDirection)).toBeGreaterThan(0);
    }
    expect(port.corners.leadingSpanEnd).toEqual(starboard.corners.leadingSpanStart);
    expect(port.corners.trailingSpanEnd).toEqual(starboard.corners.trailingSpanStart);
  });

  it('preserves station/control boundaries, vertical-tail orientation, neutral controls, and deterministic topology', () => {
    const design = structuredClone(defaultDesign);
    design.controlSurfaces.surfaces = [{ id: 'flap', name: 'Boundary flap', kind: 'flap', parentSurface: 'wing', enabled: true, spanStartM: 0.5, spanEndM: 3.5, chordFraction: 0.3, hingeChordFraction: 0.7, minimumDeflectionDeg: 0, maximumDeflectionDeg: 40, currentDeflectionDeg: 10, operation: 'symmetric', side: 'both' }];
    const configuration = meshConfiguration({ surfaceIds: ['wing', 'horizontal-tail', 'vertical-tail'], chordwisePanels: 3, spanwisePanelsPerSection: 3, chordwiseSpacing: 'cosine', spanwiseSpacing: 'cosine' });
    const first = generateAnalysisMesh(design, configuration);
    const second = generateAnalysisMesh(design, configuration);
    expect(first).toEqual(second);
    expect(first.validation.valid).toBe(true);
    const wingSurface = first.surfaces.find((surface) => surface.id === 'wing')!;
    expect(wingSurface.spanBreakCoordinatesM).toEqual(expect.arrayContaining([-3.5, -0.5, 0, 0.5, 3.5]));
    expect(wingSurface.chordBreakFractions).toContain(0.7);
    expect(first.panels.some((panel) => panel.parentControlSurfaceId === 'flap')).toBe(true);
    expect(first.geometryState).toBe('neutral');
    expect(first.validation.warnings.some((warning) => warning.code === 'unsupported-configuration')).toBe(true);
    expect(first.panels.filter((panel) => panel.parentSurfaceId === 'vertical-tail').every((panel) => panel.unitNormal[1] > 0 && panel.boundVortexEndM[2] > panel.boundVortexStartM[2])).toBe(true);
    for (const surface of first.surfaces) {
      const surfacePanels = first.panels.filter((panel) => panel.parentSurfaceId === surface.id);
      const signatures = surfacePanels.map((panel) => Object.values(panel.corners).map((point) => point.map((value) => value.toFixed(10)).join(',')).sort().join('|'));
      expect(new Set(signatures).size).toBe(signatures.length);
      expect(surfacePanels.filter((panel) => panel.trailingEdge)).toHaveLength(surface.spanBreakCoordinatesM.length - 1);
      const edges = new Map<string, number>();
      const edgeKey = (a: AnalysisPoint3, b: AnalysisPoint3) => [a, b].map((point) => point.map((value) => value.toFixed(10)).join(',')).sort().join('|');
      surfacePanels.forEach((panel) => {
        const c = panel.corners;
        for (const [a, b] of [[c.leadingSpanStart, c.trailingSpanStart], [c.trailingSpanStart, c.trailingSpanEnd], [c.trailingSpanEnd, c.leadingSpanEnd], [c.leadingSpanEnd, c.leadingSpanStart]] as [AnalysisPoint3, AnalysisPoint3][]) {
          const key = edgeKey(a, b); edges.set(key, (edges.get(key) ?? 0) + 1);
        }
      });
      expect([...edges.values()].every((ownerCount) => ownerCount === 1 || ownerCount === 2)).toBe(true);
      expect([...edges.values()].some((ownerCount) => ownerCount === 2)).toBe(true);
    }
    const degenerate = structuredClone(design);
    degenerate.wing.stations[1].chordM = 0;
    const rejected = generateAnalysisMesh(degenerate, configuration);
    expect(rejected.panels).toEqual([]);
    expect(rejected.validation.errors.some((error) => error.code === 'invalid-parent-geometry')).toBe(true);
  });

  it('keeps rendered loft stations and computational boundaries on the same authoritative geometry', () => {
    const geometry = wing([
      { id: 'root', spanPositionM: 0, chordM: 2.5, leadingEdgeXM: 1, geometricTwistDeg: 3, airfoilId: 'NACA 2412' },
      { id: 'break', spanPositionM: 2, chordM: 1.8, leadingEdgeXM: 1.4, geometricTwistDeg: 0, airfoilId: 'NACA 2412' },
      { id: 'tip', spanPositionM: 5, chordM: 0.9, leadingEdgeXM: 2.2, geometricTwistDeg: -4, airfoilId: 'NACA 0012' },
    ], 'symmetric', [3, 6]);
    const design = designWithWing(geometry);
    const rendered = wingMesh(design);
    const analysis = generateAnalysisMesh(design, meshConfiguration({ chordwisePanels: 4, spanwisePanelsPerSection: 4, chordwiseSpacing: 'cosine', spanwiseSpacing: 'cosine' }));
    const renderPositions = rendered.getAttribute('position');
    const renderSpanCoordinates = Array.from({ length: renderPositions.count }, (_, index) => renderPositions.getY(index));
    analysis.surfaces[0].stationBoundaryCoordinatesM.forEach((boundary) => expect(renderSpanCoordinates.some((value) => Math.abs(value - boundary) < 1e-6)).toBe(true));
    expect(Math.min(...renderSpanCoordinates)).toBeCloseTo(-5, 6);
    expect(Math.max(...renderSpanCoordinates)).toBeCloseTo(5, 6);
    expect(Array.from(rendered.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
    expect(meshIsWatertight({ vertices: Array.from({ length: renderPositions.count }, (_, index) => [renderPositions.getX(index), renderPositions.getY(index), renderPositions.getZ(index)] as AnalysisPoint3), indices: Array.from(rendered.index!.array) })).toBe(true);
  });

  it('separates projected reference area from convergent three-dimensional mean-surface area', () => {
    const geometry = wing([
      { id: 'root', spanPositionM: 0, chordM: 2.4, leadingEdgeXM: 1, geometricTwistDeg: 4, airfoilId: 'NACA 2412' },
      { id: 'tip', spanPositionM: 5, chordM: 1.1, leadingEdgeXM: 2.3, geometricTwistDeg: -5, airfoilId: 'NACA 4412' },
    ], 'symmetric', [7]);
    const design = designWithWing(geometry);
    const referenceArea = 5 * (2.4 + 1.1);
    expect(calculateWingReferenceProperties(geometry).projectedAreaM2).toBeCloseTo(referenceArea, 13);
    const configurations = [meshConfiguration({ chordwisePanels: 2, spanwisePanelsPerSection: 2 }), meshConfiguration({ chordwisePanels: 6, spanwisePanelsPerSection: 8, chordwiseSpacing: 'cosine', spanwiseSpacing: 'cosine' }), meshConfiguration({ chordwisePanels: 12, spanwisePanelsPerSection: 16, chordwiseSpacing: 'cosine', spanwiseSpacing: 'cosine' })];
    const meshes = configurations.map((configuration) => generateAnalysisMesh(design, configuration));
    const [coarse, medium, fine] = meshes.map((mesh) => mesh.panels.reduce((sum, panel) => sum + panel.areaM2, 0));
    expect(meshes.map((mesh) => mesh.panels.length)).toEqual([8, 96, 384]);
    expect(meshes.every((mesh) => mesh.validation.valid && mesh.validation.warnings.length === 0)).toBe(true);
    expect(meshes.map((mesh) => Math.max(...mesh.panels.map((panel) => { const chord = (distance(panel.corners.leadingSpanStart, panel.corners.trailingSpanStart) + distance(panel.corners.leadingSpanEnd, panel.corners.trailingSpanEnd)) / 2; const span = (distance(panel.corners.leadingSpanStart, panel.corners.leadingSpanEnd) + distance(panel.corners.trailingSpanStart, panel.corners.trailingSpanEnd)) / 2; return Math.max(chord, span) / Math.min(chord, span); }))).every((aspectRatio) => aspectRatio < 30)).toBe(true);
    expect(Math.abs(fine - medium)).toBeLessThan(Math.abs(medium - coarse));
    expect(relativeError(fine, medium)).toBeLessThan(0.0002);
    expect(fine).toBeGreaterThan(referenceArea);
    expect(calculateWingReferenceProperties(geometry).projectedAreaM2).toBe(referenceArea);
  });

  it('retains schema-v1/v2 geometry equivalence and revision-based mesh invalidation', () => {
    const legacyV1 = {
      ...structuredClone(defaultDesign), schemaVersion: 1 as const,
      wing: { spanM: 12, rootChordM: 2, taperRatio: 0.5, sweepDeg: 3, dihedralDeg: 3, twistDeg: -1.5, airfoil: 'NACA 2412', rootLeadingEdgeXM: 2.2, verticalPositionM: -0.38 },
      fuselage: { lengthM: 9.2, maxDiameterM: 1.34, noseLengthM: 1.35, cabinLengthM: 3.4 },
      horizontalTail: { spanM: 4.5, rootChordM: 1.25, taperRatio: 0.416, sweepDeg: 10, incidenceDeg: 0, rootLeadingEdgeXM: 7.25, verticalPositionM: 0.36 },
      verticalTail: { heightM: 2.05, rootChordM: 1.85, taperRatio: 0.227, sweepDeg: 20, rootLeadingEdgeXM: 6.55, basePositionM: 0.62 },
      controlSurfaces: undefined,
    } as unknown as LegacyAircraftDesignV1;
    const migratedV1 = migrateAircraftDesignV1(legacyV1);
    const expectedArea = 12 * (2 + 1) / 2;
    expect(migratedV1.schemaVersion).toBe(3);
    expect(calculateWingReferenceProperties(migratedV1.wing).projectedAreaM2).toBeCloseTo(expectedArea, 13);
    expect(migratedV1.controlSurfaces.surfaces).toEqual([]);

    const legacyV2 = {
      ...structuredClone(defaultDesign), schemaVersion: 2 as const,
      fuselage: { lengthM: 9.2, maxDiameterM: 1.34, noseLengthM: 1.35, cabinLengthM: 3.4 },
      horizontalTail: { spanM: 4.5, rootChordM: 1.25, taperRatio: 0.416, sweepDeg: 10, incidenceDeg: 0, rootLeadingEdgeXM: 7.25, verticalPositionM: 0.36 },
      verticalTail: { heightM: 2.05, rootChordM: 1.85, taperRatio: 0.227, sweepDeg: 20, rootLeadingEdgeXM: 6.55, basePositionM: 0.62 },
    } as unknown as LegacyAircraftDesignV2;
    const migratedV2 = migrateAircraftDesignV2(legacyV2);
    expect(calculateWingReferenceProperties(migratedV2.wing)).toEqual(calculateWingReferenceProperties(defaultDesign.wing));
    const mesh = generateAnalysisMesh(migratedV2, meshConfiguration());
    expect(isAnalysisMeshStale(mesh, migratedV2)).toBe(false);
    expect(isAnalysisMeshStale(mesh, { ...migratedV2, revision: migratedV2.revision + 1 })).toBe(true);
  });
});

