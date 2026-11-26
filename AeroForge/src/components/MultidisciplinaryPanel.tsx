import { useDesignStore } from '../state/useDesignStore';
import { calculateMassProperties } from '../engineering/massProperties';
import { calculatePerformance } from '../engineering/performance';
import { calculateStability } from '../engineering/stability';
import { calculateWingBeam } from '../engineering/structures';

const number = (value: number | undefined, digits = 2) => value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);

export function MultidisciplinaryPanel() {
  const design = useDesignStore((state) => state.design); const mass = calculateMassProperties(design); const performance = calculatePerformance(design); const stability = calculateStability(design); const structure = calculateWingBeam(design);
  const warnings = [...mass.warnings, ...performance.warnings, ...stability.warnings, ...structure.warnings].filter((warning, index, all) => all.indexOf(warning) === index);
  return <div className="analysis multidisciplinary-analysis"><div className="analysis-head"><span>ANALYSIS / PRELIMINARY SIZING</span><span className="model-tag">MISSION · MASS · PERFORMANCE · STABILITY · BEAM</span></div><div className="discipline-grid">
    <section><h4>MASS & CG</h4><div><small>ACCOUNTED MASS</small><strong>{number(mass.accountedMassKg, 0)} kg</strong></div><div><small>CG STATION</small><strong>{number(mass.centerOfGravityXM)} m</strong></div><div><small>MASS DIFFERENCE</small><strong>{number(mass.massDifferenceKg, 0)} kg</strong></div></section>
    <section><h4>PERFORMANCE</h4><div><small>LEVEL-FLIGHT CL</small><strong>{number(performance.requiredLiftCoefficient, 3)}</strong></div><div><small>SHAFT POWER REQUIRED</small><strong>{number(performance.shaftPowerRequiredW / 1000, 1)} kW</strong></div><div><small>RATE OF CLIMB</small><strong>{number(performance.rateOfClimbMs)} m/s</strong></div><div><small>ENDURANCE / RANGE</small><strong>{number(performance.enduranceS / 3600, 2)} h / {number(performance.stillAirRangeM / 1000, 0)} km</strong></div></section>
    <section><h4>STATIC STABILITY</h4><div><small>TAIL VOLUME</small><strong>{number(stability.horizontalTailVolume, 3)}</strong></div><div><small>NEUTRAL POINT</small><strong>{number(stability.neutralPointXM)} m</strong></div><div><small>STATIC MARGIN</small><strong>{number(stability.staticMargin === undefined ? undefined : stability.staticMargin * 100, 1)} % MAC</strong></div></section>
    <section><h4>WING BEAM</h4><div><small>ROOT SHEAR</small><strong>{number(structure.rootShearN / 1000, 1)} kN</strong></div><div><small>ROOT MOMENT</small><strong>{number(structure.rootMomentNm / 1000, 1)} kN·m</strong></div><div><small>ROOT STRESS</small><strong>{number(structure.rootStressPa / 1e6, 1)} MPa</strong></div><div><small>TIP DEFLECTION / SF</small><strong>{number(structure.tipDeflectionM, 3)} m / {number(structure.safetyFactor, 2)}</strong></div></section>
  </div>{warnings.length > 0 && <div className="warning">⚠ {warnings.join(' ')}</div>}<div className="analysis-note">Conceptual estimates using supplied component stations, propulsion energy, stability derivatives and constant-EI beam properties. Range is still-air and reserves are applied to shaft energy.</div></div>;
}
