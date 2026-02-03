// Custom Plotly bundle with only the trace types we need
// This reduces bundle size significantly compared to plotly.js-dist-min

import Plotly from 'plotly.js/lib/core'
import scatter from 'plotly.js/lib/scatter'
import violin from 'plotly.js/lib/violin'

// Register only the trace types we use
Plotly.register([scatter, violin])

export default Plotly
