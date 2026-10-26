// Usage: node call-async-api-poll-only.js [name] [dbg-delay-sec]

import { setTimeout as sleep } from "timers/promises";

const API = "https://demo.ready-bell.com/hello-async";
const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 60000;

const [name = "Alice", delaySec = "4"] = process.argv.slice(2);
const started = performance.now();
const result = await callAsyncApi(name, Number(delaySec));
console.log(result);
console.log(`callAsyncApi took ${((performance.now() - started) / 1000).toFixed(3)} s`);

async function callAsyncApi(name, delaySec) {
  const uuid = crypto.randomUUID();
  const deadline = Date.now() + TIMEOUT_MS;

  await submitAsyncJob(uuid, name, delaySec);
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const job = await fetchFinishedJob(uuid).catch(err => console.log(err.message));
    if (job) return job;
  }
  throw new Error(`Timed out after ${TIMEOUT_MS} ms`);
}

function submitAsyncJob(uuid, name, debugDelay) {
  return fetch(`${API}/${uuid}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: { name, "dbg-delay-sec": debugDelay } }),
  }).then(res => {
    if (!res.ok) throw new Error(`POST failed: HTTP ${res.status}`);
  });
}

function fetchFinishedJob(uuid) {
  return fetch(`${API}/${uuid}`).then(res =>
    res.ok ? res.json() : Promise.reject(new Error(`GET failed: HTTP ${res.status}`))
  ).then(job =>
    job.status === "IN_PROGRESS" ? Promise.reject(new Error("Job IN_PROGRESS")) : job
  );
}
