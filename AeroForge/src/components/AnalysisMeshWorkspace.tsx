import { useMemo, useState } from 'react';
import { Activity, CircleDot, Grid3X3, RefreshCw } from 'lucide-react';
import type { AnalysisMeshConfiguration, AnalysisSpacing, AnalysisSurfaceId } from '../domain/analysisGeometry';
import { ANALYSIS_MESH_PRESETS, DEFAULT_ANALYSIS_MESH_CONFIGURATION, generateAnalysisMesh, isAnalysisMeshStale } from '../engineering/analysisGeometry';
import { useDesignStore } from '../state/useDesignStore';
import { Viewport } from './Viewport';

const surfaces: { id: AnalysisSurfaceId; label: string }[] = [{ id: 'wing', label: 'Main wing' }, { id: 'horizontal-tail', label: 'Horizontal tail' }, { id: 'vertical-tail', label: 'Vertical tail' }];

function sameConfiguration(first: AnalysisMeshConfiguration, second: AnalysisMeshConfiguration): boolean {
  return first.modelVersion === second.modelVersion
    && first.chordwisePanels === second.chordwisePanels
    && first.spanwisePanelsPerSection === second.spanwisePanelsPerSection
    && first.chordwiseSpacing === second.chordwiseSpacing
    && first.spanwiseSpacing === second.spanwiseSpacing
    && first.maximumPanelAspectRatio === second.maximumPanelAspectRatio
    && first.surfaceIds.length === second.surfaceIds.length
    && first.surfaceIds.every((id, index) => id === second.surfaceIds[index]);
}

