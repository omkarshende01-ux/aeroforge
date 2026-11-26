import { calculateAerodynamics } from '../engineering/aerodynamics';
import { useDesignStore } from '../state/useDesignStore';

const format = (value: number | undefined, digits = 3) => value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);

function SpanLoadPlot({ points }: { points: { spanPositionM: number; liftPerSpanNm: number }[] }) {
  if (points.length === 0) return <div className="plot-empty">No valid span-load result</div>;
  const max = Math.max(...points.map((point) => Math.abs(point.liftPerSpanNm)), 1);
  const minY = points[0].spanPositionM; const maxY = points.at(-1)?.spanPositionM ?? 1;
  const path = points.map((point, index) => {
    const x = 8 + 244 * (point.spanPositionM - minY) / (maxY - minY);
    const y = 72 - 58 * point.liftPerSpanNm / max;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return <svg className="span-plot" viewBox="0 0 260 84" role="img" aria-label="Elliptical span-load estimate"><line x1="8" y1="72" x2="252" y2="72" /><line x1="130" y1="8" x2="130" y2="76" /><path d={path} /><text x="8" y="82">left tip</text><text x="224" y="82">right tip</text></svg>;
}

export function AerodynamicsPanel() {
  const design = useDesignStore((state) => state.design);
  const result = calculateAerodynamics(design);
  return <div className="analysis aero-analysis">
    <div className="analysis-head"><span>ANALYSIS / AERODYNAMICS</span><span className="model-tag">LINEAR PRE-STALL + PARABOLIC DRAG</span></div>
    <div className="aero-body"><div className="metric-grid aero-grid">
      <div><small>DENSITY</small><strong>{format(result.densityKgM3, 4)} <i>kg/m³</i></strong></div>
      <div><small>DYNAMIC PRESSURE</small><strong>{format(result.dynamicPressurePa, 0)} <i>Pa</i></strong></div>
      <div><small>MACH</small><strong>{format(result.mach, 3)}</strong></div>
      <div><small>FINITE-WING CLα</small><strong>{format(result.finiteWingLiftSlopePerRad)} <i>1/rad</i></strong></div>
      <div><small>CL / CD</small><strong>{format(result.liftCoefficient)} / {format(result.dragCoefficient)}</strong></div>
      <div><small>LIFT / DRAG</small><strong>{format(result.liftN, 0)} / {format(result.dragN, 0)} <i>N</i></strong></div>
      <div><small>L/D</small><strong>{format(result.liftToDrag, 1)}</strong></div>
      <div><small>INDUCED CD</small><strong>{format(result.inducedDragCoefficient, 4)}</strong></div>
    </div><div className="span-card"><small>ELLIPTICAL SPAN-LOAD ESTIMATE</small><SpanLoadPlot points={result.spanLoad} /></div></div>
    {result.warnings.length > 0 && <div className="warning">⚠ {result.warnings.join(' ')}</div>}
    <div className="analysis-note">For conceptual, incompressible, attached-flow estimates only. The span load is an analytical elliptical approximation, not lifting-line, VLM, CFD, or a stall prediction.</div>
  </div>;
}
