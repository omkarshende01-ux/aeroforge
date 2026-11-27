import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { defaultDesign, type AircraftDesign, type WingGeometry } from '../domain/types';
import { wingMesh } from './geometry';
import { calculateWingReferenceProperties, physicalWingStations, type PhysicalWingStation } from './wingGeometry';
import { buildWingLoftRings, interpolateAirfoilCoordinates, transformWingAirfoilPoint, wingStationCrossSection } from './wingLoft';

function symmetricWing(tipPatch: Partial<WingGeometry['stations'][number]> = {}, dihedralDeg = 0): WingGeometry {
  return {
    modelVersion: 2,
    symmetry: 'symmetric',
    verticalPositionM: 0.5,
    stations: [
      { id: 'root', spanPositionM: 0, chordM: 2, leadingEdgeXM: 1, geometricTwistDeg: 0, airfoilId: 'NACA 0012' },
      { id: 'tip', spanPositionM: 5, chordM: 2, leadingEdgeXM: 1, geometricTwistDeg: 0, airfoilId: 'NACA 0012', ...tipPatch },
    ],
    sections: [{ id: 'panel', fromStationId: 'root', toStationId: 'tip', dihedralDeg }],
  };
}

function faceNormal(geometry: THREE.BufferGeometry, indexOffset: number): [number, number, number] {
  const positions = geometry.getAttribute('position'); const indices = geometry.index!;
  const point = (indexIndex: number) => {
    const vertex = indices.getX(indexIndex);
    return [positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)] as const;
  };
  const a = point(indexOffset); const b = point(indexOffset + 1); const c = point(indexOffset + 2);
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
}

