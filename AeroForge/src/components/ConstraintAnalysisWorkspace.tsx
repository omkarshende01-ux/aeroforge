import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  analyzeAircraftConstraints,
  evaluateConstraintPoint,
  type ConstraintAnalysisResult,
  type ConstraintPoint,
  type PowerConstraintCurve,
  type SizingConstraintId,
} from '../engineering/constraints';
import { convertFromSi, missionUnit, type MissionUnitSystem } from '../engineering/units';
import { useDesignStore } from '../state/useDesignStore';

const chart = { width: 760, height: 430, left: 72, right: 24, top: 24, bottom: 58 };
const plotWidth = chart.width - chart.left - chart.right;
const plotHeight = chart.height - chart.top - chart.bottom;
const curveColors: Record<string, string> = { 'cruise-power': '#65a9dd', 'minimum-climb': '#ee8b5e', 'service-ceiling': '#bd8ee5' };
const constraintLabels: Record<SizingConstraintId, string> = {
  'stall-speed': 'Maximum stall speed',
  'cruise-power': 'Cruise shaft power',
  'minimum-climb': 'Minimum rate of climb',
  'service-ceiling': 'Service ceiling',
  'takeoff-distance': 'Maximum takeoff distance',
};

function xPosition(result: ConstraintAnalysisResult, wingLoadingNm2: number): number {
  return chart.left + plotWidth * (wingLoadingNm2 - result.domain.minWingLoadingNm2) / (result.domain.maxWingLoadingNm2 - result.domain.minWingLoadingNm2);
}

function yPosition(result: ConstraintAnalysisResult, shaftPowerLoadingWPerN: number): number {
  return chart.top + plotHeight * (result.domain.maxShaftPowerLoadingWPerN - shaftPowerLoadingWPerN) / (result.domain.maxShaftPowerLoadingWPerN - result.domain.minShaftPowerLoadingWPerN);
}

