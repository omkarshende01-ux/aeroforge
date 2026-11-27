import * as THREE from 'three';
import type { AircraftDesign } from '../domain/types';
import { naca4SurfaceCoordinates } from './airfoil';
import { buildWingLoftRings } from './wingLoft';

type HorizontalSurface = {
  spanM: number; rootChordM: number; taperRatio: number; sweepDeg: number;
  dihedralDeg: number; twistDeg: number; incidenceDeg: number; airfoil: string;
  rootLeadingEdgeXM: number; verticalPositionM: number;
};

function horizontalSurfaceGeometry(surface: HorizontalSurface): THREE.BufferGeometry {
  const section = naca4SurfaceCoordinates(surface.airfoil, 36); const halfSpan = surface.spanM / 2;
  const vertices: number[] = []; const indices: number[] = []; const ringSize = section.length;
  for (const side of [-1, 1]) {
    const sideOffset = vertices.length / 3;
    for (const spanFraction of [0, 1]) {
      const yAbs = spanFraction * halfSpan; const chord = surface.rootChordM * (1 - spanFraction * (1 - surface.taperRatio));
      const leadingEdgeX = surface.rootLeadingEdgeXM + yAbs * Math.tan(THREE.MathUtils.degToRad(surface.sweepDeg));
      const sectionAngle = THREE.MathUtils.degToRad(surface.incidenceDeg + surface.twistDeg * spanFraction);
      const centerZ = surface.verticalPositionM + yAbs * Math.tan(THREE.MathUtils.degToRad(surface.dihedralDeg));
      for (const [xNormalized, zNormalized] of section) {
        const dx = (xNormalized - 0.25) * chord; const dz = zNormalized * chord;
        const x = leadingEdgeX + 0.25 * chord + dx * Math.cos(sectionAngle) + dz * Math.sin(sectionAngle);
        const z = centerZ - dx * Math.sin(sectionAngle) + dz * Math.cos(sectionAngle);
        vertices.push(x, side * yAbs, z);
      }
    }
    for (let index = 0; index < ringSize; index += 1) {
      const next = (index + 1) % ringSize; const root = sideOffset + index; const rootNext = sideOffset + next; const tip = sideOffset + ringSize + index; const tipNext = sideOffset + ringSize + next;
      if (side > 0) indices.push(root, tip, rootNext, rootNext, tip, tipNext);
      else indices.push(root, rootNext, tip, rootNext, tipNext, tip);
    }
    const tipCenter = vertices.length / 3; const tipChord = surface.rootChordM * surface.taperRatio; const tipX = surface.rootLeadingEdgeXM + halfSpan * Math.tan(THREE.MathUtils.degToRad(surface.sweepDeg)) + 0.4 * tipChord; const tipZ = surface.verticalPositionM + halfSpan * Math.tan(THREE.MathUtils.degToRad(surface.dihedralDeg));
    vertices.push(tipX, side * halfSpan, tipZ);
    for (let index = 0; index < ringSize; index += 1) { const next = (index + 1) % ringSize; const a = sideOffset + ringSize + index; const b = sideOffset + ringSize + next; if (side > 0) indices.push(tipCenter, b, a); else indices.push(tipCenter, a, b); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); return geometry;
}

export function wingMesh(design: AircraftDesign): THREE.BufferGeometry {
  const rings = buildWingLoftRings(design.wing);
  const vertices: number[] = []; const indices: number[] = [];
  const ringSize = rings[0].points.length;
  rings.forEach((ring) => ring.points.forEach((point) => vertices.push(...point)));
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) for (let index = 0; index < ringSize; index += 1) {
    const next = (index + 1) % ringSize; const a = ringIndex * ringSize + index; const b = ringIndex * ringSize + next; const c = (ringIndex + 1) * ringSize + index; const d = (ringIndex + 1) * ringSize + next;
    indices.push(a, c, b, b, c, d);
  }
  for (const ringIndex of [0, rings.length - 1]) {
    const ring = rings[ringIndex]; const center = vertices.length / 3;
    const centerPoint = ring.points.reduce<[number, number, number]>((sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]], [0, 0, 0]).map((value) => value / ringSize);
    vertices.push(centerPoint[0], centerPoint[1], centerPoint[2]);
    for (let index = 0; index < ringSize; index += 1) {
      const next = (index + 1) % ringSize; const a = ringIndex * ringSize + index; const b = ringIndex * ringSize + next;
      if (ringIndex === 0) indices.push(center, a, b); else indices.push(center, b, a);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); return geometry;
}

