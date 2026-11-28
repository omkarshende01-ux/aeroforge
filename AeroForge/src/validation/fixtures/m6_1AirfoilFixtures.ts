/**
 * M6.1 parser fixtures authored for AeroForge and released with the project.
 * They are synthetic symmetric profiles/polars, not measured aerodynamic data
 * and do not assert correspondence to any named real airfoil.
 */
export const seligDat = `AeroForge synthetic Selig fixture
1.0 0.010
0.75 0.055
0.50 0.080
0.25 0.060
0.0 0.0
0.25 -0.060
0.50 -0.080
0.75 -0.055
1.0 -0.010`;

export const lednicerDat = `AeroForge synthetic Lednicer fixture
5 5

0.0 0.0
0.25 0.060
0.50 0.080
0.75 0.055
1.0 0.010

0.0 0.0
0.25 -0.060
0.50 -0.080
0.75 -0.055
1.0 -0.010`;

export const coordinateCsv = `surface,x_over_chord,z_over_chord
upper,0,0
upper,0.25,0.06
upper,0.5,0.08
upper,0.75,0.055
upper,1,0.01
lower,0,0
lower,0.25,-0.06
lower,0.5,-0.08
lower,0.75,-0.055
lower,1,-0.01`;

export const polarCsv = `alpha_deg,reynolds,mach,cl,cd,cm,converged,transition_upper_x_over_chord,transition_lower_x_over_chord
-2,1000000,0.10,-0.20,0.018,,true,0.75,0.65
0,1000000,0.10,0.02,0.012,-0.04,true,0.70,0.60
2,1000000,0.10,0.24,0.014,-0.041,false,,
-2,2000000,0.10,-0.18,0.015,-0.038,true,0.80,0.70
0,2000000,0.10,0.03,0.010,-0.04,true,0.76,0.66`;

export const xfoilPolar = ` XFOIL Version 6.99
 Calculated polar for: synthetic fixture
 Mach = 0.050     Re = 1.500 e 6     Ncrit = 9.000

 alpha    CL        CD       CDp       CM     Top_Xtr  Bot_Xtr
 ------ -------- --------- --------- -------- -------- --------
 -2.000  -0.1800   0.01620   0.01000  -0.0380   0.7600   0.6800
  0.000   0.0300   0.01030   0.00600  -0.0400   0.7200   0.6400
  2.000   0.2500   0.01280   0.00750  -0.0410   0.6700   0.5900`;