function curvePath(result: ConstraintAnalysisResult, curve: PowerConstraintCurve): string {
  return curve.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xPosition(result, point.wingLoadingNm2).toFixed(1)},${yPosition(result, point.shaftPowerLoadingWPerN).toFixed(1)}`).join(' ');
}

function feasiblePolygon(result: ConstraintAnalysisResult): string {
  if (result.feasibleBoundary.length < 2) return '';
  const boundary = result.feasibleBoundary.map((point) => `${xPosition(result, point.wingLoadingNm2).toFixed(1)},${yPosition(result, point.shaftPowerLoadingWPerN).toFixed(1)}`);
  const first = result.feasibleBoundary[0]; const last = result.feasibleBoundary.at(-1)!;
  boundary.push(`${xPosition(result, last.wingLoadingNm2).toFixed(1)},${chart.top}`, `${xPosition(result, first.wingLoadingNm2).toFixed(1)},${chart.top}`);
  return boundary.join(' ');
}

function inDomain(result: ConstraintAnalysisResult, point: ConstraintPoint | undefined): point is ConstraintPoint {
  return point !== undefined && point.wingLoadingNm2 >= result.domain.minWingLoadingNm2 && point.wingLoadingNm2 <= result.domain.maxWingLoadingNm2 &&
    point.shaftPowerLoadingWPerN >= result.domain.minShaftPowerLoadingWPerN && point.shaftPowerLoadingWPerN <= result.domain.maxShaftPowerLoadingWPerN;
}

function formatAxis(value: number, quantity: 'wingLoading' | 'shaftPowerLoading', units: MissionUnitSystem): string {
  const converted = convertFromSi(value, quantity, units);
  return units === 'si' ? converted.toFixed(0) : converted.toFixed(quantity === 'wingLoading' ? 1 : 3);
}

export function ConstraintAnalysisWorkspace() {
  const design = useDesignStore((state) => state.design);
  const result = useMemo(() => analyzeAircraftConstraints(design), [design]);
  const [units, setUnits] = useState<MissionUnitSystem>('si');
  const [selected, setSelected] = useState<ConstraintPoint>();
  const fallback = result.currentPoint ?? {
    wingLoadingNm2: (result.domain.minWingLoadingNm2 + result.domain.maxWingLoadingNm2) / 2,
    shaftPowerLoadingWPerN: result.domain.maxShaftPowerLoadingWPerN / 2,
  };
  const candidate = selected ?? fallback;

  useEffect(() => {
    if (selected && !inDomain(result, selected)) setSelected(undefined);
  }, [result, selected]);

  const evaluation = evaluateConstraintPoint(result, candidate);
  const xUnit = missionUnit(units, 'wingLoading').label;
  const yUnit = missionUnit(units, 'shaftPowerLoading').label;
  const xTicks = Array.from({ length: 6 }, (_, index) => result.domain.minWingLoadingNm2 + (result.domain.maxWingLoadingNm2 - result.domain.minWingLoadingNm2) * index / 5);
  const yTicks = Array.from({ length: 6 }, (_, index) => result.domain.minShaftPowerLoadingWPerN + (result.domain.maxShaftPowerLoadingWPerN - result.domain.minShaftPowerLoadingWPerN) * index / 5);

  const chooseCandidate = (event: MouseEvent<SVGSVGElement>) => {
    if (result.contract.validity === 'invalid') return;
    const rectangle = event.currentTarget.getBoundingClientRect();
    const svgX = (event.clientX - rectangle.left) * chart.width / rectangle.width;
    const svgY = (event.clientY - rectangle.top) * chart.height / rectangle.height;
    if (svgX < chart.left || svgX > chart.width - chart.right || svgY < chart.top || svgY > chart.height - chart.bottom) return;
    setSelected({
      wingLoadingNm2: result.domain.minWingLoadingNm2 + (svgX - chart.left) / plotWidth * (result.domain.maxWingLoadingNm2 - result.domain.minWingLoadingNm2),
      shaftPowerLoadingWPerN: result.domain.maxShaftPowerLoadingWPerN - (svgY - chart.top) / plotHeight * (result.domain.maxShaftPowerLoadingWPerN - result.domain.minShaftPowerLoadingWPerN),
    });
  };

  return <div className="constraint-workspace">
    <div className="constraint-toolbar">
      <div><small>M4.3 · MODEL {result.contract.modelVersion} · DESIGN REV {result.contract.designRevision}</small><h2>Aircraft constraint analysis</h2></div>
      <div className="unit-toggle constraint-units" role="group" aria-label="Constraint diagram units">
        <button className={units === 'si' ? 'active' : ''} onClick={() => setUnits('si')}>SI</button>
        <button className={units === 'aviation' ? 'active' : ''} onClick={() => setUnits('aviation')}>AVIATION</button>
      </div>
    </div>
    <div className={`constraint-overall ${evaluation.overallStatus}`}>
      <strong>{evaluation.overallStatus === 'indeterminate' && evaluation.evaluatedFeasible ? 'EVALUATED CONSTRAINTS PASS — OVERALL INDETERMINATE' : evaluation.overallStatus.toUpperCase()}</strong>
      <span>{evaluation.overallStatus === 'indeterminate' ? 'Mandatory takeoff distance remains unevaluated.' : evaluation.overallStatus === 'infeasible' ? 'The selected point violates one or more evaluated constraints.' : result.contract.validity === 'invalid' ? 'Correct invalid inputs before selecting a candidate.' : 'Constraint status for the selected point.'}</span>
    </div>
    <div className="constraint-layout">
      <section className="constraint-chart-card">
        <div className="chart-heading"><div><strong>Constraint diagram</strong><span>Click inside the plot to select a candidate design point.</span></div><span className={result.hasEvaluatedFeasibleRegion ? 'region-ok' : 'region-none'}>{result.hasEvaluatedFeasibleRegion ? 'EVALUATED REGION AVAILABLE' : 'NO REGION IN PLOTTED DOMAIN'}</span></div>
        <svg className="constraint-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Wing loading versus installed shaft power loading constraint diagram" onClick={chooseCandidate}>
          <rect x={chart.left} y={chart.top} width={plotWidth} height={plotHeight} className="plot-background" />
          {xTicks.map((tick) => <g key={`x-${tick}`}><line x1={xPosition(result, tick)} x2={xPosition(result, tick)} y1={chart.top} y2={chart.height - chart.bottom} className="chart-grid" /><text x={xPosition(result, tick)} y={chart.height - 35} textAnchor="middle">{formatAxis(tick, 'wingLoading', units)}</text></g>)}
          {yTicks.map((tick) => <g key={`y-${tick}`}><line x1={chart.left} x2={chart.width - chart.right} y1={yPosition(result, tick)} y2={yPosition(result, tick)} className="chart-grid" /><text x={chart.left - 10} y={yPosition(result, tick) + 3} textAnchor="end">{formatAxis(tick, 'shaftPowerLoading', units)}</text></g>)}
          {result.hasEvaluatedFeasibleRegion && <polygon points={feasiblePolygon(result)} className="feasible-region" />}
          {result.stallWingLoadingLimitNm2 !== undefined && result.stallWingLoadingLimitNm2 >= result.domain.minWingLoadingNm2 && result.stallWingLoadingLimitNm2 <= result.domain.maxWingLoadingNm2 && <line x1={xPosition(result, result.stallWingLoadingLimitNm2)} x2={xPosition(result, result.stallWingLoadingLimitNm2)} y1={chart.top} y2={chart.height - chart.bottom} className="stall-limit" />}
          {result.curves.map((curve) => <path key={curve.id} d={curvePath(result, curve)} fill="none" stroke={curveColors[curve.id]} className="constraint-curve" />)}
          {inDomain(result, result.currentPoint) && <g className="current-marker"><circle cx={xPosition(result, result.currentPoint.wingLoadingNm2)} cy={yPosition(result, result.currentPoint.shaftPowerLoadingWPerN)} r="6" /><text x={xPosition(result, result.currentPoint.wingLoadingNm2) + 10} y={yPosition(result, result.currentPoint.shaftPowerLoadingWPerN) - 8}>CURRENT</text></g>}
          {inDomain(result, candidate) && <g className="candidate-marker" transform={`translate(${xPosition(result, candidate.wingLoadingNm2)} ${yPosition(result, candidate.shaftPowerLoadingWPerN)})`}><path d="M0,-7 L7,0 L0,7 L-7,0 Z" /><text x="10" y="15">CANDIDATE</text></g>}
          <text x={chart.left + plotWidth / 2} y={chart.height - 8} textAnchor="middle" className="axis-title">WING LOADING W/S ({xUnit})</text>
          <text transform={`translate(16 ${chart.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" className="axis-title">INSTALLED SHAFT POWER LOADING P/W ({yUnit})</text>
        </svg>
        <div className="constraint-legend">
          <span><i className="legend-feasible" />Satisfies evaluated constraints</span>
          {result.curves.map((curve) => <span key={curve.id}><i style={{ background: curveColors[curve.id] }} />{curve.label}</span>)}
          <span><i className="legend-stall" />Stall W/S limit</span>
        </div>
      </section>
      <aside className="candidate-card">
        <div className="candidate-head"><div><small>SELECTED CANDIDATE</small><h3>{formatAxis(candidate.wingLoadingNm2, 'wingLoading', units)} {xUnit}</h3><p>{formatAxis(candidate.shaftPowerLoadingWPerN, 'shaftPowerLoading', units)} {yUnit}</p></div><span className={evaluation.evaluatedFeasible ? 'pass' : 'fail'}>{evaluation.evaluatedFeasible ? 'EVALUATED PASS' : 'EVALUATED FAIL'}</span></div>
        <div className="governing"><small>GOVERNING CONSTRAINT</small><strong>{evaluation.governingConstraint ? constraintLabels[evaluation.governingConstraint] : 'Not available'}</strong></div>
        <div className="margin-list">{evaluation.constraints.map((constraint) => {
          const quantity = constraint.unit === 'N/m²' ? 'wingLoading' : constraint.unit === 'W/N' ? 'shaftPowerLoading' : undefined;
          const unit = quantity ? missionUnit(units, quantity).label : '—';
          const margin = constraint.margin === undefined || !quantity ? '—' : `${convertFromSi(constraint.margin, quantity, units).toFixed(units === 'si' ? 2 : 3)} ${unit}`;
          return <div key={constraint.id}><span><i className={constraint.status} />{constraint.label}</span><strong>{margin}</strong></div>;
        })}</div>
        <p className="candidate-note">Positive margins pass. Power margins are installed shaft P/W minus required shaft P/W. The stall margin is allowable minus selected W/S.</p>
      </aside>
    </div>
    <div className="constraint-provenance">
      <div><small>POWER DEFINITIONS</small><p>Installed shaft power is mechanical power at the shaft. Propulsive power is ηp·Pshaft. Available power assumes no altitude derating; ISA density changes aerodynamic power required.</p></div>
      <div><small>UNEVALUATED</small><p>Takeoff distance has no defensible model. Range/payload remain in Mission Feasibility and are not sizing curves. No point is declared overall feasible while takeoff is unresolved.</p></div>
    </div>
    {result.contract.warnings.length > 0 && <div className="warning constraint-warning">⚠ {result.contract.warnings.join(' ')}</div>}
  </div>;
}
