// Type declarations for custom Plotly bundle
// The actual bundle is in src/lib/plotly-custom.ts

declare module 'plotly.js/lib/core' {
  import * as Plotly from 'plotly.js'
  export = Plotly
}

declare module 'plotly.js/lib/scatter' {
  const scatter: any
  export = scatter
}

declare module 'plotly.js/lib/violin' {
  const violin: any
  export = violin
}
