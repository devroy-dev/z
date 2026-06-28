// overseer-run.ts — cron entrypoint. Railway cron (or any scheduler) runs this.
import { runOverseer } from './overseer.js';
runOverseer({ weekly: process.argv.includes('weekly') })
  .then((r) => { console.log('[overseer-run]', r); process.exit(0); })
  .catch((e) => { console.error('[overseer-run] failed', e); process.exit(1); });
