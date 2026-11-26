import { describe, expect, it } from 'vitest';
import { defaultDesign } from '../domain/types';
import { fuselageGeometry, horizontalTailMesh, verticalTailMesh, wingMesh } from './geometry';
import { legacyWingView } from './wingGeometry';

function expectFiniteNormals(geometry: ReturnType<typeof wingMesh>) {
  const positions = geometry.getAttribute('position'); const normals = geometry.getAttribute('normal');
  expect(normals.count).toBe(positions.count);
  expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
  expect(geometry.index?.count).toBeGreaterThan(0);
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
    expectFiniteNormals(geometry);
  });

  it('lofts the fuselage from the nose to the supplied total length', () => {
    const geometry = fuselageGeometry(defaultDesign); geometry.computeBoundingBox(); const box = geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(0, 5); expect(box.max.x).toBeCloseTo(defaultDesign.fuselage.lengthM, 5);
    expect(box.max.y - box.min.y).toBeCloseTo(defaultDesign.fuselage.maxDiameterM, 1);
    expectFiniteNormals(geometry);
  });

  it('places both stabilizers aft of the main wing with finite normals', () => {
    const horizontal = horizontalTailMesh(defaultDesign); const vertical = verticalTailMesh(defaultDesign); horizontal.computeBoundingBox(); vertical.computeBoundingBox();
    expect(horizontal.boundingBox!.min.x).toBeGreaterThan(legacyWingView(defaultDesign.wing).rootLeadingEdgeXM);
    expect(horizontal.boundingBox!.min.y).toBeCloseTo(-defaultDesign.horizontalTail.spanM / 2, 5);
    expect(vertical.boundingBox!.max.z).toBeCloseTo(defaultDesign.verticalTail.basePositionM + defaultDesign.verticalTail.heightM, 5);
    expectFiniteNormals(horizontal); expectFiniteNormals(vertical);
  });
});
