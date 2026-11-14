// Web Worker entry: runs the engine off the main thread. All logic is in protocol.ts.

import { handleMessage, newWorkerState, type FromWorker, type ToWorker } from './protocol'

// Minimal typing of the worker global (the app's tsconfig has the DOM lib, not WebWorker).
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null
  postMessage: (m: FromWorker) => void
}

const state = newWorkerState()
ctx.onmessage = e => handleMessage(state, e.data, m => ctx.postMessage(m))
