import type { AircraftDesign } from '../domain/types';
import type { ConstraintMargin } from './constraints';
import type { PreliminarySizingResult, SizingPropulsionModel } from './preliminarySizing';

export const PROVISIONAL_CANDIDATE_MODEL_VERSION = '1.0.0';

export type CandidateGenerationInputs = {
  aspectRatio: number;
  taperRatio: number;
  energyStorageKind: SizingPropulsionModel['kind'];
};

export type ProvisionalAircraftCandidate = {
  modelVersion: typeof PROVISIONAL_CANDIDATE_MODEL_VERSION;
  sourceDesignRevision: number;
  sourceSizingModelVersion: string;
  sourceFingerprint: string;
  previewDesign: AircraftDesign;
  geometry: {
    wingAreaM2: number;
    aspectRatio: number;
    spanM: number;
    rootChordM: number;
    tipChordM: number;
    taperRatio: number;
  };
  takeoffMassKg: number;
  installedShaftPowerW: number;
  energyStorage: { kind: SizingPropulsionModel['kind']; massKg: number };
  missionStatus: PreliminarySizingResult['missionStatus'];
  constraintStatuses: ConstraintMargin[];
  assumptions: string[];
  provenance: string[];
  limitations: string[];
};

function finitePositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function fingerprintPayload(design: AircraftDesign, sizing: PreliminarySizingResult, inputs: CandidateGenerationInputs) {
  return {
    designSchemaVersion: design.schemaVersion,
    designRevision: design.revision,
    mission: design.mission,
    sizingModelVersion: sizing.contract.modelVersion,
    sizingDesignRevision: sizing.contract.designRevision,
    sizingStatus: sizing.status,
    missionStatus: sizing.missionStatus,
    finalTakeoffMassKg: sizing.finalTakeoffMassKg,
    requiredWingAreaM2: sizing.requiredWingAreaM2,
    requiredInstalledShaftPowerW: sizing.requiredInstalledShaftPowerW,
    energyStorageMassKg: sizing.energyStorageMassKg,
    designPoint: sizing.designPointEvaluation?.point,
    aspectRatio: inputs.aspectRatio,
    taperRatio: inputs.taperRatio,
    energyStorageKind: inputs.energyStorageKind,
  };
}

/** Snapshot identity used to prevent a candidate from outliving its sizing result or inputs. */
export function candidateSourceFingerprint(design: AircraftDesign, sizing: PreliminarySizingResult, inputs: CandidateGenerationInputs): string {
  return JSON.stringify(fingerprintPayload(design, sizing, inputs));
}

/**
 * Converts a converged M4.4 sizing result to an isolated geometry preview.
 * Only wing planform, takeoff mass, installed shaft power, payload, and storage mass are replaced.
 */
export function generateProvisionalAircraftCandidate(
  design: AircraftDesign,
  sizing: PreliminarySizingResult,
  inputs: CandidateGenerationInputs,
): ProvisionalAircraftCandidate {
  if (sizing.status !== 'converged') throw new RangeError('Candidate generation requires a converged sizing result.');
  if (sizing.contract.designRevision !== design.revision) throw new RangeError('The sizing result does not match the current design revision.');
  if (!finitePositive(inputs.aspectRatio) || inputs.aspectRatio < 3 || inputs.aspectRatio > 20) throw new RangeError('Aspect ratio must be finite and within the provisional 3 to 20 range.');
  if (!finitePositive(inputs.taperRatio) || inputs.taperRatio > 1) throw new RangeError('Taper ratio must be finite and in the interval (0, 1].');
  if (!finitePositive(sizing.finalTakeoffMassKg) || !finitePositive(sizing.requiredWingAreaM2) ||
      !finitePositive(sizing.requiredInstalledShaftPowerW) || !finitePositive(sizing.energyStorageMassKg)) {
    throw new RangeError('The converged sizing result is missing positive finite candidate values.');
  }

  const spanM = Math.sqrt(inputs.aspectRatio * sizing.requiredWingAreaM2);
  const rootChordM = 2 * sizing.requiredWingAreaM2 / (spanM * (1 + inputs.taperRatio));
  const tipChordM = inputs.taperRatio * rootChordM;
  const previewDesign: AircraftDesign = {
    ...design,
    wing: { ...design.wing, spanM, rootChordM, taperRatio: inputs.taperRatio },
    fuselage: { ...design.fuselage },
    horizontalTail: { ...design.horizontalTail },
    verticalTail: { ...design.verticalTail },
    flightCondition: { ...design.flightCondition },
    mission: { ...design.mission },
    massKg: sizing.finalTakeoffMassKg,
    massModel: { ...design.massModel, payloadMassKg: sizing.payloadMassKg ?? design.mission.payloadKg, energyMassKg: sizing.energyStorageMassKg },
    propulsion: { ...design.propulsion, shaftPowerW: sizing.requiredInstalledShaftPowerW },
    stability: { ...design.stability },
    structure: { ...design.structure },
  };

  return {
    modelVersion: PROVISIONAL_CANDIDATE_MODEL_VERSION,
    sourceDesignRevision: design.revision,
    sourceSizingModelVersion: sizing.contract.modelVersion,
    sourceFingerprint: candidateSourceFingerprint(design, sizing, inputs),
    previewDesign,
    geometry: { wingAreaM2: sizing.requiredWingAreaM2, aspectRatio: inputs.aspectRatio, spanM, rootChordM, tipChordM, taperRatio: inputs.taperRatio },
    takeoffMassKg: sizing.finalTakeoffMassKg,
    installedShaftPowerW: sizing.requiredInstalledShaftPowerW,
    energyStorage: { kind: inputs.energyStorageKind, massKg: sizing.energyStorageMassKg },
    missionStatus: sizing.missionStatus,
    constraintStatuses: sizing.designPointEvaluation?.constraints.map((constraint) => ({ ...constraint })) ?? [],
    assumptions: [
      ...sizing.contract.assumptions,
      'The wing is a straight-edged trapezoid sized from area, aspect ratio, and taper ratio.',
      'Existing sweep, dihedral, twist, airfoil, wing station, fuselage, empennage, structure, and propulsion configuration are preserved.',
    ],
    provenance: [
      `M4.4 sizing model ${sizing.contract.modelVersion}, design revision ${sizing.contract.designRevision}.`,
      'Wing relations: b = sqrt(AR S), c_root = 2S/[b(1 + taper)], c_tip = taper c_root.',
      ...sizing.contract.sources.map((source) => `${source.title}: ${source.reference}`),
    ],
    limitations: [
      ...sizing.contract.warnings,
      'This is an isolated provisional preview, not an authoritative aircraft design or a validated configuration.',
      'Fuselage, empennage, structural, landing-gear, and propulsion dimensions are not synthesized or checked for integration.',
      'Mass station locations and component masses not explicitly produced by sizing remain the current design values; fixed-equipment mass has no candidate component station.',
    ],
  };
}

export function isProvisionalCandidateStale(
  candidate: ProvisionalAircraftCandidate,
  design: AircraftDesign,
  sizing: PreliminarySizingResult,
  inputs: CandidateGenerationInputs,
): boolean {
  return candidate.sourceFingerprint !== candidateSourceFingerprint(design, sizing, inputs);
}
