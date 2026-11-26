import type { AircraftDesign, DesignMetrics } from '../domain/types';
import { standardAtmosphere } from './atmosphere';

const g = 9.80665;
const msToKt = 1.943844492;

export function calculateMetrics(design: AircraftDesign): DesignMetrics {
  const { spanM: b, rootChordM: cr, taperRatio: lambda } = design.wing;
  const ct = cr * lambda;
  const area = b * (cr + ct) / 2;
  const ar = area > 0 ? b * b / area : 0;
  const mac = (2 / 3) * cr * (1 + lambda + lambda * lambda) / (1 + lambda);
  const wingLoading = area > 0 ? design.massKg * g / area : 0;
  const warnings: string[] = [];
  let rho = design.flightCondition.densityKgM3;
  if (design.flightCondition.densitySource === 'isa') {
    try { rho = standardAtmosphere(design.flightCondition.altitudeM).densityKgM3; }
    catch { rho = 0; }
  }
  const { clMax } = design.flightCondition;
  const valid = design.massKg > 0 && area > 0 && rho > 0 && clMax > 0;
  if (design.massKg <= 0) warnings.push('Mass must be positive.');
  if (area <= 0) warnings.push('Wing area requires positive span and chord.');
  if (rho <= 0) warnings.push('Density must be positive for a stall estimate.');
  if (clMax <= 0) warnings.push('CLmax must be positive for a stall estimate.');
  const stall = valid ? Math.sqrt((2 * design.massKg * g) / (rho * area * clMax)) : undefined;
  return { wingAreaM2: area, aspectRatio: ar, macM: mac, tipChordM: ct, wingLoadingNm2: wingLoading, stallSpeedMs: stall, stallSpeedKt: stall === undefined ? undefined : stall * msToKt, warnings };
}