export function horizontalTailMesh(design: AircraftDesign): THREE.BufferGeometry {
  return horizontalSurfaceGeometry({ ...design.horizontalTail, dihedralDeg: 0, twistDeg: 0, airfoil: 'NACA 0012' });
}

export function fuselageGeometry(design: AircraftDesign): THREE.BufferGeometry {
  const { lengthM, maxDiameterM, noseLengthM, cabinLengthM } = design.fuselage; const radius = maxDiameterM / 2;
  const axialSegments = 40; const radialSegments = 28; const vertices: number[] = []; const indices: number[] = [];
  const cabinEnd = Math.min(lengthM - 0.2, noseLengthM + cabinLengthM);
  for (let axial = 0; axial <= axialSegments; axial += 1) {
    const x = lengthM * axial / axialSegments; let localRadius: number;
    if (x < noseLengthM) localRadius = radius * Math.sin(0.5 * Math.PI * x / Math.max(noseLengthM, 0.01));
    else if (x <= cabinEnd) { const cabinFraction = (x - noseLengthM) / Math.max(cabinLengthM, 0.01); localRadius = radius * (1 - 0.05 * cabinFraction); }
    else { const tailFraction = (x - cabinEnd) / Math.max(lengthM - cabinEnd, 0.01); localRadius = radius * 0.95 * (1 - tailFraction) ** 1.35; }
    localRadius = Math.max(localRadius, 0.018);
    for (let radial = 0; radial < radialSegments; radial += 1) { const angle = 2 * Math.PI * radial / radialSegments; vertices.push(x, localRadius * Math.cos(angle), localRadius * Math.sin(angle)); }
  }
  for (let axial = 0; axial < axialSegments; axial += 1) for (let radial = 0; radial < radialSegments; radial += 1) { const next = (radial + 1) % radialSegments; const a = axial * radialSegments + radial; const b = (axial + 1) * radialSegments + radial; const c = axial * radialSegments + next; const d = (axial + 1) * radialSegments + next; indices.push(a, c, b, c, d, b); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); return geometry;
}

export function verticalTailMesh(design: AircraftDesign): THREE.BufferGeometry {
  const tail = design.verticalTail; const section = naca4SurfaceCoordinates('NACA 0012', 30); const vertices: number[] = []; const indices: number[] = []; const ringSize = section.length;
  for (const heightFraction of [0, 1]) { const chord = tail.rootChordM * (1 - heightFraction * (1 - tail.taperRatio)); const leadingEdgeX = tail.rootLeadingEdgeXM + heightFraction * tail.heightM * Math.tan(THREE.MathUtils.degToRad(tail.sweepDeg)); for (const [xNormalized, thicknessNormalized] of section) vertices.push(leadingEdgeX + xNormalized * chord, thicknessNormalized * chord, tail.basePositionM + heightFraction * tail.heightM); }
  for (let index = 0; index < ringSize; index += 1) { const next = (index + 1) % ringSize; const root = index; const rootNext = next; const tip = ringSize + index; const tipNext = ringSize + next; indices.push(root, rootNext, tip, rootNext, tipNext, tip); }
  const tipCenter = vertices.length / 3; vertices.push(tail.rootLeadingEdgeXM + tail.heightM * Math.tan(THREE.MathUtils.degToRad(tail.sweepDeg)) + 0.4 * tail.rootChordM * tail.taperRatio, 0, tail.basePositionM + tail.heightM);
  for (let index = 0; index < ringSize; index += 1) indices.push(tipCenter, ringSize + index, ringSize + (index + 1) % ringSize);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); return geometry;
}
