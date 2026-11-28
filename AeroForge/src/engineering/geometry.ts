import * as THREE from 'three';
import type { AircraftDesign } from '../domain/types';
import type { AirfoilLibrary } from '../domain/airfoilData';
import { buildWingLoftRings } from './wingLoft';
import { buildControlSurfaceGeometry } from './controlSurfaces';
import { buildFuselageMeshData } from './fuselageGeometry';
import { buildHorizontalTailLoftRings, buildVerticalTailLoftRings } from './tailGeometry';

export type ControlSurfaceRenderMesh = {
  controlSurfaceId: string;
  instanceKey: string;
  kind: 'aileron' | 'flap' | 'elevator' | 'rudder';
  hingeStart: readonly [number, number, number];
  hingeEnd: readonly [number, number, number];
  geometry: THREE.BufferGeometry;
};

function closedLoftGeometry(rings: readonly { points: readonly (readonly [number, number, number])[] }[], reverseWinding = false): THREE.BufferGeometry {
  const vertices: number[] = []; const indices: number[] = []; const ringSize = rings[0].points.length;
  rings.forEach((ring) => ring.points.forEach((point) => vertices.push(...point)));
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) for (let index = 0; index < ringSize; index += 1) {
    const next = (index + 1) % ringSize; const a = ringIndex * ringSize + index; const b = ringIndex * ringSize + next; const c = (ringIndex + 1) * ringSize + index; const d = (ringIndex + 1) * ringSize + next;
    if (reverseWinding) indices.push(a, b, c, b, d, c); else indices.push(a, c, b, b, c, d);
  }
  for (const ringIndex of [0, rings.length - 1]) {
    const ring = rings[ringIndex]; const center = vertices.length / 3; const centerPoint = ring.points.reduce<[number, number, number]>((sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]], [0, 0, 0]).map((value) => value / ringSize);
    vertices.push(...centerPoint);
    for (let index = 0; index < ringSize; index += 1) {
      const next = (index + 1) % ringSize; const a = ringIndex * ringSize + index; const b = ringIndex * ringSize + next;
      if (reverseWinding ? ringIndex === 0 : ringIndex !== 0) indices.push(center, b, a); else indices.push(center, a, b);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); return geometry;
}

export function wingMesh(design: AircraftDesign, airfoilLibrary?: AirfoilLibrary): THREE.BufferGeometry {
  const rings = buildWingLoftRings(design.wing, undefined, undefined, airfoilLibrary);
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

export function controlSurfaceMeshes(design: AircraftDesign, airfoilLibrary?: AirfoilLibrary): ControlSurfaceRenderMesh[] {
  return design.controlSurfaces.surfaces.filter((surface) => surface.enabled).flatMap((surface) => buildControlSurfaceGeometry(design, surface, airfoilLibrary).map((instance) => {
    const geometry = new THREE.BufferGeometry();
    const vertices = instance.deflectedVertices.flatMap((point) => [...point]);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(instance.indices); geometry.computeVertexNormals(); geometry.computeBoundingBox();
    return { controlSurfaceId: surface.id, instanceKey: instance.key, kind: surface.kind, hingeStart: instance.hingeStart, hingeEnd: instance.hingeEnd, geometry };
  }));
}

export function horizontalTailMesh(design: AircraftDesign, airfoilLibrary?: AirfoilLibrary): THREE.BufferGeometry {
  return closedLoftGeometry(buildHorizontalTailLoftRings(design.horizontalTail, airfoilLibrary));
}

export function fuselageGeometry(design: AircraftDesign): THREE.BufferGeometry {
  const mesh = buildFuselageMeshData(design.fuselage); const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices.flatMap((point) => [...point]), 3)); geometry.setIndex(mesh.indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); return geometry;
}

export function verticalTailMesh(design: AircraftDesign, airfoilLibrary?: AirfoilLibrary): THREE.BufferGeometry {
  return closedLoftGeometry(buildVerticalTailLoftRings(design.verticalTail, undefined, airfoilLibrary), true);
}
