import { useMemo, useState } from 'react';
import { analyzeAircraftConstraints, type ConstraintPoint } from '../engineering/constraints';
import { generateProvisionalAircraftCandidate, isProvisionalCandidateStale, type CandidateGenerationInputs, type ProvisionalAircraftCandidate } from '../engineering/candidateGeneration';
import { calculateMetrics } from '../engineering/metrics';
import { legacyWingView } from '../engineering/wingGeometry';
import {
  calculateSizingSensitivity,
  createDefaultSizingInputs,
  type PreliminarySizingInputs,
  type SizingPropulsionModel,
} from '../engineering/preliminarySizing';
import { convertFromSi, convertToSi, missionUnit, type MissionQuantity, type MissionUnitSystem } from '../engineering/units';
import { useDesignStore } from '../state/useDesignStore';
import { Viewport } from './Viewport';

function numeric(value: string): number { return value === '' ? Number.NaN : Number(value); }

function display(value: number | undefined, quantity: MissionQuantity, units: MissionUnitSystem, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${convertFromSi(value, quantity, units).toFixed(digits)} ${missionUnit(units, quantity).label}`;
}

function ConvergencePlot({ histories }: { histories: Array<{ label: string; values: number[] }> }) {
  const values = histories.flatMap((history) => history.values);
  if (values.length === 0) return <div className="sizing-empty">No iteration history available.</div>;
  const width = 640; const height = 190; const left = 48; const right = 16; const top = 14; const bottom = 30;
  const min = Math.min(...values); const max = Math.max(...values); const range = Math.max(max - min, 1);
  const maxCount = Math.max(...histories.map((history) => history.values.length), 2);
  const x = (index: number) => left + (width - left - right) * index / (maxCount - 1);
  const y = (value: number) => top + (height - top - bottom) * (max - value) / range;
  return <svg className="sizing-convergence" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Takeoff mass convergence by iteration">
    <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} />
    <line x1={left} y1={top} x2={left} y2={height - bottom} />
    <text x={left} y={height - 8}>ITERATION</text><text x="11" y={top + 8}>kg</text>
    <text x={left - 8} y={y(max) + 3} textAnchor="end">{max.toFixed(0)}</text>
    <text x={left - 8} y={y(min) + 3} textAnchor="end">{min.toFixed(0)}</text>
    {histories.map((history, historyIndex) => <path key={history.label} className={`history-${historyIndex}`} d={history.values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ')} />)}
  </svg>;
}

function SizingInput({ label, value, quantity, units, onChange, min, max, note }: { label: string; value: number; quantity?: MissionQuantity; units: MissionUnitSystem; onChange: (value: number) => void; min?: number; max?: number; note?: string }) {
  const definition = quantity ? missionUnit(units, quantity) : undefined;
  const shown = quantity ? convertFromSi(value, quantity, units) : value;
  return <label className="sizing-input"><span>{label}<small>{definition?.label ?? note}</small></span><input type="number" value={Number.isFinite(shown) ? shown : ''} step={definition?.step ?? 'any'} min={min} max={max} onChange={(event) => onChange(quantity ? convertToSi(numeric(event.target.value), quantity, units) : numeric(event.target.value))} /></label>;
}

export function PreliminarySizingWorkspace() {
  const design = useDesignStore((state) => state.design);
  const sharedPoint = useDesignStore((state) => state.selectedSizingPoint);
  const selectPoint = useDesignStore((state) => state.selectSizingPoint);
  const constraintResult = useMemo(() => analyzeAircraftConstraints(design), [design]);
  const fallbackPoint: ConstraintPoint = constraintResult.currentPoint ?? { wingLoadingNm2: 700, shaftPowerLoadingWPerN: 15 };
  const designPoint = sharedPoint ?? fallbackPoint;
  const [units, setUnits] = useState<MissionUnitSystem>('si');
  const [settings, setSettings] = useState<PreliminarySizingInputs>(() => createDefaultSizingInputs(design, designPoint));
  const [alternateInitialMassKg, setAlternateInitialMassKg] = useState(settings.initialTakeoffMassKg * 1.5);
  const wingView = legacyWingView(design.wing);
  const [candidateInputs, setCandidateInputs] = useState<CandidateGenerationInputs>(() => ({ aspectRatio: calculateMetrics(design).aspectRatio, taperRatio: wingView.taperRatio, energyStorageKind: settings.propulsionModel.kind }));
  const [candidate, setCandidate] = useState<ProvisionalAircraftCandidate>();
  const [candidateError, setCandidateError] = useState<string>();
  const inputs = useMemo(() => ({ ...settings, designPoint }), [settings, designPoint]);
  const sensitivity = useMemo(() => calculateSizingSensitivity(design, inputs, alternateInitialMassKg), [design, inputs, alternateInitialMassKg]);
  const result = sensitivity.primary;
  const currentMetrics = useMemo(() => calculateMetrics(design), [design]);
  const resolvedCandidateInputs = useMemo(() => ({ ...candidateInputs, energyStorageKind: inputs.propulsionModel.kind }), [candidateInputs, inputs.propulsionModel.kind]);
  const candidateStale = candidate ? isProvisionalCandidateStale(candidate, design, result, resolvedCandidateInputs) : false;

  const update = <K extends keyof PreliminarySizingInputs>(key: K, value: PreliminarySizingInputs[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const setPropulsionKind = (kind: SizingPropulsionModel['kind']) => update('propulsionModel', kind === 'electric'
    ? { kind, batteryUsableShaftSpecificEnergyJPerKg: design.massModel.energyMassKg > 0 ? design.propulsion.usableShaftEnergyJ / design.massModel.energyMassKg : 0 }
    : { kind, brakeSpecificFuelConsumptionKgPerJ: 0 });
  const generateCandidate = () => {
    try {
      setCandidate(generateProvisionalAircraftCandidate(design, result, resolvedCandidateInputs));
      setCandidateError(undefined);
    } catch (error) {
      setCandidate(undefined);
      setCandidateError(error instanceof Error ? error.message : 'Candidate generation failed.');
    }
  };
  const massItems = result.finalTakeoffMassKg ? [
    { label: 'Airframe', value: inputs.airframeMassKg, color: '#65a9dd' },
    { label: 'Propulsion', value: inputs.propulsionMassKg, color: '#bd8ee5' },
    { label: 'Fixed equipment', value: inputs.fixedEquipmentMassKg, color: '#7d91a3' },
    { label: 'Payload', value: result.payloadMassKg ?? 0, color: '#ee8b5e' },
    { label: inputs.propulsionModel.kind === 'electric' ? 'Battery' : 'Fuel', value: result.energyStorageMassKg ?? 0, color: '#72c69c' },
  ] : [];

  return <div className="sizing-workspace">
    <div className="sizing-toolbar"><div><small>M4.4 · MODEL {result.contract.modelVersion} · DESIGN REV {design.revision}</small><h2>Iterative preliminary aircraft sizing</h2></div><div className="unit-toggle sizing-units"><button className={units === 'si' ? 'active' : ''} onClick={() => setUnits('si')}>SI</button><button className={units === 'aviation' ? 'active' : ''} onClick={() => setUnits('aviation')}>AVIATION</button></div></div>
    <div className={`sizing-status ${result.status}`}><strong>{result.status.toUpperCase()}</strong><span>{result.statusDetail}</span><i>MISSION {result.missionStatus.toUpperCase()}</i></div>
    <div className="sizing-grid">
      <aside className="sizing-controls">
        <section><h3>Selected design point</h3>
          <SizingInput label="Wing loading W/S" value={designPoint.wingLoadingNm2} quantity="wingLoading" units={units} onChange={(wingLoadingNm2) => selectPoint({ ...designPoint, wingLoadingNm2 })} />
          <SizingInput label="Installed shaft P/W" value={designPoint.shaftPowerLoadingWPerN} quantity="shaftPowerLoading" units={units} onChange={(shaftPowerLoadingWPerN) => selectPoint({ ...designPoint, shaftPowerLoadingWPerN })} />
          <p>Shared with the M4.3 constraint diagram. Editing it does not resize current geometry.</p>
        </section>
        <section><h3>Mass assumptions</h3>
          <SizingInput label="Initial takeoff mass" value={inputs.initialTakeoffMassKg} quantity="mass" units={units} onChange={(value) => update('initialTakeoffMassKg', value)} />
          <SizingInput label="Alternate initial mass" value={alternateInitialMassKg} quantity="mass" units={units} onChange={setAlternateInitialMassKg} />
          <SizingInput label="Airframe mass" value={inputs.airframeMassKg} quantity="mass" units={units} onChange={(value) => update('airframeMassKg', value)} />
          <SizingInput label="Propulsion mass" value={inputs.propulsionMassKg} quantity="mass" units={units} onChange={(value) => update('propulsionMassKg', value)} />
          <SizingInput label="Fixed equipment" value={inputs.fixedEquipmentMassKg} quantity="mass" units={units} onChange={(value) => update('fixedEquipmentMassKg', value)} />
          <p>These are explicit user inputs; no statistical empty-mass correlation is applied.</p>
        </section>
        <section><h3>Energy model</h3>
          <label className="sizing-input"><span>Propulsion type<small>distinct models</small></span><select value={inputs.propulsionModel.kind} onChange={(event) => setPropulsionKind(event.target.value as SizingPropulsionModel['kind'])}><option value="electric">Electric</option><option value="fuel">Fuel-powered</option></select></label>
          {inputs.propulsionModel.kind === 'electric'
            ? <SizingInput label="Effective battery energy" value={inputs.propulsionModel.batteryUsableShaftSpecificEnergyJPerKg} quantity="specificEnergy" units={units} onChange={(value) => update('propulsionModel', { kind: 'electric', batteryUsableShaftSpecificEnergyJPerKg: value })} />
            : <SizingInput label="Brake specific fuel use" value={inputs.propulsionModel.brakeSpecificFuelConsumptionKgPerJ} quantity="fuelConsumption" units={units} onChange={(value) => update('propulsionModel', { kind: 'fuel', brakeSpecificFuelConsumptionKgPerJ: value })} />}
          <SizingInput label="Reserve" value={inputs.reserveFraction * 100} units={units} note="% of capacity" onChange={(value) => update('reserveFraction', value / 100)} />
          <p>Battery energy is effective shaft-deliverable energy per pack mass. Fuel mode requires user-entered brake-specific fuel consumption.</p>
        </section>
        <section><h3>Iteration controls</h3>
          <SizingInput label="Damping factor" value={inputs.dampingFactor} units={units} note="0–1" onChange={(value) => update('dampingFactor', value)} />
          <SizingInput label="Mass tolerance" value={inputs.convergenceToleranceKg} quantity="mass" units={units} onChange={(value) => update('convergenceToleranceKg', value)} />
          <SizingInput label="Maximum iterations" value={inputs.maximumIterations} units={units} note="count" onChange={(value) => update('maximumIterations', value)} />
        </section>
      </aside>
      <div className="sizing-results">
        <div className="sizing-summary">
          <div><small>TAKEOFF MASS</small><strong>{display(result.finalTakeoffMassKg, 'mass', units, 1)}</strong></div>
          <div><small>REQUIRED WING AREA</small><strong>{display(result.requiredWingAreaM2, 'area', units, 1)}</strong></div>
          <div><small>INSTALLED SHAFT POWER</small><strong>{display(result.requiredInstalledShaftPowerW, 'power', units, 1)}</strong></div>
          <div><small>MISSION SHAFT ENERGY</small><strong>{display(result.missionShaftEnergyJ, 'energy', units, 1)}</strong></div>
        </div>
        <div className="sizing-panels">
          <section className="sizing-card"><div className="sizing-card-head"><div><strong>Mass convergence</strong><span>Primary and alternate initial estimates</span></div><i className={sensitivity.insensitiveToInitialGuess ? 'pass' : 'warn'}>{sensitivity.insensitiveToInitialGuess ? 'INITIAL-GUESS INSENSITIVE' : 'CHECK SENSITIVITY'}</i></div>
            <ConvergencePlot histories={[{ label: 'Primary', values: result.iterations.map((item) => item.massEstimateKg) }, { label: 'Alternate', values: sensitivity.alternate.iterations.map((item) => item.massEstimateKg) }]} />
            <div className="sizing-legend"><span><i />Primary ({result.iterations.length} iterations)</span><span><i />Alternate ({sensitivity.alternate.iterations.length} iterations)</span><span>Final difference: {display(sensitivity.convergedMassDifferenceKg, 'mass', units, 3)}</span></div>
          </section>
          <section className="sizing-card"><div className="sizing-card-head"><div><strong>Mass breakdown</strong><span>Explicit fixed masses plus calculated storage</span></div></div>
            <div className="mass-bar">{massItems.map((item) => <span key={item.label} style={{ width: `${100 * item.value / result.finalTakeoffMassKg!}%`, background: item.color }} title={`${item.label}: ${item.value.toFixed(2)} kg`} />)}</div>
            <div className="mass-list">{massItems.map((item) => <div key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><strong>{display(item.value, 'mass', units, 1)}</strong></div>)}</div>
          </section>
        </div>
        <section className="sizing-card balance-card"><div className="sizing-card-head"><div><strong>Closure and energy balance</strong><span>Positive/negative residuals retain their algebraic sign</span></div></div>
          <div className="balance-grid">
            <div><small>MASS RESIDUAL</small><strong>{display(result.massBalanceResidualKg, 'mass', units, 4)}</strong></div>
            <div><small>ENERGY RESIDUAL</small><strong>{display(result.energyBalanceResidualJ, 'energy', units, 6)}</strong></div>
            <div><small>CRUISE SHAFT POWER</small><strong>{display(result.requiredCruiseShaftPowerW, 'power', units, 1)}</strong></div>
            <div><small>RESERVE SHAFT ENERGY</small><strong>{display(result.reserveShaftEnergyJ, 'energy', units, 1)}</strong></div>
            <div><small>STORAGE MASS FRACTION</small><strong>{result.energyMassFraction === undefined ? '—' : `${(100 * result.energyMassFraction).toFixed(2)} %`}</strong></div>
            <div><small>STORAGE CAPACITY</small><strong>{display(result.totalShaftEnergyCapacityJ, 'energy', units, 1)}</strong></div>
          </div>
        </section>
        <section className="sizing-card sizing-candidate-card">
          <div className="sizing-card-head"><div><strong>M4.6 provisional aircraft candidate</strong><span>Isolated preview only - no authoritative design values are changed</span></div><i className={candidateStale ? 'warn' : candidate ? 'pass' : 'warn'}>{candidateStale ? 'STALE' : candidate ? 'CURRENT DRAFT' : 'NOT GENERATED'}</i></div>
          <div className="candidate-controls">
            <SizingInput label="Candidate aspect ratio" value={candidateInputs.aspectRatio} units={units} note="3-20" min={3} max={20} onChange={(aspectRatio) => setCandidateInputs((current) => ({ ...current, aspectRatio }))} />
            <SizingInput label="Candidate taper ratio" value={candidateInputs.taperRatio} units={units} note="0-1" min={0.01} max={1} onChange={(taperRatio) => setCandidateInputs((current) => ({ ...current, taperRatio }))} />
            <button className="candidate-action" disabled={result.status !== 'converged'} onClick={generateCandidate}>{candidate ? 'REGENERATE' : 'GENERATE CANDIDATE'}</button>
            <button className="candidate-action secondary" disabled={!candidate} onClick={() => { setCandidate(undefined); setCandidateError(undefined); }}>DISCARD</button>
          </div>
          {result.status !== 'converged' && <div className="candidate-message invalid">Generation is blocked until the sizing result is converged.</div>}
          {candidateError && <div className="candidate-message invalid">{candidateError}</div>}
          {candidateStale && <div className="candidate-message stale">Mission, sizing, design, or candidate inputs changed. This draft is retained for comparison but must be regenerated.</div>}
          {candidate && <>
            <div className="candidate-comparison">
              <div className="candidate-table"><div className="candidate-row heading"><span>PARAMETER</span><span>CURRENT</span><span>PROVISIONAL</span></div>
                <div className="candidate-row"><span>Wing area</span><strong>{display(currentMetrics.wingAreaM2, 'area', units)}</strong><strong>{display(candidate.geometry.wingAreaM2, 'area', units)}</strong></div>
                <div className="candidate-row"><span>Wing span</span><strong>{display(wingView.spanM, 'length', units)}</strong><strong>{display(candidate.geometry.spanM, 'length', units)}</strong></div>
                <div className="candidate-row"><span>Root chord</span><strong>{display(wingView.rootChordM, 'length', units)}</strong><strong>{display(candidate.geometry.rootChordM, 'length', units)}</strong></div>
                <div className="candidate-row"><span>Tip chord</span><strong>{display(currentMetrics.tipChordM, 'length', units)}</strong><strong>{display(candidate.geometry.tipChordM, 'length', units)}</strong></div>
                <div className="candidate-row"><span>Aspect ratio</span><strong>{currentMetrics.aspectRatio.toFixed(2)}</strong><strong>{candidate.geometry.aspectRatio.toFixed(2)}</strong></div>
                <div className="candidate-row"><span>Takeoff mass</span><strong>{display(design.massKg, 'mass', units)}</strong><strong>{display(candidate.takeoffMassKg, 'mass', units)}</strong></div>
                <div className="candidate-row"><span>Installed shaft power</span><strong>{display(design.propulsion.shaftPowerW, 'power', units)}</strong><strong>{display(candidate.installedShaftPowerW, 'power', units)}</strong></div>
                <div className="candidate-row"><span>{candidate.energyStorage.kind === 'electric' ? 'Battery' : 'Fuel'} mass</span><strong>{display(design.massModel.energyMassKg, 'mass', units)}</strong><strong>{display(candidate.energyStorage.massKg, 'mass', units)}</strong></div>
              </div>
              <div className="candidate-preview"><Viewport designOverride={candidate.previewDesign} /><span>NON-DESTRUCTIVE 3D PREVIEW</span></div>
            </div>
            <div className="candidate-statuses"><div><small>MISSION STATUS</small><strong>{candidate.missionStatus.toUpperCase()}</strong></div>{candidate.constraintStatuses.map((constraint) => <div key={constraint.id}><small>{constraint.label}</small><strong className={constraint.status}>{constraint.status.toUpperCase()}</strong>{constraint.margin !== undefined && <span>margin {constraint.margin.toFixed(3)} {constraint.unit}</span>}{constraint.limitation && <span>{constraint.limitation}</span>}</div>)}</div>
            <div className="candidate-notes"><details open><summary>Assumptions and provenance</summary>{candidate.assumptions.map((item) => <p key={item}>{item}</p>)}{candidate.provenance.map((item) => <p key={item}>{item}</p>)}</details><details open><summary>Limitations</summary>{candidate.limitations.map((item) => <p key={item}>{item}</p>)}</details></div>
          </>}
        </section>
        <div className="sizing-limitations"><div><small>MODEL BOUNDARY</small><p>Cruise-only constant-mass energy estimate. No takeoff, climb, descent, taxi, loiter, wind, fuel-mass depletion, propulsion map, or altitude derating model.</p></div><div><small>FEASIBILITY</small><p>Convergence is only mass/energy closure. Takeoff remains mandatory and unevaluated, so a converged sizing result is mission-indeterminate.</p></div></div>
        {result.contract.warnings.length > 0 && <div className="warning sizing-warning">⚠ {result.contract.warnings.join(' ')}</div>}
      </div>
    </div>
  </div>;
}
