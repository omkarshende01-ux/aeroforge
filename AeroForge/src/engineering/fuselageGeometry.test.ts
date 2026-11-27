import { describe, expect, it } from 'vitest';
import type { FuselageGeometry, FuselageStation } from '../domain/types';
import {
  buildFuselageMeshData, calculateFuselageProperties, duplicateFuselageStation,
  fuselageCrossSectionArea, insertFuselageStationAfter, migrateLegacyFuselage,
  removeFuselageStation, sampleFuselageAtX, validateFuselageGeometry,
} from './fuselageGeometry';

function station(id: string, x: number, width: number, height = width): FuselageStation {
  return { id, xPositionM: x, widthM: width, heightM: height, lateralCenterM: 0, verticalCenterM: 0, shape: width === height ? 'circular' : 'elliptical', superellipseExponent: 2 };
}

function cylinder(length = 5, diameter = 2): FuselageGeometry {
  return { modelVersion: 1, stations: [station('front', 0, diameter), station('rear', length, diameter)] };
}

function meshEdges(mesh: ReturnType<typeof buildFuselageMeshData>): Map<string, { count: number; direction: number }> {
  const edges = new Map<string, { count: number; direction: number }>();
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const triangle = mesh.indices.slice(index, index + 3);
    [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]].forEach(([a, b]) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`; const previous = edges.get(key) ?? { count: 0, direction: 0 }; edges.set(key, { count: previous.count + 1, direction: previous.direction + (a < b ? 1 : -1) });
    });
  }
  return edges;
}

describe('M5.5 fuselage station geometry', () => {
  it('matches circular, elliptical, cylinder-volume, and centroid benchmarks', () => {
    expect(fuselageCrossSectionArea(2, 2)).toBeCloseTo(Math.PI, 12);
    expect(fuselageCrossSectionArea(4, 2)).toBeCloseTo(2 * Math.PI, 12);
    const properties = calculateFuselageProperties(cylinder());
    expect(properties.enclosedVolumeM3).toBeCloseTo(5 * Math.PI, 10);
    expect(properties.volumeCentroidM[0]).toBeCloseTo(2.5, 12); expect(properties.volumeCentroidM[1]).toBe(0); expect(properties.volumeCentroidM[2]).toBe(0);
  });

  it('converges to the closed-cylinder surface area as discretization increases', () => {
    const exact = 12 * Math.PI;
    const coarse = calculateFuselageProperties(cylinder(), 1, 8).wettedSurfaceAreaM2;
    const fine = calculateFuselageProperties(cylinder(), 4, 192).wettedSurfaceAreaM2;
    expect(Math.abs(fine - exact)).toBeLessThan(Math.abs(coarse - exact));
    expect(fine).toBeCloseTo(exact, 2);
  });

  it('approaches an ellipsoid volume benchmark with dense analytical stations', () => {
    const semiLength = 3; const semiWidth = 1.2; const semiHeight = 0.8;
    const stations = Array.from({ length: 81 }, (_, index) => {
      const x = 2 * semiLength * index / 80; const normalized = (x - semiLength) / semiLength; const scale = Math.sqrt(Math.max(0, 1 - normalized ** 2));
      return station(`ellipsoid-${index}`, x, 2 * semiWidth * scale, 2 * semiHeight * scale);
    });
    const properties = calculateFuselageProperties({ modelVersion: 1, stations }, 2, 32);
    expect(properties.enclosedVolumeM3).toBeCloseTo(4 * Math.PI * semiLength * semiWidth * semiHeight / 3, 1);
    expect(properties.volumeCentroidM[0]).toBeCloseTo(semiLength, 8);
  });

  it('smoothly interpolates offsets and supports insert, duplicate, and delete', () => {
    const geometry: FuselageGeometry = { modelVersion: 1, stations: [station('nose', 0, 0), { ...station('cabin', 2, 2, 1), lateralCenterM: 0.2, verticalCenterM: 0.4 }, station('tail', 4, 0)] };
    const sample = sampleFuselageAtX(geometry, 1);
    expect(sample.widthM).toBe(1); expect(sample.heightM).toBe(0.5); expect(sample.lateralCenterM).toBe(0.1); expect(sample.verticalCenterM).toBe(0.2);
    const inserted = insertFuselageStationAfter(geometry, 'nose');
    expect(inserted.errors).toEqual([]); expect(inserted.fuselage?.stations).toHaveLength(4); expect(inserted.fuselage?.stations[1].xPositionM).toBe(1);
    const duplicated = duplicateFuselageStation(geometry, 'cabin');
    expect(duplicated.errors).toEqual([]); expect(duplicated.fuselage?.stations[2].widthM).toBe(2);
    const removed = removeFuselageStation(inserted.fuselage!, inserted.selectedStationId!);
    expect(removed.fuselage).toEqual(geometry);
  });

  it('rejects unordered, negative, partially collapsed, and invalid circular stations', () => {
    const valid = cylinder();
    expect(validateFuselageGeometry({ ...valid, stations: [valid.stations[1], valid.stations[0]] }).errors.join(' ')).toMatch(/nose datum|ordered/);
    expect(validateFuselageGeometry({ ...valid, stations: [valid.stations[0], { ...valid.stations[1], widthM: -1 }] }).valid).toBe(false);
    expect(validateFuselageGeometry({ ...valid, stations: [valid.stations[0], { ...valid.stations[1], widthM: 0 }] }).errors.join(' ')).toMatch(/collapse/);
    expect(validateFuselageGeometry({ ...valid, stations: [valid.stations[0], { ...valid.stations[1], heightM: 1.5 }] }).errors.join(' ')).toMatch(/circular/);
  });

  it('creates finite watertight closed-tip geometry and preserves legacy dimensions', () => {
    const migrated = migrateLegacyFuselage({ lengthM: 9, maxDiameterM: 1.4, noseLengthM: 1.45, cabinLengthM: 3.3 });
    const mesh = buildFuselageMeshData(migrated, 3, 24);
    expect(mesh.vertices.flat().every(Number.isFinite)).toBe(true);
    expect(mesh.indices.every((index) => Number.isInteger(index) && index >= 0 && index < mesh.vertices.length)).toBe(true);
    expect([...meshEdges(mesh).values()].every((edge) => edge.count === 2 && edge.direction === 0)).toBe(true);
    const properties = calculateFuselageProperties(migrated);
    expect(properties.totalLengthM).toBe(9); expect(properties.maximumWidthM).toBe(1.4); expect(properties.maximumHeightM).toBe(1.4);
  });
});
