import { useDesignStore } from '../state/useDesignStore';
import { legacyWingView } from '../engineering/wingGeometry';

type FieldProps = { label: string; path: string; value: number; unit: string; step?: number; scale?: number };
function Field({ label, path, value, unit, step = 0.1, scale = 1 }: FieldProps) {
  const update = useDesignStore((state) => state.update);
  return <label className="field"><span>{label}<em>{unit}</em></span><input type="number" step={step} value={value} onChange={(event) => update(path, Number(event.target.value) * scale)} /></label>;
}

export function Inspector({ module }: { module: 'geometry' | 'aerodynamics' | 'performance' }) {
  const design = useDesignStore((state) => state.design);
  const update = useDesignStore((state) => state.update);
  const fc = design.flightCondition;
  const wing = legacyWingView(design.wing);
  return <aside className="inspector">
    <div className="panel-title"><span>PARAMETERS</span><span className="live">● LIVE</span></div>
    {module === 'performance' ? <>
      <section><h3>Mission & propulsion</h3>
        <Field label="Takeoff mass" path="massKg" value={design.massKg} unit="kg" step={10} />
        <Field label="Required range" path="mission.requiredRangeM" value={design.mission.requiredRangeM / 1000} unit="km" step={10} scale={1000} />
        <Field label="Minimum climb" path="mission.minimumClimbRateMs" value={design.mission.minimumClimbRateMs} unit="m/s" step={0.1} />
        <Field label="Max operating speed" path="mission.maxOperatingSpeedMs" value={design.mission.maxOperatingSpeedMs} unit="m/s" step={1} />
        <Field label="Shaft power" path="propulsion.shaftPowerW" value={design.propulsion.shaftPowerW / 1000} unit="kW" step={5} scale={1000} />
        <Field label="Propulsive efficiency" path="propulsion.propulsiveEfficiency" value={design.propulsion.propulsiveEfficiency} unit="—" step={0.01} />
        <Field label="Usable shaft energy" path="propulsion.usableShaftEnergyJ" value={design.propulsion.usableShaftEnergyJ / 3.6e6} unit="kWh" step={10} scale={3.6e6} />
        <Field label="Energy reserve" path="propulsion.reserveFraction" value={design.propulsion.reserveFraction} unit="fraction" step={0.05} />
      </section>
      <section><h3>Component mass / station</h3>
        <Field label="Airframe mass" path="massModel.airframeMassKg" value={design.massModel.airframeMassKg} unit="kg" step={10} /><Field label="Airframe x" path="massModel.airframeXM" value={design.massModel.airframeXM} unit="m" />
        <Field label="Propulsion mass" path="massModel.propulsionMassKg" value={design.massModel.propulsionMassKg} unit="kg" step={10} /><Field label="Propulsion x" path="massModel.propulsionXM" value={design.massModel.propulsionXM} unit="m" />
        <Field label="Energy mass" path="massModel.energyMassKg" value={design.massModel.energyMassKg} unit="kg" step={10} /><Field label="Energy x" path="massModel.energyXM" value={design.massModel.energyXM} unit="m" />
        <Field label="Payload mass" path="massModel.payloadMassKg" value={design.massModel.payloadMassKg} unit="kg" step={10} /><Field label="Payload x" path="massModel.payloadXM" value={design.massModel.payloadXM} unit="m" />
      </section>
      <section><h3>Stability assumptions</h3>
        <Field label="Tail lift slope" path="stability.tailLiftSlopePerRad" value={design.stability.tailLiftSlopePerRad} unit="1/rad" step={0.1} /><Field label="Tail efficiency" path="stability.tailEfficiency" value={design.stability.tailEfficiency} unit="—" step={0.05} /><Field label="Downwash gradient" path="stability.downwashGradient" value={design.stability.downwashGradient} unit="—" step={0.05} />
      </section>
      <section><h3>Wing beam assumptions</h3>
        <Field label="Positive load limit" path="structure.loadFactor" value={design.structure.loadFactor} unit="g" step={0.1} /><Field label="Negative load limit" path="structure.negativeLoadFactor" value={design.structure.negativeLoadFactor} unit="g" step={0.1} /><Field label="Negative CL limit" path="flightCondition.clMin" value={design.flightCondition.clMin} unit="—" step={0.1} /><Field label="Elastic modulus" path="structure.elasticModulusPa" value={design.structure.elasticModulusPa / 1e9} unit="GPa" step={1} scale={1e9} /><Field label="Second moment" path="structure.secondMomentM4" value={design.structure.secondMomentM4} unit="m⁴" step={0.0001} /><Field label="Outer fiber" path="structure.outerFiberM" value={design.structure.outerFiberM} unit="m" step={0.01} /><Field label="Allowable stress" path="structure.allowableStressPa" value={design.structure.allowableStressPa / 1e6} unit="MPa" step={10} scale={1e6} />
      </section>
      <div className="input-note">Mass stations use x measured aft from the nose. Wing and tail aerodynamic-center stations are derived from the same rendered planforms. Material and propulsion values are supplied assumptions.</div>
    </> : module === 'aerodynamics' ? <>
      <section><h3>Atmosphere & state</h3>
        <label className="field"><span>Density source<em>model</em></span><select value={fc.densitySource} onChange={(event) => update('flightCondition.densitySource', event.target.value)}><option value="isa">ISA troposphere</option><option value="manual">Manual density</option></select></label>
        <Field label="Altitude" path="flightCondition.altitudeM" value={fc.altitudeM} unit="m" step={100} />
        {fc.densitySource === 'manual' && <Field label="Air density" path="flightCondition.densityKgM3" value={fc.densityKgM3} unit="kg/m³" step={0.001} />}
        <Field label="True airspeed" path="flightCondition.speedMs" value={fc.speedMs} unit="m/s" step={1} />
        <Field label="Angle of attack" path="flightCondition.angleOfAttackDeg" value={fc.angleOfAttackDeg} unit="deg" step={0.5} />
      </section>
      <section><h3>Supplied model inputs</h3>
        <Field label="Zero-lift angle" path="flightCondition.zeroLiftAngleDeg" value={fc.zeroLiftAngleDeg} unit="deg" step={0.5} />
        <Field label="Section lift slope" path="flightCondition.sectionLiftSlopePerRad" value={fc.sectionLiftSlopePerRad} unit="1/rad" step={0.1} />
        <Field label="Parasite drag CD0" path="flightCondition.cd0" value={fc.cd0} unit="—" step={0.001} />
        <Field label="Oswald efficiency" path="flightCondition.oswaldEfficiency" value={fc.oswaldEfficiency} unit="—" step={0.05} />
        <Field label="CL max limit" path="flightCondition.clMax" value={fc.clMax} unit="—" step={0.1} />
      </section>
      <div className="input-note">CD0, efficiency, section slope, zero-lift angle, and CLmax are user-supplied assumptions. AeroForge does not infer them from the mesh.</div>
    </> : <>
      <section><h3>Mass & condition</h3><Field label="Takeoff mass" path="massKg" value={design.massKg} unit="kg" step={10} /><Field label="CL max" path="flightCondition.clMax" value={fc.clMax} unit="—" step={0.1} /></section>
      <section><h3>Wing planform & station</h3><Field label="Span" path="wing.spanM" value={wing.spanM} unit="m" /><Field label="Root chord" path="wing.rootChordM" value={wing.rootChordM} unit="m" /><Field label="Taper ratio" path="wing.taperRatio" value={wing.taperRatio} unit="—" step={0.05} /><Field label="Sweep" path="wing.sweepDeg" value={wing.sweepDeg} unit="deg" /><Field label="Dihedral" path="wing.dihedralDeg" value={wing.dihedralDeg} unit="deg" /><Field label="Tip twist" path="wing.twistDeg" value={wing.twistDeg} unit="deg" /><Field label="Root leading edge x" path="wing.rootLeadingEdgeXM" value={wing.rootLeadingEdgeXM} unit="m" /><Field label="Vertical position" path="wing.verticalPositionM" value={wing.verticalPositionM} unit="m" /></section>
      <section><h3>Fuselage & empennage</h3><div className="input-note">Versioned fuselage and tail stations are edited in the dedicated Geometry workspace. Their meshes and reference properties no longer use scalar compatibility inputs.</div></section>
    </>}
  </aside>;
}
