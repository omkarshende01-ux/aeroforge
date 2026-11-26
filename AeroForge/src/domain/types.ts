import { AIRCRAFT_DESIGN_SCHEMA_VERSION } from './contracts';

export type AircraftCategory = 'light-aircraft' | 'uncrewed-aircraft' | 'glider' | 'transport';
export type DesignObjective = 'balanced' | 'minimum-mass' | 'maximum-range' | 'minimum-energy';

export type MissionRequirements = {
  aircraftCategory: AircraftCategory;
  payloadKg: number;
  requiredRangeM: number;
  cruiseSpeedMs: number;
  cruiseAltitudeM: number;
  serviceCeilingM: number;
  maximumStallSpeedMs: number;
  maximumTakeoffDistanceM: number;
  minimumClimbRateMs: number;
  maxOperatingSpeedMs: number;
  designObjective: DesignObjective;
};

export type AircraftDesign = {
  schemaVersion: typeof AIRCRAFT_DESIGN_SCHEMA_VERSION;
  revision: number;
  name: string;
  massKg: number;
  wing: { spanM: number; rootChordM: number; taperRatio: number; sweepDeg: number; dihedralDeg: number; twistDeg: number; airfoil: string; rootLeadingEdgeXM: number; verticalPositionM: number };
  fuselage: { lengthM: number; maxDiameterM: number; noseLengthM: number; cabinLengthM: number };
  horizontalTail: { spanM: number; rootChordM: number; taperRatio: number; sweepDeg: number; incidenceDeg: number; rootLeadingEdgeXM: number; verticalPositionM: number };
  verticalTail: { heightM: number; rootChordM: number; taperRatio: number; sweepDeg: number; rootLeadingEdgeXM: number; basePositionM: number };
  flightCondition: {
    altitudeM: number;
    densitySource: 'isa' | 'manual';
    densityKgM3: number;
    speedMs: number;
    angleOfAttackDeg: number;
    clMax: number;
    clMin: number;
    zeroLiftAngleDeg: number;
    sectionLiftSlopePerRad: number;
    cd0: number;
    oswaldEfficiency: number;
  };
  mission: MissionRequirements;
  massModel: {
    airframeMassKg: number; airframeXM: number;
    propulsionMassKg: number; propulsionXM: number;
    energyMassKg: number; energyXM: number;
    payloadMassKg: number; payloadXM: number;
  };
  propulsion: { shaftPowerW: number; propulsiveEfficiency: number; usableShaftEnergyJ: number; reserveFraction: number };
  stability: { tailLiftSlopePerRad: number; tailEfficiency: number; downwashGradient: number };
  structure: { loadFactor: number; negativeLoadFactor: number; elasticModulusPa: number; secondMomentM4: number; outerFiberM: number; allowableStressPa: number };
};

export type DesignMetrics = { wingAreaM2: number; aspectRatio: number; macM: number; tipChordM: number; wingLoadingNm2: number; stallSpeedMs?: number; stallSpeedKt?: number; warnings: string[] };

export const defaultDesign: AircraftDesign = {
  schemaVersion: AIRCRAFT_DESIGN_SCHEMA_VERSION,
  revision: 0,
  name: 'AeroForge demonstrator', massKg: 1200,
  wing: { spanM: 12, rootChordM: 2, taperRatio: 0.5, sweepDeg: 3, dihedralDeg: 3, twistDeg: -1.5, airfoil: 'NACA 2412', rootLeadingEdgeXM: 2.35, verticalPositionM: 0.48 },
  fuselage: { lengthM: 9, maxDiameterM: 1.4, noseLengthM: 1.45, cabinLengthM: 3.3 },
  horizontalTail: { spanM: 4.2, rootChordM: 1.15, taperRatio: 0.55, sweepDeg: 8, incidenceDeg: 0, rootLeadingEdgeXM: 7.15, verticalPositionM: 0.3 },
  verticalTail: { heightM: 1.9, rootChordM: 1.7, taperRatio: 0.4, sweepDeg: 24, rootLeadingEdgeXM: 6.85, basePositionM: 0.12 },
  flightCondition: {
    altitudeM: 0,
    densitySource: 'isa',
    densityKgM3: 1.225,
    speedMs: 50,
    angleOfAttackDeg: 4,
    clMax: 1.5,
    clMin: -0.8,
    zeroLiftAngleDeg: -2,
    sectionLiftSlopePerRad: 2 * Math.PI,
    cd0: 0.025,
    oswaldEfficiency: 0.8,
  },
  mission: {
    aircraftCategory: 'light-aircraft',
    payloadKg: 170,
    requiredRangeM: 1_000_000,
    cruiseSpeedMs: 50,
    cruiseAltitudeM: 0,
    serviceCeilingM: 3_000,
    maximumStallSpeedMs: 35,
    maximumTakeoffDistanceM: 500,
    minimumClimbRateMs: 2,
    maxOperatingSpeedMs: 80,
    designObjective: 'balanced',
  },
  massModel: {
    airframeMassKg: 600, airframeXM: 3.7,
    propulsionMassKg: 180, propulsionXM: 0.9,
    energyMassKg: 250, energyXM: 3.1,
    payloadMassKg: 170, payloadXM: 2.8,
  },
  propulsion: { shaftPowerW: 180_000, propulsiveEfficiency: 0.82, usableShaftEnergyJ: 1.8e9, reserveFraction: 0.2 },
  stability: { tailLiftSlopePerRad: 4.2, tailEfficiency: 0.9, downwashGradient: 0.35 },
  structure: { loadFactor: 3.8, negativeLoadFactor: -1.52, elasticModulusPa: 70e9, secondMomentM4: 0.0008, outerFiberM: 0.12, allowableStressPa: 250e6 },
};
