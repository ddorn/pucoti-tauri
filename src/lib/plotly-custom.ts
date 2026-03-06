// Custom Plotly bundle with only the trace types we need
// This reduces bundle size significantly compared to plotly.js-dist-min

import Plotly from 'plotly.js/lib/core'
import scatter from 'plotly.js/lib/scatter'
import violin from 'plotly.js/lib/violin'
import bar from 'plotly.js/lib/bar'

// Register only the trace types we use
Plotly.register([scatter, violin, bar])

export default Plotly
