import { RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ControlSurfaceDefinition, ControlSurfaceKind, ControlSurfaceOperation } from '../domain/types';
import {
  addControlSurface,
  calculateControlSurfaceProperties,
  deleteControlSurface,
  editControlSurface,
  neutralizeControlSurfaces,
  type ControlSurfaceEditResult,
} from '../engineering/controlSurfaces';
import { useDesignStore } from '../state/useDesignStore';

const kinds: ControlSurfaceKind[] = ['aileron', 'flap', 'elevator', 'rudder'];
function numberValue(value: string): number { return value === '' ? Number.NaN : Number(value); }

export function ControlSurfaceEditor() {
  const design = useDesignStore((state) => state.design);
  const selectedId = useDesignStore((state) => state.selectedControlSurfaceId) ?? design.controlSurfaces.surfaces[0]?.id;
  const select = useDesignStore((state) => state.selectControlSurface);
  const commit = useDesignStore((state) => state.commitControlSurfaces);
  const selected = design.controlSurfaces.surfaces.find((surface) => surface.id === selectedId);
  const [errors, setErrors] = useState<string[]>([]);

  const apply = (result: ControlSurfaceEditResult) => {
    if (!result.model) { setErrors(result.errors); return; }
    setErrors(commit(result.model, result.selectedControlSurfaceId));
  };
  const edit = (patch: Partial<Omit<ControlSurfaceDefinition, 'id' | 'kind' | 'parentSurface'>>) => selected && apply(editControlSurface(design, selected.id, patch));
  const properties = selected ? calculateControlSurfaceProperties(design, selected) : undefined;
  const operations: ControlSurfaceOperation[] = selected?.kind === 'aileron' ? ['differential', 'independent'] : selected?.kind === 'rudder' ? ['independent'] : ['symmetric', 'independent'];

  return <section className="control-surface-editor">
    <div className="control-editor-heading">
      <div><small>MODEL V1 · CONVENTIONAL HINGED SURFACES</small><h3>Control surfaces</h3><p>Span stations are measured from the parent root. Positive linked command deflects trailing edges down; differential command moves port and starboard in opposite directions.</p></div>
      <div className="control-add-actions">{kinds.map((kind) => <button key={kind} onClick={() => apply(addControlSurface(design, kind))}>+ {kind}</button>)}<button disabled={design.controlSurfaces.surfaces.every((surface) => surface.currentDeflectionDeg === 0)} onClick={() => apply(neutralizeControlSurfaces(design))}><RotateCcw size={12} /> Neutral all</button></div>
    </div>
    {errors.length > 0 && <div className="wing-editor-errors" role="alert"><strong>Control change rejected</strong>{errors.map((error) => <span key={error}>{error}</span>)}</div>}
    <div className="control-editor-body">
      <div className="control-list">
        {design.controlSurfaces.surfaces.length === 0 && <p>No control surfaces defined. Add a conventional hinged surface to begin.</p>}
        {design.controlSurfaces.surfaces.map((surface) => {
          const itemProperties = calculateControlSurfaceProperties(design, surface);
          return <button key={surface.id} className={surface.id === selectedId ? 'selected' : ''} onClick={() => select(surface.id)}>
            <span className={`control-kind ${surface.kind}`} />
            <b>{surface.name}</b><em>{surface.enabled ? `${surface.currentDeflectionDeg.toFixed(1)}°` : 'DISABLED'}</em>
            <small>{surface.kind} · {itemProperties.projectedAreaM2.toFixed(3)} m²</small>
          </button>;
        })}
      </div>
      {selected && properties ? <div className="control-detail">
        <div className="control-detail-title"><div><strong>{selected.kind.toUpperCase()}</strong><span>{selected.parentSurface} · {selected.id}</span></div><label><input type="checkbox" checked={selected.enabled} onChange={(event) => edit({ enabled: event.target.checked })} /> enabled</label><button className="danger" onClick={() => apply(deleteControlSurface(design, selected.id))}><Trash2 size={12} /> Delete</button></div>
        <div className="control-fields">
          <label>Name<input aria-label="Control surface name" value={selected.name} onChange={(event) => edit({ name: event.target.value })} /></label>
          <label>Operation<select aria-label="Control surface operation" value={selected.operation} onChange={(event) => edit({ operation: event.target.value as ControlSurfaceOperation })}>{operations.map((operation) => <option key={operation}>{operation}</option>)}</select></label>
          {selected.operation === 'independent' && selected.parentSurface !== 'vertical-tail' ? <label>Side<select aria-label="Control surface side" value={selected.side} onChange={(event) => edit({ side: event.target.value as 'port' | 'starboard' })}><option value="port">port</option><option value="starboard">starboard</option></select></label> : <label>Side<input value={selected.side} disabled /></label>}
          <label>Span start <i>m</i><input aria-label="Control span start" type="number" step="0.05" min="0" value={selected.spanStartM} onChange={(event) => edit({ spanStartM: numberValue(event.target.value) })} /></label>
          <label>Span end <i>m</i><input aria-label="Control span end" type="number" step="0.05" min="0" value={selected.spanEndM} onChange={(event) => edit({ spanEndM: numberValue(event.target.value) })} /></label>
          <label>Chord fraction<input aria-label="Control chord fraction" type="number" step="0.01" min="0.01" max="0.99" value={selected.chordFraction} onChange={(event) => edit({ chordFraction: numberValue(event.target.value) })} /></label>
          <label>Hinge x/c<input aria-label="Control hinge fraction" type="number" step="0.01" min="0.01" max="0.99" value={selected.hingeChordFraction} onChange={(event) => edit({ hingeChordFraction: numberValue(event.target.value) })} /></label>
          <label>Minimum <i>deg</i><input aria-label="Minimum control deflection" type="number" step="1" value={selected.minimumDeflectionDeg} onChange={(event) => edit({ minimumDeflectionDeg: numberValue(event.target.value) })} /></label>
          <label>Maximum <i>deg</i><input aria-label="Maximum control deflection" type="number" step="1" value={selected.maximumDeflectionDeg} onChange={(event) => edit({ maximumDeflectionDeg: numberValue(event.target.value) })} /></label>
          <label className="deflection-field">Command <i>deg</i><input aria-label="Current control deflection" type="range" min={selected.minimumDeflectionDeg} max={selected.maximumDeflectionDeg} step="0.5" value={selected.currentDeflectionDeg} onChange={(event) => edit({ currentDeflectionDeg: numberValue(event.target.value) })} /><input aria-label="Current control deflection value" type="number" min={selected.minimumDeflectionDeg} max={selected.maximumDeflectionDeg} step="0.5" value={selected.currentDeflectionDeg} onChange={(event) => edit({ currentDeflectionDeg: numberValue(event.target.value) })} /></label>
        </div>
        <div className="control-metrics"><span>PROJECTED AREA <b>{properties.projectedAreaM2.toFixed(3)} m²</b></span><span>TOTAL SPAN <b>{properties.totalProjectedSpanM.toFixed(3)} m</b></span><span>HINGE <b>{selected.hingeChordFraction.toFixed(3)} c</b></span>{properties.instances.map((instance) => <span key={instance.key}>{instance.side.toUpperCase()} PHYSICAL <b>{instance.physicalDeflectionDeg.toFixed(1)}°</b></span>)}</div>
        {properties.warnings.map((warning) => <p className="control-warning" key={warning}>{warning}</p>)}
      </div> : <div className="control-detail empty">Select or create a control surface.</div>}
    </div>
    <div className="wing-editor-limitation"><strong>GEOMETRY ONLY</strong><span>Movable skins rotate rigidly about a straight endpoint hinge axis within one parent panel. No lift, drag, hinge moment, actuator load, control effectiveness, trim, or flight-control response is calculated.</span></div>
  </section>;
}
