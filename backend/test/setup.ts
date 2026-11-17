import { applyTestEnv } from './env.js';

applyTestEnv();

// Same patch as src/main.ts: period budgets are BigInt, which JSON cannot serialize by default.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};
