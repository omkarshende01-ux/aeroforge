/**
 * M5.7 benchmark inputs and independently evaluated reference values.
 *
 * These constants are deliberately kept outside the production geometry
 * modules. Decimal expected values were evaluated from the equations cited in
 * docs/GEOMETRY_BENCHMARKS.md, not by serializing AeroForge output.
 */
export const M5_7_GEOMETRY_BENCHMARKS = {
  rectangularWing: {
    spanM: 10,
    chordM: 2,
    expected: { areaM2: 20, aspectRatio: 5, macM: 2, quarterChordXM: 0.5 },
  },
  trapezoidalWing: {
    halfSpanM: 5,
    rootChordM: 4,
    tipChordM: 2,
    rootLeadingEdgeXM: 1,
    tipLeadingEdgeXM: 2.5,
    expected: {
      spanM: 10,
      areaM2: 30,
      aspectRatio: 3.3333333333333335,
      macM: 3.111111111111111,
      macSpanM: 2.2222222222222223,
      quarterChordXM: 2.4444444444444446,
    },
  },
  multiSectionWing: {
    spanStationsM: [0, 2, 5],
    chordsM: [4, 3, 1],
    leadingEdgesXM: [1, 1.4, 2.2],
    expected: { spanM: 10, areaM2: 26, aspectRatio: 3.8461538461538463, macM: 2.8974358974358974 },
  },
  asymmetricWing: {
    spanStationsM: [-3, 0, 5],
    chordsM: [1, 2, 1.5],
    expected: { spanM: 8, areaM2: 13.25, aspectRatio: 4.830188679245283, macM: 1.6918238993710693 },
  },
  nasaRectangularWing: {
    source: 'NASA NTRS 20220018375, slide 4',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20220018375',
    spanM: 3.048,
    chordM: 0.7141,
    publishedAreaM2: 2.1767,
    expectedProductAreaM2: 2.1765768,
    publishedLeadingEdgeCenterXM: 0.2588,
    publishedQuarterChordCenterXM: 0.4376,
  },
} as const;

