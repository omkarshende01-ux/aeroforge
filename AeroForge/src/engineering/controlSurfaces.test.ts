import { describe, expect, it } from 'vitest';
import { defaultDesign, type AircraftDesign, type ControlSurfaceDefinition, type ControlSurfaceKind } from '../domain/types';
import { calculateMetrics } from './metrics';
import {
  addControlSurface,
  buildControlSurfaceGeometry,
  calculateControlSurfaceProperties,
  editControlSurface,
  neutralizeControlSurfaces,
  rotatePointAboutAxis,
  validateControlSurfaceModel,
} from './controlSurfaces';

function definition(kind: ControlSurfaceKind, patch: Partial<ControlSurfaceDefinition> = {}): ControlSurfaceDefinition {
  const parentSurface = kind === 'aileron' || kind === 'flap' ? 'wing' : kind === 'elevator' ? 'horizontal-tail' : 'vertical-tail';
  const operation = kind === 'aileron' ? 'differential' : kind === 'rudder' ? 'independent' : 'symmetric';
  return {
    id: `${kind}-test`, name: `${kind} test`, kind, parentSurface, enabled: true,
    spanStartM: 1, spanEndM: kind === 'rudder' ? 1.6 : 4,
    chordFraction: 0.25, hingeChordFraction: 0.75,
    minimumDeflectionDeg: -30, maximumDeflectionDeg: 30, currentDeflectionDeg: 0,
    operation, side: kind === 'rudder' ? 'center' : 'both', ...patch,
  };
}

function withControls(...surfaces: ControlSurfaceDefinition[]): AircraftDesign {
  return { ...structuredClone(defaultDesign), controlSurfaces: { modelVersion: 1, surfaces } };
}

function distance(point: readonly number[], axisPoint: readonly number[]): number { return Math.hypot(point[0] - axisPoint[0], point[1] - axisPoint[1], point[2] - axisPoint[2]); }
function signedMeshVolume(vertices: readonly (readonly number[])[], indices: readonly number[]): number {
  let volume = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const a = vertices[indices[index]]; const b = vertices[indices[index + 1]]; const c = vertices[indices[index + 2]];
    volume += a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return volume / 6;
}

