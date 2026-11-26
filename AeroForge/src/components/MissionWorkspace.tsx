import { evaluateMissionFeasibility, type MissionConstraintEvaluation } from '../engineering/mission';
import { useDesignStore } from '../state/useDesignStore';

const statusLabel = { pass: 'PASS', fail: 'FAIL', 'not-evaluated': 'NOT EVALUATED' } as const;

function displayValue(evaluation: MissionConstraintEvaluation, value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (evaluation.id === 'range') return `${(value / 1000).toFixed(0)} km`;
  if (evaluation.id === 'payload') return `${value.toFixed(0)} kg`;
  if (evaluation.id === 'cruise-altitude') {
    return evaluation.margin === value ? `${value.toFixed(2)} m/s` : `${value.toFixed(0)} m`;
  }
  if (evaluation.unit === 'm/s') return `${value.toFixed(2)} m/s`;
  if (evaluation.unit === 'm') return `${value.toFixed(0)} m`;
  return `${value.toFixed(2)} ${evaluation.unit ?? ''}`.trim();
}

function ConstraintCard({ evaluation }: { evaluation: MissionConstraintEvaluation }) {
  return <article className={`constraint-card ${evaluation.status}`}>
    <div className="constraint-title"><h3>{evaluation.label}</h3><span>{statusLabel[evaluation.status]}</span></div>
    <p className="criterion">{evaluation.criterion}</p>
    {evaluation.status !== 'not-evaluated' && <div className="constraint-values">
      <div><small>CURRENT / CALCULATED</small><strong>{displayValue(evaluation, evaluation.actual)}</strong></div>
      <div><small>REQUIREMENT</small><strong>{displayValue(evaluation, evaluation.required)}</strong></div>
      <div><small>MARGIN</small><strong>{displayValue(evaluation, evaluation.margin)}</strong></div>
    </div>}
    {evaluation.limitation && <p className="limitation">{evaluation.limitation}</p>}
  </article>;
}

export function MissionWorkspace() {
  const design = useDesignStore((state) => state.design);
  const result = evaluateMissionFeasibility(design);
  return <div className="mission-workspace">
    <div className="mission-summary">
      <div><span>SUPPORTED CONSTRAINTS</span><strong>{result.passCount + result.failCount}</strong></div>
      <div className="summary-pass"><span>PASS</span><strong>{result.passCount}</strong></div>
      <div className="summary-fail"><span>FAIL</span><strong>{result.failCount}</strong></div>
      <div><span>NOT EVALUATED</span><strong>{result.notEvaluatedCount}</strong></div>
    </div>
    {!result.validation.valid && <div className="mission-validation">
      <strong>Mission inputs require correction.</strong>
      <span>{Object.values(result.validation.errors).join(' ')}</span>
    </div>}
    <div className="mission-intro">
      <div><small>PHASE 4A</small><h2>Mission feasibility</h2></div>
      <p>Compares the current aircraft against mission constraints using the existing mass, atmosphere, stall, power, climb, and still-air range models. Unsupported requirements remain visible and are never inferred.</p>
    </div>
    <div className="constraint-grid">{result.evaluations.map((evaluation) => <ConstraintCard evaluation={evaluation} key={evaluation.id} />)}</div>
    {result.analysisWarnings.length > 0 && <div className="warning mission-warning">⚠ {result.analysisWarnings.join(' ')}</div>}
  </div>;
}
