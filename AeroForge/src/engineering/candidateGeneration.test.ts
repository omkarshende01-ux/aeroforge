import { describe, expect, it } from 'vitest';
import { defaultDesign, type AircraftDesign } from '../domain/types';
import { analyzeAircraftConstraints } from './constraints';
import { calculatePreliminarySizing, createDefaultSizingInputs } from './preliminarySizing';
import {
  generateProvisionalAircraftCandidate,
  isProvisionalCandidateStale,
  type CandidateGenerationInputs,
} from './candidateGeneration';
import { legacyWingView } from './wingGeometry';

function convergedSizing(design: AircraftDesign = defaultDesign) {
  const constraints = analyzeAircraftConstraints(design);
  const boundary = constraints.feasibleBoundary[Math.floor(constraints.feasibleBoundary.length / 2)];
  const point = { wingLoadingNm2: boundary.wingLoadingNm2, shaftPowerLoadingWPerN: boundary.shaftPowerLoadingWPerN + 1 };
  return calculatePreliminarySizing(design, createDefaultSizingInputs(design, point));
}

const candidateInputs: CandidateGenerationInputs = { aspectRatio: 9, taperRatio: 0.45, energyStorageKind: 'electric' };

describe('M4.6 provisional aircraft candidate generation', () => {
  it('derives a trapezoidal wing that reproduces the required area and selected aspect ratio', () => {
    const sizing = convergedSizing();
    const candidate = generateProvisionalAircraftCandidate(defaultDesign, sizing, candidateInputs);
    const area = candidate.geometry.spanM * (candidate.geometry.rootChordM + candidate.geometry.tipChordM) / 2;
    expect(area).toBeCloseTo(sizing.requiredWingAreaM2!, 12);
    expect(candidate.geometry.spanM ** 2 / area).toBeCloseTo(candidateInputs.aspectRatio, 12);
    expect(candidate.geometry.tipChordM / candidate.geometry.rootChordM).toBeCloseTo(candidateInputs.taperRatio, 12);
  });

  it('creates an isolated preview while preserving configuration not produced by sizing', () => {
    const original = structuredClone(defaultDesign);
    const sizing = convergedSizing();
    const candidate = generateProvisionalAircraftCandidate(defaultDesign, sizing, candidateInputs);
    expect(defaultDesign).toEqual(original);
    expect(candidate.previewDesign).not.toBe(defaultDesign);
    expect(candidate.previewDesign.fuselage).not.toBe(defaultDesign.fuselage);
    expect(candidate.previewDesign.fuselage).toEqual(defaultDesign.fuselage);
    expect(candidate.previewDesign.horizontalTail).toEqual(defaultDesign.horizontalTail);
    expect(legacyWingView(candidate.previewDesign.wing).sweepDeg).toBeCloseTo(legacyWingView(defaultDesign.wing).sweepDeg);
    expect(candidate.previewDesign.massKg).toBe(sizing.finalTakeoffMassKg);
    expect(candidate.previewDesign.propulsion.shaftPowerW).toBe(sizing.requiredInstalledShaftPowerW);
    expect(candidate.energyStorage.massKg).toBe(sizing.energyStorageMassKg);
  });

  it('preserves wing-control coverage as a span fraction in candidate previews', () => {
    const source = structuredClone(defaultDesign);
    source.controlSurfaces.surfaces.push({
      id: 'aileron-candidate', name: 'Candidate aileron', kind: 'aileron', parentSurface: 'wing', enabled: true,
      spanStartM: 3.6, spanEndM: 5.4, chordFraction: 0.25, hingeChordFraction: 0.75,
      minimumDeflectionDeg: -25, maximumDeflectionDeg: 25, currentDeflectionDeg: 8,
      operation: 'differential', side: 'both',
    });
    const candidate = generateProvisionalAircraftCandidate(source, convergedSizing(source), candidateInputs);
    const preview = candidate.previewDesign.controlSurfaces.surfaces[0];
    const previewHalfSpan = candidate.geometry.spanM / 2;
    expect(preview.spanStartM / previewHalfSpan).toBeCloseTo(0.6, 12);
    expect(preview.spanEndM / previewHalfSpan).toBeCloseTo(0.9, 12);
    expect(preview.currentDeflectionDeg).toBe(8);
  });

  it('preserves indeterminate feasibility and every evaluated or unevaluated constraint status', () => {
    const sizing = convergedSizing();
    const candidate = generateProvisionalAircraftCandidate(defaultDesign, sizing, candidateInputs);
    expect(candidate.missionStatus).toBe('indeterminate');
    expect(candidate.constraintStatuses).toEqual(sizing.designPointEvaluation?.constraints);
    expect(candidate.constraintStatuses.find((item) => item.id === 'takeoff-distance')?.status).toBe('not-evaluated');
  });

  it('detects changes to mission/design revision, sizing results, and candidate inputs', () => {
    const sizing = convergedSizing();
    const candidate = generateProvisionalAircraftCandidate(defaultDesign, sizing, candidateInputs);
    expect(isProvisionalCandidateStale(candidate, defaultDesign, sizing, candidateInputs)).toBe(false);
    const changedDesign = { ...defaultDesign, revision: 1, mission: { ...defaultDesign.mission, requiredRangeM: defaultDesign.mission.requiredRangeM * 1.1 } };
    expect(isProvisionalCandidateStale(candidate, changedDesign, sizing, candidateInputs)).toBe(true);
    expect(isProvisionalCandidateStale(candidate, defaultDesign, { ...sizing, requiredWingAreaM2: sizing.requiredWingAreaM2! * 1.01 }, candidateInputs)).toBe(true);
    expect(isProvisionalCandidateStale(candidate, defaultDesign, sizing, { ...candidateInputs, taperRatio: 0.5 })).toBe(true);
  });

  it('blocks non-converged, mismatched, incomplete, and invalid candidate inputs', () => {
    const sizing = convergedSizing();
    expect(() => generateProvisionalAircraftCandidate(defaultDesign, { ...sizing, status: 'non-converged' }, candidateInputs)).toThrow(/converged/);
    expect(() => generateProvisionalAircraftCandidate(defaultDesign, { ...sizing, contract: { ...sizing.contract, designRevision: 2 } }, candidateInputs)).toThrow(/revision/);
    expect(() => generateProvisionalAircraftCandidate(defaultDesign, { ...sizing, requiredWingAreaM2: undefined }, candidateInputs)).toThrow(/missing/);
    expect(() => generateProvisionalAircraftCandidate(defaultDesign, sizing, { ...candidateInputs, aspectRatio: 2.9 })).toThrow(/Aspect ratio/);
    expect(() => generateProvisionalAircraftCandidate(defaultDesign, sizing, { ...candidateInputs, taperRatio: 0 })).toThrow(/Taper ratio/);
  });
});