describe('M5.3 section-level airfoil lofting', () => {
  it('keeps an untwisted rectangular wing section in its exact aircraft station plane', () => {
    const wing = symmetricWing(); const stations = physicalWingStations(wing); const root = stations[1]; const section = wingStationCrossSection(root);
    expect(section.every(([, y]) => y === 0)).toBe(true);
    expect(Math.min(...section.map(([x]) => x))).toBeCloseTo(1, 3);
    expect(Math.max(...section.map(([x]) => x))).toBeCloseTo(3, 3);
    const rings = buildWingLoftRings(wing);
    expect(rings).toHaveLength(9);
    expect(rings.every((ring) => ring.points.every((point) => point.every(Number.isFinite)))).toBe(true);
  });

  it('applies sweep and dihedral once to the station reference position', () => {
    const sweepDeg = 12; const dihedralDeg = 7;
    const wing = symmetricWing({ leadingEdgeXM: 1 + 5 * Math.tan(sweepDeg * Math.PI / 180) }, dihedralDeg);
    const tip = physicalWingStations(wing).at(-1)!;
    expect(tip.leadingEdgeXM).toBeCloseTo(1 + 5 * Math.tan(sweepDeg * Math.PI / 180), 12);
    expect(tip.verticalPositionM).toBeCloseTo(0.5 + 5 * Math.tan(dihedralDeg * Math.PI / 180), 12);
    expect(transformWingAirfoilPoint(tip, [0.25, 0])).toEqual([tip.leadingEdgeXM + 0.5, 5, tip.verticalPositionM]);
  });

  it('supports positive wash-in and negative washout about an invariant quarter-chord', () => {
    const base: PhysicalWingStation = { id: 'station', spanPositionM: 3, chordM: 2, leadingEdgeXM: 4, verticalPositionM: 1, geometricTwistDeg: 8, airfoilId: 'NACA 0012' };
    const quarter = transformWingAirfoilPoint(base, [0.25, 0]);
    expect(quarter).toEqual([4.5, 3, 1]);
    expect(transformWingAirfoilPoint(base, [0, 0])[2]).toBeGreaterThan(1);
    expect(transformWingAirfoilPoint({ ...base, geometricTwistDeg: -8 }, [0, 0])[2]).toBeLessThan(1);
    expect(transformWingAirfoilPoint(base, [1, 0])[2]).toBeLessThan(1);
  });

  it('smoothly blends corresponding cosine-sampled coordinates between different profiles', () => {
    const root = interpolateAirfoilCoordinates('NACA 0012', 'NACA 4412', 0);
    const middle = interpolateAirfoilCoordinates('NACA 0012', 'NACA 4412', 0.5);
    const tip = interpolateAirfoilCoordinates('NACA 0012', 'NACA 4412', 1);
    expect(root).toHaveLength(tip.length);
    middle.forEach((point, index) => {
      expect(point[0]).toBeCloseTo((root[index][0] + tip[index][0]) / 2, 12);
      expect(point[1]).toBeCloseTo((root[index][1] + tip[index][1]) / 2, 12);
    });
    const rings = buildWingLoftRings(symmetricWing({ airfoilId: 'NACA 4412' }));
    expect(rings[6].fromAirfoilId).toBe('NACA 0012');
    expect(rings[6].toAirfoilId).toBe('NACA 4412');
    expect(rings[6].airfoilBlendFraction).toBe(0.5);
  });

  it('expands symmetric geometry and preserves explicit asymmetric stations', () => {
    const symmetric = buildWingLoftRings(symmetricWing());
    expect(symmetric[0].spanPositionM).toBe(-5); expect(symmetric.at(-1)?.spanPositionM).toBe(5);
    const asymmetric: WingGeometry = {
      modelVersion: 2, symmetry: 'asymmetric', verticalPositionM: 0,
      stations: [
        { id: 'port', spanPositionM: -3, chordM: 1.2, leadingEdgeXM: 2, geometricTwistDeg: 4, airfoilId: 'NACA 4412' },
        { id: 'root', spanPositionM: 0, chordM: 2, leadingEdgeXM: 1, geometricTwistDeg: 0, airfoilId: 'NACA 2412' },
        { id: 'starboard', spanPositionM: 5, chordM: 0.8, leadingEdgeXM: 2.5, geometricTwistDeg: -5, airfoilId: 'NACA 0012' },
      ],
      sections: [
        { id: 'port-panel', fromStationId: 'port', toStationId: 'root', dihedralDeg: -4 },
        { id: 'starboard-panel', fromStationId: 'root', toStationId: 'starboard', dihedralDeg: 6 },
      ],
    };
    const rings = buildWingLoftRings(asymmetric);
    expect(rings[0].spanPositionM).toBe(-3); expect(rings.at(-1)?.spanPositionM).toBe(5);
    expect(rings[0].chordM).toBe(1.2); expect(rings.at(-1)?.chordM).toBe(0.8);
  });

  it('builds finite nondegenerate triangles with outward tip-cap winding', () => {
    const wing = symmetricWing({ leadingEdgeXM: 2, geometricTwistDeg: -6, airfoilId: 'NACA 4412' }, 5);
    const design: AircraftDesign = { ...defaultDesign, wing }; const geometry = wingMesh(design);
    const positions = geometry.getAttribute('position'); const normals = geometry.getAttribute('normal'); const indices = geometry.index!;
    expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
    for (let offset = 0; offset < indices.count; offset += 3) {
      const normal = faceNormal(geometry, offset); expect(Math.hypot(...normal)).toBeGreaterThan(1e-10);
    }
    const edgeUse = new Map<string, number>();
    for (let offset = 0; offset < indices.count; offset += 3) {
      const triangle = [indices.getX(offset), indices.getX(offset + 1), indices.getX(offset + 2)];
      for (let edge = 0; edge < 3; edge += 1) {
        const pair = [triangle[edge], triangle[(edge + 1) % 3]].sort((a, b) => a - b);
        const key = `${pair[0]}|${pair[1]}`; edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
      }
    }
    expect([...edgeUse.values()].every((uses) => uses === 2)).toBe(true);
    const rings = buildWingLoftRings(wing); const ringSize = rings[0].points.length;
    const capStart = (rings.length - 1) * ringSize * 6;
    expect(faceNormal(geometry, capStart)[1]).toBeLessThan(0);
    expect(faceNormal(geometry, capStart + ringSize * 3)[1]).toBeGreaterThan(0);
    geometry.dispose();
  });

  it('does not change analytical reference metrics when the loft is refined', () => {
    const before = calculateWingReferenceProperties(defaultDesign.wing);
    const coarse = buildWingLoftRings(defaultDesign.wing, 1); const refined = buildWingLoftRings(defaultDesign.wing, 8);
    const after = calculateWingReferenceProperties(defaultDesign.wing);
    expect(refined.length).toBeGreaterThan(coarse.length);
    expect(after).toEqual(before);
  });
});
