import { useState } from 'react';
import { Box, Calculator, CircleGauge, ClipboardList, Grid3X3, Layers3, Route, Settings2, SlidersHorizontal, TrendingUp, Wind } from 'lucide-react';
import { Viewport } from './components/Viewport';
import { Inspector } from './components/Inspector';
import { AerodynamicsPanel } from './components/AerodynamicsPanel';
import { MultidisciplinaryPanel } from './components/MultidisciplinaryPanel';
import { MissionInspector } from './components/MissionInspector';
import { MissionWorkspace } from './components/MissionWorkspace';
import { ConstraintAnalysisWorkspace } from './components/ConstraintAnalysisWorkspace';
import { PreliminarySizingWorkspace } from './components/PreliminarySizingWorkspace';
import { WingGeometryWorkspace } from './components/WingGeometryWorkspace';
import { AnalysisMeshWorkspace } from './components/AnalysisMeshWorkspace';
import { AirfoilLibraryWorkspace } from './components/AirfoilLibraryWorkspace';
import './styles.css';

const modules = [{ id: 'overview', name: 'Overview', icon: Layers3 }, { id: 'mission', name: 'Mission', icon: Route }, { id: 'constraints', name: 'Constraints', icon: TrendingUp }, { id: 'sizing', name: 'Sizing', icon: Calculator }, { id: 'geometry', name: 'Geometry', icon: Box }, { id: 'airfoils', name: 'Airfoils', icon: Wind }, { id: 'mesh', name: 'Analysis mesh', icon: Grid3X3 }, { id: 'aerodynamics', name: 'Aerodynamics', icon: CircleGauge }, { id: 'performance', name: 'Performance', icon: SlidersHorizontal }, { id: 'validation', name: 'Validation', icon: ClipboardList }] as const;
type ActiveModule = 'mission' | 'constraints' | 'sizing' | 'geometry' | 'airfoils' | 'mesh' | 'aerodynamics' | 'performance';

export function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('mission');
  const title = activeModule === 'mission' ? 'MISSION REQUIREMENTS & FEASIBILITY' : activeModule === 'constraints' ? 'AIRCRAFT CONSTRAINT ANALYSIS' : activeModule === 'sizing' ? 'ITERATIVE PRELIMINARY AIRCRAFT SIZING' : activeModule === 'geometry' ? 'GEOMETRY EDITOR' : activeModule === 'airfoils' ? 'AIRFOIL DATA LIBRARY' : activeModule === 'mesh' ? 'ANALYSIS-READY GEOMETRY' : activeModule === 'aerodynamics' ? 'AERODYNAMIC ESTIMATES' : 'PRELIMINARY PERFORMANCE';
  return <main className="app-shell"><header><div className="brand"><div className="brand-mark">AF</div><div><b>AEROFORGE</b><span>Aircraft Engineering Studio</span></div></div><div className="project"><span>PROJECT</span><strong>AeroForge demonstrator</strong><small>LOCAL · UNSAVED</small></div><button className="icon-button"><Settings2 size={17} /></button></header><div className="workspace"><nav className="rail"><div className="rail-label">MODULES</div>{modules.map(({ id, name, icon: Icon }) => { const enabled = id === 'mission' || id === 'constraints' || id === 'sizing' || id === 'geometry' || id === 'airfoils' || id === 'mesh' || id === 'aerodynamics' || id === 'performance'; return <button disabled={!enabled} onClick={() => enabled && setActiveModule(id)} className={activeModule === id ? 'rail-item active' : 'rail-item'} key={id}><Icon size={18} /><span>{name}</span>{!enabled && <small>SOON</small>}</button>; })}<div className="rail-foot">M6.1<br /><span>AIRFOIL DATA</span></div></nav><section className="center"><div className="subbar"><span><span className="dot" /> {title}</span><span className="units">INTERNAL: SI · DISPLAY: SELECTABLE</span></div>{activeModule === 'mission' ? <MissionWorkspace /> : activeModule === 'constraints' ? <ConstraintAnalysisWorkspace /> : activeModule === 'sizing' ? <PreliminarySizingWorkspace /> : activeModule === 'geometry' ? <WingGeometryWorkspace /> : activeModule === 'airfoils' ? <AirfoilLibraryWorkspace /> : activeModule === 'mesh' ? <AnalysisMeshWorkspace /> : <><Viewport />{activeModule === 'aerodynamics' ? <AerodynamicsPanel /> : <MultidisciplinaryPanel />}</>}</section>{activeModule === 'mission' || activeModule === 'constraints' ? <MissionInspector /> : activeModule !== 'sizing' && activeModule !== 'geometry' && activeModule !== 'airfoils' && activeModule !== 'mesh' ? <Inspector module={activeModule} /> : null}</div></main>;
}