export function AnalysisMeshWorkspace() {
  const design = useDesignStore((state) => state.design); const mesh = useDesignStore((state) => state.analysisMesh); const setMesh = useDesignStore((state) => state.setAnalysisMesh);
  const [configuration, setConfiguration] = useState<AnalysisMeshConfiguration>(() => structuredClone(mesh?.configuration ?? DEFAULT_ANALYSIS_MESH_CONFIGURATION));
  const [showNormals, setShowNormals] = useState(false); const [showCollocation, setShowCollocation] = useState(false); const [showVortices, setShowVortices] = useState(true);
  const stale = isAnalysisMeshStale(mesh, design) || (mesh !== undefined && !sameConfiguration(mesh.configuration, configuration));
  const panelCounts = useMemo(() => surfaces.map((surface) => ({ ...surface, count: mesh?.panels.filter((panel) => panel.parentSurfaceId === surface.id).length ?? 0 })), [mesh]);
  const generate = () => setMesh(generateAnalysisMesh(design, configuration));
  const toggleSurface = (id: AnalysisSurfaceId) => setConfiguration((current) => ({ ...current, surfaceIds: surfaces.map((surface) => surface.id).filter((surfaceId) => surfaceId === id ? !current.surfaceIds.includes(id) : current.surfaceIds.includes(surfaceId)) }));
  const setSpacing = (field: 'chordwiseSpacing' | 'spanwiseSpacing', value: AnalysisSpacing) => setConfiguration((current) => ({ ...current, [field]: value }));
  const applyPreset = (name: keyof typeof ANALYSIS_MESH_PRESETS) => setConfiguration((current) => ({ ...current, ...ANALYSIS_MESH_PRESETS[name] }));
  const issues = mesh ? [...mesh.validation.errors, ...mesh.validation.warnings] : [];

  return <div className="mesh-workspace">
    <div className="mesh-viewport">
      <Viewport analysisMesh={mesh} showPanelNormals={showNormals} showCollocationPoints={showCollocation} showBoundVortices={showVortices} />
      <div className="mesh-overlay-legend"><span><i className="wing" /> WING</span><span><i className="horizontal" /> HORIZONTAL</span><span><i className="vertical" /> VERTICAL</span></div>
    </div>
    <section className="mesh-panel">
      <div className="mesh-heading"><div><small>MODEL V1 · COMPUTATIONAL GEOMETRY</small><h2>Analysis mesh workspace</h2><p>Thin mean-camber surfaces are generated independently of render tessellation. No aerodynamic solution is calculated.</p></div><button className="mesh-generate" onClick={generate}><RefreshCw size={14} />{mesh ? 'Regenerate mesh' : 'Generate mesh'}</button></div>
      <div className="mesh-status-row">
        <div className={mesh ? stale ? 'mesh-status stale' : mesh.validation.valid ? 'mesh-status valid' : 'mesh-status invalid' : 'mesh-status empty'}><Activity size={14} /><span>{!mesh ? 'NOT GENERATED' : stale ? 'STALE · REGENERATE' : mesh.validation.valid ? 'CURRENT · VALID' : 'CURRENT · INVALID'}</span></div>
        <div><span>TOTAL PANELS</span><strong>{mesh?.panels.length ?? '—'}</strong></div>
        {panelCounts.map((surface) => <div key={surface.id}><span>{surface.label}</span><strong>{mesh ? surface.count : '—'}</strong></div>)}
        <div><span>QUALITY</span><strong>{mesh ? `${mesh.validation.errors.length} E / ${mesh.validation.warnings.length} W` : '—'}</strong></div>
      </div>
      <div className="mesh-controls">
        <fieldset><legend>Lifting surfaces</legend>{surfaces.map((surface) => <label key={surface.id}><input type="checkbox" checked={configuration.surfaceIds.includes(surface.id)} onChange={() => toggleSurface(surface.id)} />{surface.label}</label>)}</fieldset>
        <fieldset><legend>Resolution</legend><label>Chordwise panels<input aria-label="Chordwise panels" type="number" min="1" max="40" value={configuration.chordwisePanels} onChange={(event) => setConfiguration((current) => ({ ...current, chordwisePanels: Number(event.target.value) }))} /></label><label>Spanwise / section<input aria-label="Spanwise panels per section" type="number" min="1" max="80" value={configuration.spanwisePanelsPerSection} onChange={(event) => setConfiguration((current) => ({ ...current, spanwisePanelsPerSection: Number(event.target.value) }))} /></label><div className="mesh-presets">{(['coarse', 'medium', 'fine'] as const).map((preset) => <button key={preset} onClick={() => applyPreset(preset)}>{preset}</button>)}</div></fieldset>
        <fieldset><legend>Spacing</legend><label>Chordwise<select aria-label="Chordwise spacing" value={configuration.chordwiseSpacing} onChange={(event) => setSpacing('chordwiseSpacing', event.target.value as AnalysisSpacing)}><option value="uniform">Uniform</option><option value="cosine">Cosine</option></select></label><label>Spanwise<select aria-label="Spanwise spacing" value={configuration.spanwiseSpacing} onChange={(event) => setSpacing('spanwiseSpacing', event.target.value as AnalysisSpacing)}><option value="uniform">Uniform</option><option value="cosine">Cosine</option></select></label><label>Aspect-ratio warning<input aria-label="Maximum panel aspect ratio" type="number" min="1" step="1" value={configuration.maximumPanelAspectRatio} onChange={(event) => setConfiguration((current) => ({ ...current, maximumPanelAspectRatio: Number(event.target.value) }))} /></label></fieldset>
        <fieldset><legend>Visualization</legend><label><input type="checkbox" checked={showVortices} onChange={(event) => setShowVortices(event.target.checked)} />Bound vortices</label><label><input type="checkbox" checked={showCollocation} onChange={(event) => setShowCollocation(event.target.checked)} />Collocation points</label><label><input type="checkbox" checked={showNormals} onChange={(event) => setShowNormals(event.target.checked)} />Panel normals</label></fieldset>
      </div>
      {mesh && <div className="mesh-quality"><div className="mesh-quality-title"><Grid3X3 size={13} /><strong>Mesh quality</strong><span>{mesh.validation.valid ? 'Topology and orientation checks passed' : 'Errors prevent analysis use'}</span></div>{issues.length === 0 ? <p><CircleDot size={11} /> No mesh-quality warnings or errors.</p> : issues.map((issue, index) => <p className={issue.severity} key={`${issue.code}-${issue.panelId ?? issue.surfaceId ?? index}`}><CircleDot size={11} /><b>{issue.severity.toUpperCase()}</b>{issue.message}</p>)}</div>}
      <div className="mesh-limitation"><strong>NEUTRAL GEOMETRY ONLY</strong><span>Enabled control boundaries are preserved, but deflections are intentionally excluded. The fuselage is not a lifting surface. This milestone produces no circulation, forces, pressure, drag, stall, or CFD result.</span></div>
    </section>
  </div>;
}
