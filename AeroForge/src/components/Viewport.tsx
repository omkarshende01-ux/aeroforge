import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls, OrthographicCamera } from '@react-three/drei';
import { useDesignStore } from '../state/useDesignStore';
import { fuselageGeometry, horizontalTailMesh, verticalTailMesh, wingMesh } from '../engineering/geometry';
import type { AircraftDesign } from '../domain/types';
import { physicalWingStations } from '../engineering/wingGeometry';

type StandardView = 'isometric' | 'top' | 'side' | 'front';

function sourceStationId(design: AircraftDesign, stationId: string): string { return design.wing.symmetry === 'symmetric' ? stationId.replace(/-mirrored$/, '') : stationId; }

function WingStationOverlay({ design, selectedStationId, onSelectStation, showDimensions }: { design: AircraftDesign; selectedStationId?: string; onSelectStation?: (stationId: string) => void; showDimensions: boolean }) {
  const stations = useMemo(() => physicalWingStations(design.wing), [design.wing]);
  return <>{stations.map((station) => {
    const sourceId = sourceStationId(design, station.id); const selected = sourceId === selectedStationId;
    const quarterChordXM = station.leadingEdgeXM + 0.25 * station.chordM;
    return <group key={station.id} position={[quarterChordXM, station.spanPositionM, station.verticalPositionM]} rotation={[0, station.geometricTwistDeg * Math.PI / 180, 0]}>
      <mesh position={[0.25 * station.chordM, 0, 0]} onClick={(event) => { event.stopPropagation(); onSelectStation?.(sourceId); }}>
        <boxGeometry args={[station.chordM, selected ? 0.075 : 0.045, selected ? 0.075 : 0.045]} />
        <meshStandardMaterial color={selected ? '#ffe08a' : '#67c7d4'} emissive={selected ? '#c9752f' : '#16414a'} emissiveIntensity={selected ? 1.1 : 0.55} depthTest={false} />
      </mesh>
      <mesh position={[-0.25 * station.chordM, 0, 0]} onClick={(event) => { event.stopPropagation(); onSelectStation?.(sourceId); }}>
        <sphereGeometry args={[selected ? 0.1 : 0.065, 14, 10]} /><meshBasicMaterial color={selected ? '#fff0b3' : '#84d9e3'} depthTest={false} />
      </mesh>
      {showDimensions && <Html position={[0, 0, 0.18]} center distanceFactor={12} style={{ pointerEvents: 'none' }}><span className={selected ? 'station-annotation selected' : 'station-annotation'}>{sourceId}<b>y {station.spanPositionM.toFixed(2)} m · c {station.chordM.toFixed(2)} m</b></span></Html>}
    </group>;
  })}</>;
}

function Aircraft({ design, selectedStationId, onSelectStation, showStationMarkers, showDimensions }: { design: AircraftDesign; selectedStationId?: string; onSelectStation?: (stationId: string) => void; showStationMarkers: boolean; showDimensions: boolean }) {
  const geometries = useMemo(() => ({ wing: wingMesh(design), fuselage: fuselageGeometry(design), horizontalTail: horizontalTailMesh(design), verticalTail: verticalTailMesh(design) }), [design]);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);
  return <>
    <mesh geometry={geometries.wing}><meshStandardMaterial color="#e35d3f" metalness={0.18} roughness={0.48} side={THREE.FrontSide} /></mesh>
    <mesh geometry={geometries.fuselage}><meshStandardMaterial color="#dce5ef" metalness={0.28} roughness={0.34} side={THREE.FrontSide} /></mesh>
    <mesh geometry={geometries.horizontalTail}><meshStandardMaterial color="#f28b4b" roughness={0.45} side={THREE.FrontSide} /></mesh>
    <mesh geometry={geometries.verticalTail}><meshStandardMaterial color="#f28b4b" roughness={0.45} side={THREE.FrontSide} /></mesh>
    {showStationMarkers && <WingStationOverlay design={design} selectedStationId={selectedStationId} onSelectStation={onSelectStation} showDimensions={showDimensions} />}
  </>;
}

function ViewController({ view, centerX }: { view: StandardView; centerX: number }) {
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera;
  const controls = useThree((state) => state.controls) as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    const settings: Record<StandardView, { position: [number, number, number]; up: [number, number, number]; zoom: number }> = {
      isometric: { position: [centerX - 10, -12, 8], up: [0, 0, 1], zoom: 28 },
      top: { position: [centerX, 0, 20], up: [0, 1, 0], zoom: 22 },
      side: { position: [centerX, -20, 1], up: [0, 0, 1], zoom: 35 },
      front: { position: [-16, 0, 0.5], up: [0, 0, 1], zoom: 34 },
    };
    const selected = settings[view]; camera.position.set(...selected.position); camera.up.set(...selected.up); camera.zoom = selected.zoom; camera.lookAt(centerX, 0, 0); camera.updateProjectionMatrix();
    if (controls) { controls.target.set(centerX, 0, 0); controls.update(); }
  }, [camera, centerX, controls, view]);
  return null;
}

export function Viewport({ designOverride, selectedStationId, onSelectStation, showStationMarkers = false, showDimensions = false }: { designOverride?: AircraftDesign; selectedStationId?: string; onSelectStation?: (stationId: string) => void; showStationMarkers?: boolean; showDimensions?: boolean } = {}) {
  const storedDesign = useDesignStore((state) => state.design);
  const design = designOverride ?? storedDesign;
  const [view, setView] = useState<StandardView>('isometric'); const centerX = design.fuselage.lengthM / 2;
  return <div className="viewport">
    <Canvas resize={{ scroll: false, debounce: { scroll: 0, resize: 80 } }} gl={{ antialias: true }}>
      <OrthographicCamera makeDefault position={[centerX - 10, -12, 8]} up={[0, 0, 1]} zoom={28} near={0.1} far={100} />
      <ViewController view={view} centerX={centerX} />
      <color attach="background" args={['#0d121a']} /><hemisphereLight args={['#d9e7f5', '#202833', 1.7]} /><directionalLight position={[-4, -6, 10]} intensity={2.6} />
      <Aircraft design={design} selectedStationId={selectedStationId} onSelectStation={onSelectStation} showStationMarkers={showStationMarkers} showDimensions={showDimensions} /><gridHelper args={[30, 30, '#405469', '#253343']} rotation={[Math.PI / 2, 0, 0]} position={[centerX, 0, -0.72]} /><axesHelper args={[1.2]} position={[0, 0, -0.7]} />
      <OrbitControls makeDefault target={[centerX, 0, 0]} enableDamping dampingFactor={0.08} screenSpacePanning />
    </Canvas>
    <div className="view-toolbar" aria-label="Standard aircraft views">{(['isometric', 'top', 'side', 'front'] as StandardView[]).map((name) => <button key={name} className={view === name ? 'active' : ''} onClick={() => setView(name)}>{name}</button>)}</div>
    <div className="axis-note">x aft · y starboard · z up</div>
  </div>;
}
