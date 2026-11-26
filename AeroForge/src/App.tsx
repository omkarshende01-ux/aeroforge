import { useState } from 'react';
import { Box, CircleGauge, ClipboardList, Layers3, Settings2, SlidersHorizontal } from 'lucide-react';
import { Viewport } from './components/Viewport';
import { Inspector } from './components/Inspector';
import { Metrics } from './components/Metrics';
import { AerodynamicsPanel } from './components/AerodynamicsPanel';
import { MultidisciplinaryPanel } from './components/MultidisciplinaryPanel';
import './styles.css';

const modules = [{ id: 'overview', name: 'Overview', icon: Layers3 }, { id: 'geometry', name: 'Geometry', icon: Box }, { id: 'aerodynamics', name: 'Aerodynamics', icon: CircleGauge }, { id: 'performance', name: 'Performance', icon: SlidersHorizontal }, { id: 'validation', name: 'Validation', icon: ClipboardList }] as const;
type ActiveModule = 'geometry' | 'aerodynamics' | 'performance';

export function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('performance');
  const title = activeModule === 'geometry' ? 'GEOMETRY EDITOR' : activeModule === 'aerodynamics' ? 'AERODYNAMIC ESTIMATES' : 'PRELIMINARY SIZING';
  return <main className="app-shell"><header><div className="brand"><div className="brand-mark">AF</div><div><b>AEROFORGE</b><span>Aircraft Engineering Studio</span></div></div><div className="project"><span>PROJECT</span><strong>AeroForge demonstrator</strong><small>LOCAL · UNSAVED</small></div><button className="icon-button"><Settings2 size={17} /></button></header><div className="workspace"><nav className="rail"><div className="rail-label">MODULES</div>{modules.map(({ id, name, icon: Icon }) => { const enabled = id === 'geometry' || id === 'aerodynamics' || id === 'performance'; return <button disabled={!enabled} onClick={() => enabled && setActiveModule(id)} className={activeModule === id ? 'rail-item active' : 'rail-item'} key={id}><Icon size={18} /><span>{name}</span>{!enabled && <small>SOON</small>}</button>; })}<div className="rail-foot">PHASE 3<br /><span>PRELIMINARY SIZING</span></div></nav><section className="center"><div className="subbar"><span><span className="dot" /> {title}</span><span className="units">UNITS: SI · ANGLES: DEG</span></div><Viewport />{activeModule === 'geometry' ? <Metrics /> : activeModule === 'aerodynamics' ? <AerodynamicsPanel /> : <MultidisciplinaryPanel />}</section><Inspector module={activeModule} /></div></main>;
}
