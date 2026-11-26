import { describe, expect, it } from 'vitest';
import { defaultDesign } from '../domain/types';
import { evaluateMissionFeasibility, validateMissionRequirements } from './mission';

describe('Phase 4A mission requirements and feasibility', () => {
  it('accepts the default mission and rejects out-of-bounds or inconsistent inputs', () => {
    expect(validateMissionRequirements(defaultDesign.mission).valid).toBe(true);
    const invalid = {
      ...defaultDesign.mission,
      cruiseAltitudeM: 12_000,
      maximumStallSpeedMs: 90,
      maxOperatingSpeedMs: 80,
    };
    const result = validateMissionRequirements(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.cruiseAltitudeM).toBeDefined();
    expect(result.errors.maxOperatingSpeedMs).toContain('exceed');
  });

  it('evaluates supported constraints and keeps unsupported requirements explicit', () => {
    const result = evaluateMissionFeasibility(defaultDesign);
    const byId = Object.fromEntries(result.evaluations.map((evaluation) => [evaluation.id, evaluation]));
    expect(byId.payload.status).toBe('pass');
    expect(byId['stall-speed'].status).toBe('pass');
    expect(byId['takeoff-distance'].status).toBe('not-evaluated');
    expect(byId['takeoff-distance'].limitation).toContain('No takeoff');
    expect(byId['design-objective'].status).toBe('not-evaluated');
    expect(result.passCount + result.failCount + result.notEvaluatedCount).toBe(result.evaluations.length);
  });

  it('reports numerical failure margins without changing the underlying models', () => {
    const design = {
      ...defaultDesign,
      mission: {
        ...defaultDesign.mission,
        payloadKg: 500,
        maximumStallSpeedMs: 10,
        minimumClimbRateMs: 50,
      },
    };
    const result = evaluateMissionFeasibility(design);
    const byId = Object.fromEntries(result.evaluations.map((evaluation) => [evaluation.id, evaluation]));
    expect(byId.payload.status).toBe('fail');
    expect(byId.payload.margin).toBeCloseTo(-330);
    expect(byId['stall-speed'].status).toBe('fail');
    expect(byId['stall-speed'].margin).toBeLessThan(0);
    expect(byId['climb-rate'].status).toBe('fail');
    expect(byId['climb-rate'].margin).toBeLessThan(0);
  });

  it('does not evaluate constraints when mission inputs are invalid', () => {
    const design = { ...defaultDesign, mission: { ...defaultDesign.mission, requiredRangeM: 0 } };
    const result = evaluateMissionFeasibility(design);
    expect(result.validation.valid).toBe(false);
    expect(result.evaluations.every((evaluation) => evaluation.status === 'not-evaluated')).toBe(true);
  });

  it('does not score performance constraints outside the attached-flow model range', () => {
    const design = { ...defaultDesign, mission: { ...defaultDesign.mission, cruiseSpeedMs: 5 } };
    const result = evaluateMissionFeasibility(design);
    const byId = Object.fromEntries(result.evaluations.map((evaluation) => [evaluation.id, evaluation]));
    expect(byId['cruise-speed'].status).toBe('not-evaluated');
    expect(byId['cruise-altitude'].status).toBe('not-evaluated');
    expect(byId.range.status).toBe('not-evaluated');
    expect(byId['climb-rate'].status).toBe('not-evaluated');
  });
});
