import { describe, expect, it } from 'vitest';
import { defaultDesign } from '../domain/types';
import { fuselageGeometry, horizontalTailMesh, verticalTailMesh, wingMesh } from './geometry';
import { legacyWingView } from './wingGeometry';
import { calculateFuselageProperties, sampleFuselageAtX } from './fuselageGeometry';
import { calculateHorizontalTailReferenceProperties, calculateVerticalTailReferenceProperties } from './tailGeometry';

function expectFiniteNormals(geometry: ReturnType<typeof wingMesh>) {
  const positions = geometry.getAttribute('position'); const normals = geometry.getAttribute('normal');
  expect(normals.count).toBe(positions.count);
  expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
  expect(geometry.index?.count).toBeGreaterThan(0);
}

function expectWatertightIndexedMesh(geometry: ReturnType<typeof wingMesh>) {
  const index = geometry.index!; const edges = new Map<string, number>();
  for (let offset = 0; offset < index.count; offset += 3) {
    const triangle = [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)];
    [[triangle[0], triangle[1]], [triangle[1], triangle[2]], [triangle[2], triangle[0]]].forEach(([a, b]) => { const key = a < b ? `${a}:${b}` : `${b}:${a}`; edges.set(key, (edges.get(key) ?? 0) + 1); });
  }
  expect([...edges.values()].every((count) => count === 2)).toBe(true);
}

describe('parametric aircraft assembly', () => {
  it('builds a symmetric, closed-thickness wing at its shared design station', () => {
    const geometry = wingMesh(defaultDesign); geometry.computeBoundingBox(); const box = geometry.boundingBox!;
    const wing = legacyWingView(defaultDesign.wing);
    expect(box.min.y).toBeCloseTo(-wing.spanM / 2, 5);
    expect(box.max.y).toBeCloseTo(wing.spanM / 2, 5);
    expect(box.min.x).toBeGreaterThan(wing.rootLeadingEdgeXM - 0.05);
    expect(box.max.z).toBeGreaterThan(defaultDesign.wing.verticalPositionM);
    expect(box.min.z).toBeLessThan(defaultDesign.wing.verticalPositionM);
    expectFiniteNormals(geometry); expectWatertightIndexedMesh(geometry);
  });

  it('lofts the fuselage from the nose to the supplied total length', () => {
    const geometry = fuselageGeometry(defaultDesign); geometry.computeBoundingBox(); const box = geometry.boundingBox!;
    const properties = calculateFuselageProperties(defaultDesign.fuselage);
    expect(box.min.x).toBeCloseTo(0, 5); expect(box.max.x).toBeCloseTo(properties.totalLengthM, 5);
    expect(box.max.y - box.min.y).toBeCloseTo(properties.maximumWidthM, 1);
    expectFiniteNormals(geometry);
  });

  it('places both stabilizers aft of the main wing with finite normals', () => {
    const horizontal = horizontalTailMesh(defaultDesign); const vertical = verticalTailMesh(defaultDesign); horizontal.computeBoundingBox(); vertical.computeBoundingBox();
    const horizontalProperties = calculateHorizontalTailReferenceProperties(defaultDesign.horizontalTail); const verticalProperties = calculateVerticalTailReferenceProperties(defaultDesign.verticalTail);
    expect(horizontal.boundingBox!.min.x).toBeGreaterThan(legacyWingView(defaultDesign.wing).rootLeadingEdgeXM);
    expect(horizontal.boundingBox!.min.y).toBeCloseTo(defaultDesign.horizontalTail.lateralPositionM - horizontalProperties.spanM / 2, 5);
    expect(vertical.boundingBox!.max.z).toBeCloseTo(defaultDesign.verticalTail.baseVerticalPositionM + verticalProperties.spanM, 5);
    expectFiniteNormals(horizontal); expectFiniteNormals(vertical); expectWatertightIndexedMesh(horizontal); expectWatertightIndexedMesh(vertical);
  });

  it('uses the authoritative defaults to attach lifting surfaces continuously to the fuselage envelope', () => {
    const wingRoot = defaultDesign.wing.stations[0]; const wingAttachment = sampleFuselageAtX(defaultDesign.fuselage, wingRoot.leadingEdgeXM + 0.25 * wingRoot.chordM);
    expect(defaultDesign.wing.verticalPositionM).toBeGreaterThan(wingAttachment.verticalCenterM - wingAttachment.heightM / 2);
    expect(defaultDesign.wing.verticalPositionM).toBeLessThan(wingAttachment.verticalCenterM + wingAttachment.heightM / 2);

    const horizontalRoot = defaultDesign.horizontalTail.stations[0]; const horizontalAttachment = sampleFuselageAtX(defaultDesign.fuselage, horizontalRoot.leadingEdgeXM + 0.25 * horizontalRoot.chordM);
    expect(defaultDesign.horizontalTail.verticalPositionM).toBeGreaterThan(horizontalAttachment.verticalCenterM - horizontalAttachment.heightM / 2);
    expect(defaultDesign.horizontalTail.verticalPositionM).toBeLessThan(horizontalAttachment.verticalCenterM + horizontalAttachment.heightM / 2);

    const verticalRoot = defaultDesign.verticalTail.stations[0]; const verticalAttachment = sampleFuselageAtX(defaultDesign.fuselage, verticalRoot.leadingEdgeXM + 0.25 * verticalRoot.chordM);
    expect(Math.abs(defaultDesign.verticalTail.baseVerticalPositionM - (verticalAttachment.verticalCenterM + verticalAttachment.heightM / 2))).toBeLessThan(0.08);
    expect(defaultDesign.fuselage.stations.length).toBeGreaterThanOrEqual(10);
    expect(defaultDesign.horizontalTail.stations).toHaveLength(3); expect(defaultDesign.verticalTail.stations).toHaveLength(3);
  });
});
