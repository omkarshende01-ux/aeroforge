import { useMemo, useState } from 'react';
import { Copy, Eye, EyeOff, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { calculateWingReferenceProperties } from '../engineering/wingGeometry';
import {
  addOutboardWingStation,
  changeWingSymmetry,
  duplicateWingStation,
  editWingSection,
  editWingSectionSweep,
  editWingStation,
  insertWingStationAfter,
  removeWingStation,
  sectionSweepDeg,
  type WingEditResult,
} from '../engineering/wingEditor';
import { useDesignStore } from '../state/useDesignStore';
import { Viewport } from './Viewport';

const airfoilOptions = ['NACA 0012', 'NACA 2412', 'NACA 4412'];

function numberValue(value: string): number { return value === '' ? Number.NaN : Number(value); }

export function WingGeometryWorkspace() {
  const design = useDesignStore((state) => state.design);
  const historyCount = useDesignStore((state) => state.wingHistory.length);
  const selectedStationId = useDesignStore((state) => state.selectedWingStationId) ?? design.wing.stations[0].id;
  const selectStation = useDesignStore((state) => state.selectWingStation);
  const commitWing = useDesignStore((state) => state.commitWingGeometry);
  const undoWing = useDesignStore((state) => state.undoWingGeometry);
  const resetWing = useDesignStore((state) => state.resetWingGeometry);
  const [showDimensions, setShowDimensions] = useState(false);
  const [showCrossSections, setShowCrossSections] = useState(false);
  const [showGeometryGuides, setShowGeometryGuides] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const wing = design.wing;
  const properties = useMemo(() => calculateWingReferenceProperties(wing), [wing]);
  const selectedIndex = wing.stations.findIndex((station) => station.id === selectedStationId);

  const apply = (result: WingEditResult) => {
    if (!result.wing) { setErrors(result.errors); return; }
    const commitErrors = commitWing(result.wing, result.selectedStationId);
    setErrors(commitErrors);
  };

  const editNumber = (stationId: string, field: 'spanPositionM' | 'chordM' | 'leadingEdgeXM' | 'geometricTwistDeg', value: string) => apply(editWingStation(wing, stationId, { [field]: numberValue(value) }));
  const limitation = wing.symmetry === 'asymmetric'
    ? 'Existing aerodynamics and beam analyses use total reference geometry and an idealized symmetric elliptical load; they do not resolve asymmetric aerodynamic or structural loads.'
    : wing.stations.length > 2
      ? 'Existing finite-wing aerodynamics and beam loading use aggregate reference properties; twist, section airfoils, sweep breaks and local planform changes do not yet alter the analytical load model.'
      : 'The loft and reference metrics follow these stations. Aerodynamic coefficients and CLmax remain supplied assumptions.';

  return <div className="wing-editor-workspace">
    <div className="wing-editor-viewport">
      <Viewport selectedStationId={selectedStationId} onSelectStation={selectStation} showStationMarkers showDimensions={showDimensions} showCrossSections={showCrossSections} showGeometryGuides={showGeometryGuides} />
      <div className="geometry-display-controls">
        <button onClick={() => setShowCrossSections((current) => !current)}>{showCrossSections ? <EyeOff size={13} /> : <Eye size={13} />}{showCrossSections ? 'Hide sections' : 'Show sections'}</button>
        <button onClick={() => setShowGeometryGuides((current) => !current)}>{showGeometryGuides ? <EyeOff size={13} /> : <Eye size={13} />}{showGeometryGuides ? 'Hide guides' : 'Show guides'}</button>
        <button onClick={() => setShowDimensions((current) => !current)}>{showDimensions ? <EyeOff size={13} /> : <Eye size={13} />}{showDimensions ? 'Hide dimensions' : 'Show dimensions'}</button>
      </div>
    </div>
    <section className="wing-editor-panel">
      <div className="wing-editor-heading">
        <div><small>SCHEMA V2 · AUTHORITATIVE GEOMETRY</small><h2>Wing section editor</h2><p>Stations are ordered in metres along aircraft y. Leading-edge x is measured aft from the nose; twist and dihedral are degrees.</p></div>
        <div className="wing-editor-actions">
          <div className="symmetry-control" aria-label="Wing symmetry"><button className={wing.symmetry === 'symmetric' ? 'active' : ''} onClick={() => apply(changeWingSymmetry(wing, 'symmetric'))}>SYMMETRIC</button><button className={wing.symmetry === 'asymmetric' ? 'active' : ''} onClick={() => apply(changeWingSymmetry(wing, 'asymmetric'))}>ASYMMETRIC</button></div>
          <button disabled={historyCount === 0} onClick={() => { undoWing(); setErrors([]); }}><Undo2 size={13} /> Undo</button>
          <button onClick={() => { resetWing(); setErrors([]); }}><RotateCcw size={13} /> Reset</button>
        </div>
      </div>
      <div className="wing-reference-strip">
        <div><span>SPAN</span><strong>{properties.totalSpanM.toFixed(2)} m</strong></div>
        <div><span>PROJECTED AREA</span><strong>{properties.projectedAreaM2.toFixed(2)} m²</strong></div>
        <div><span>ASPECT RATIO</span><strong>{properties.aspectRatio.toFixed(3)}</strong></div>
        <div><span>MAC</span><strong>{properties.meanAerodynamicChordM.toFixed(3)} m</strong></div>
        <div><span>LE MAC X</span><strong>{properties.meanAerodynamicChordLeadingEdgeXM.toFixed(3)} m</strong></div>
        <div><span>¼-CHORD X / Y</span><strong>{properties.meanAerodynamicChordQuarterChordXM.toFixed(3)} / {properties.meanAerodynamicChordSpanPositionM.toFixed(3)} m</strong></div>
      </div>
      {errors.length > 0 && <div className="wing-editor-errors" role="alert"><strong>Geometry change rejected</strong>{errors.map((error) => <span key={error}>{error}</span>)}</div>}
      <div className="station-toolbar">
        <button onClick={() => apply(addOutboardWingStation(wing))}><Plus size={12} /> Add outboard</button>
        <button disabled={selectedIndex < 0 || selectedIndex === wing.stations.length - 1} onClick={() => apply(insertWingStationAfter(wing, selectedStationId))}><Plus size={12} /> Insert after</button>
        <button disabled={selectedIndex < 0} onClick={() => apply(duplicateWingStation(wing, selectedStationId))}><Copy size={12} /> Duplicate</button>
        <button className="danger" disabled={selectedIndex < 0} onClick={() => apply(removeWingStation(wing, selectedStationId))}><Trash2 size={12} /> Remove</button>
        <span>{wing.stations.length} source stations · {properties.sections.length} physical sections</span>
      </div>
      <div className="station-table-wrap">
        <table className="station-table">
          <thead><tr><th>STATION</th><th>Y POSITION <i>m</i></th><th>CHORD <i>m</i></th><th>LE X <i>m</i></th><th>LE SWEEP <i>deg</i></th><th>TWIST <i>deg</i></th><th>DIHEDRAL <i>deg</i></th><th>AIRFOIL</th></tr></thead>
          <tbody>{wing.stations.map((station, index) => {
            const section = wing.sections[index]; const isRoot = Math.abs(station.spanPositionM) <= 1e-9;
            return <tr key={station.id} className={station.id === selectedStationId ? 'selected' : ''} onClick={() => selectStation(station.id)}>
              <td><button className="station-select" onClick={() => selectStation(station.id)}><span>{index + 1}</span><b>{station.id}</b>{isRoot && <em>ROOT</em>}</button></td>
              <td><input aria-label={`${station.id} span position`} type="number" step="0.1" value={Number(station.spanPositionM.toFixed(6))} disabled={isRoot} onChange={(event) => editNumber(station.id, 'spanPositionM', event.target.value)} /></td>
              <td><input aria-label={`${station.id} chord`} type="number" min="0.001" step="0.05" value={Number(station.chordM.toFixed(6))} onChange={(event) => editNumber(station.id, 'chordM', event.target.value)} /></td>
              <td><input aria-label={`${station.id} leading edge x`} type="number" step="0.05" value={Number(station.leadingEdgeXM.toFixed(6))} onChange={(event) => editNumber(station.id, 'leadingEdgeXM', event.target.value)} /></td>
              <td>{section ? <input aria-label={`${section.id} leading edge sweep`} type="number" step="0.5" value={Number(sectionSweepDeg(wing, index).toFixed(6))} onChange={(event) => apply(editWingSectionSweep(wing, section.id, numberValue(event.target.value)))} /> : <span className="not-applicable">TIP</span>}</td>
              <td><input aria-label={`${station.id} geometric twist`} type="number" step="0.25" value={station.geometricTwistDeg} onChange={(event) => editNumber(station.id, 'geometricTwistDeg', event.target.value)} /></td>
              <td>{section ? <input aria-label={`${section.id} dihedral`} type="number" step="0.25" value={section.dihedralDeg} onChange={(event) => apply(editWingSection(wing, section.id, { dihedralDeg: numberValue(event.target.value) }))} /> : <span className="not-applicable">TIP</span>}</td>
              <td><select aria-label={`${station.id} airfoil`} value={station.airfoilId} onChange={(event) => apply(editWingStation(wing, station.id, { airfoilId: event.target.value }))}>{!airfoilOptions.includes(station.airfoilId) && <option value={station.airfoilId}>{station.airfoilId}</option>}{airfoilOptions.map((airfoil) => <option key={airfoil} value={airfoil}>{airfoil}</option>)}</select></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="wing-editor-limitation"><strong>ANALYSIS LIMITATION</strong><span>{limitation}</span></div>
    </section>
  </div>;
}
