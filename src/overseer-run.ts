// overseer-run.ts — cron entrypoint. Railway cron (or any scheduler) runs this.
//   node dist/overseer-run.js              → daily anecdotes, all active users
//   node dist/overseer-run.js weekly       → daily + weekly letters, all active users
//   node dist/overseer-run.js --user=<id>  → run for ONE user id (dev/testing)
//   node dist/overseer-run.js weekly --user=<id>
import { runOverseer } from './overseer.js';
const userArg = process.argv.find((a) => a.startsWith('--user='));
const onlyUser = userArg ? userArg.slice('--user='.length) : undefined;
runOverseer({ weekly: process.argv.includes('weekly'), onlyUser })
  .then((r) => { console.log('[overseer-run]', r); process.exit(0); })
  .catch((e) => { console.error('[overseer-run] failed', e); process.exit(1); });
