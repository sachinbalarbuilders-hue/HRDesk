// CJS bootstrap: node-windows requires CommonJS entry point
import('./index.mjs').catch(err => { console.error('[Service] Fatal startup error:', err); process.exit(1); });