describe('M5.4 parametric control surfaces', () => {
  it('calculates linked control area on rectangular and tapered wings', () => {
    const rectangular = withControls(definition('flap'));
    rectangular.wing.stations[1] = { ...rectangular.wing.stations[1], chordM: 2, leadingEdgeXM: rectangular.wing.stations[0].leadingEdgeXM };
    expect(calculateControlSurfaceProperties(rectangular, rectangular.controlSurfaces.surfaces[0]).projectedAreaM2).toBeCloseTo(3, 12);

    const taperedSurface = definition('flap', { chordFraction: 0.3, hingeChordFraction: 0.7 });
    const tapered = withControls(taperedSurface);
    const rootChord = 2 - 1 / 6; const tipChord = 2 - 4 / 6;
    const expected = 2 * 3 * (rootChord + tipChord) / 2 * 0.3;
    expect(calculateControlSurfaceProperties(tapered, taperedSurface).projectedAreaM2).toBeCloseTo(expected, 12);
  });

  it('interpolates swept, tapered, dihedral and twisted parent geometry into the hinge axis', () => {
    const surface = definition('aileron', { spanStartM: 2, spanEndM: 5, currentDeflectionDeg: 12 }); const design = withControls(surface);
    const properties = calculateControlSurfaceProperties(design, surface); const starboard = properties.instances.find((instance) => instance.side === 'starboard')!;
    expect(starboard.hingeStart[1]).toBe(2); expect(starboard.hingeEnd[1]).toBe(5);
    expect(starboard.hingeEnd[0]).not.toBeCloseTo(starboard.hingeStart[0], 6);
    expect(starboard.hingeEnd[2]).toBeGreaterThan(starboard.hingeStart[2]);
    expect(starboard.hingeStraightnessDeviationM).toBeGreaterThan(0);
  });

  it('preserves every point on the three-dimensional hinge axis during deflection', () => {
    const surface = definition('aileron', { currentDeflectionDeg: 18 }); const design = withControls(surface);
    const instance = buildControlSurfaceGeometry(design, surface)[1];
    for (const fraction of [0, 0.25, 0.5, 1]) {
      const point = instance.hingeStart.map((value, index) => value + fraction * (instance.hingeEnd[index] - value)) as [number, number, number];
      const rotated = rotatePointAboutAxis(point, instance.hingeStart, instance.hingeEnd, instance.physicalDeflectionDeg);
      expect(distance(rotated, point)).toBeLessThan(1e-12);
    }
  });

  it('uses consistent outward winding for mirrored closed control skins', () => {
    const surface = definition('flap'); const geometry = buildControlSurfaceGeometry(withControls(surface), surface);
    const volumes = geometry.map((instance) => signedMeshVolume(instance.neutralVertices, instance.indices));
    expect(Math.abs(volumes[0])).toBeGreaterThan(1e-6); expect(Math.abs(volumes[1])).toBeGreaterThan(1e-6);
    expect(Math.sign(volumes[0])).toBe(Math.sign(volumes[1]));
  });

  it('maps positive and negative linked commands to trailing-edge-down physical angles on both sides', () => {
    const positive = definition('flap', { currentDeflectionDeg: 15 }); const design = withControls(positive);
    const instances = buildControlSurfaceGeometry(design, positive);
    expect(instances.find((instance) => instance.side === 'port')?.physicalDeflectionDeg).toBe(-15);
    expect(instances.find((instance) => instance.side === 'starboard')?.physicalDeflectionDeg).toBe(15);
    instances.forEach((instance) => expect(instance.deflectedVertices[0][2]).toBeLessThan(instance.neutralVertices[0][2]));
    const negative = definition('flap', { currentDeflectionDeg: -12 });
    buildControlSurfaceGeometry(withControls(negative), negative).forEach((instance) => expect(instance.deflectedVertices[0][2]).toBeGreaterThan(instance.neutralVertices[0][2]));
  });

  it('supports differential ailerons and independent side operation', () => {
    const differential = definition('aileron', { currentDeflectionDeg: 10 }); const design = withControls(differential);
    const instances = buildControlSurfaceGeometry(design, differential); const port = instances.find((instance) => instance.side === 'port')!; const starboard = instances.find((instance) => instance.side === 'starboard')!;
    expect(port.physicalDeflectionDeg).toBe(10); expect(starboard.physicalDeflectionDeg).toBe(10);
    expect(port.deflectedVertices[0][2]).toBeGreaterThan(port.neutralVertices[0][2]);
    expect(starboard.deflectedVertices[0][2]).toBeLessThan(starboard.neutralVertices[0][2]);
    const independent = editControlSurface(design, differential.id, { operation: 'independent', side: 'port', currentDeflectionDeg: -8 });
    expect(independent.errors).toEqual([]); expect(independent.model?.surfaces[0].side).toBe('port');
    expect(calculateControlSurfaceProperties({ ...design, controlSurfaces: independent.model! }, independent.model!.surfaces[0]).instances).toHaveLength(1);
  });

  it('supports linked elevators and an independently deflected rudder through tail adapters', () => {
    const elevator = definition('elevator', { spanStartM: 0.2, spanEndM: 1.1, currentDeflectionDeg: -10 });
    const rudder = definition('rudder', { spanStartM: 0.2, spanEndM: 0.8, currentDeflectionDeg: 14 });
    const design = withControls(elevator, rudder);
    expect(calculateControlSurfaceProperties(design, elevator).instances.map((instance) => instance.physicalDeflectionDeg)).toEqual([10, -10]);
    const rudderGeometry = buildControlSurfaceGeometry(design, rudder);
    expect(rudderGeometry).toHaveLength(1); expect(rudderGeometry[0].side).toBe('center'); expect(rudderGeometry[0].physicalDeflectionDeg).toBe(14);
    expect(rudderGeometry[0].deflectedVertices.some((point, index) => Math.abs(point[1] - rudderGeometry[0].neutralVertices[index][1]) > 1e-4)).toBe(true);
  });

  it('rejects invalid limits, overlaps, incompatible parents and station-break crossings', () => {
    const first = definition('flap', { id: 'flap-a', name: 'Flap A', spanStartM: 1, spanEndM: 3 });
    const overlap = definition('aileron', { id: 'aileron-b', name: 'Aileron B', spanStartM: 2.5, spanEndM: 5 });
    expect(validateControlSurfaceModel(withControls(first, overlap)).errors.join(' ')).toMatch(/overlaps/);
    expect(validateControlSurfaceModel(withControls({ ...first, spanEndM: 8 })).errors.join(' ')).toMatch(/exceeds/);
    expect(validateControlSurfaceModel(withControls({ ...first, chordFraction: 0.4 })).errors.join(' ')).toMatch(/must equal 1/);
    expect(validateControlSurfaceModel(withControls({ ...first, parentSurface: 'horizontal-tail' })).errors.join(' ')).toMatch(/must use parent wing/);
    const multiPanel = withControls(first); multiPanel.wing.stations.splice(1, 0, { id: 'break', spanPositionM: 2, chordM: 1.7, leadingEdgeXM: 2.5, geometricTwistDeg: -1, airfoilId: 'NACA 2412' });
    multiPanel.wing.sections = [
      { id: 'inner', fromStationId: 'wing-root', toStationId: 'break', dihedralDeg: 3 },
      { id: 'outer', fromStationId: 'break', toStationId: 'wing-tip', dihedralDeg: 3 },
    ];
    expect(validateControlSurfaceModel(multiPanel).errors.join(' ')).toMatch(/crosses a wing station break/);
  });

  it('recovers exact neutral geometry and preserves existing wing metrics', () => {
    const surface = definition('aileron', { currentDeflectionDeg: 20 }); const design = withControls(surface); const metrics = calculateMetrics(design);
    const neutral = neutralizeControlSurfaces(design); const neutralDesign = { ...design, controlSurfaces: neutral.model! }; const geometry = buildControlSurfaceGeometry(neutralDesign, neutral.model!.surfaces[0]);
    geometry.forEach((instance) => expect(instance.deflectedVertices).toEqual(instance.neutralVertices));
    expect(calculateMetrics(neutralDesign)).toEqual(metrics);
  });

  it('creates every supported conventional control type with valid defaults', () => {
    let design = withControls();
    for (const kind of ['aileron', 'flap', 'elevator', 'rudder'] as ControlSurfaceKind[]) {
      const result = addControlSurface(design, kind); expect(result.errors).toEqual([]); design = { ...design, controlSurfaces: result.model! };
    }
    expect(design.controlSurfaces.surfaces.map((surface) => surface.kind)).toEqual(['aileron', 'flap', 'elevator', 'rudder']);
  });
});
