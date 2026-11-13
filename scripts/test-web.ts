import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import { tacticalDemo } from "../packages/fixtures/src/tactical-demo.ts";
import {
  layerConfigurationSource,
  listConfigurationFields,
  withFieldSources,
  type ConfigurationSource,
} from "../apps/web/lib/provenance.ts";
import {
  runBatchChunk,
  getLegalActions,
  resolveAction,
  startTacticalEncounter,
  type BatchPlan,
} from "../packages/engine/src/index.ts";

async function openPort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Puerto local no disponible");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

const realDatabase = process.env.TNL_TEST_DATABASE_URL;
const local = realDatabase ? null : await PGlite.create();
const socket = local
  ? new PGLiteSocketServer({
      db: local,
      port: await openPort(),
      maxConnections: 4,
    })
  : null;
await socket?.start();
const database =
  realDatabase ??
  "postgres://postgres@" + socket!.getServerConn() + "/postgres";
const sql = postgres(database, { max: 1 });
const port = await openPort();
const origin = "http://127.0.0.1:" + port;
const password = randomBytes(24).toString("hex");
const salt = randomBytes(16);
let app: ReturnType<typeof spawn> | undefined;
let serverLogs = "";
try {
  for (const filename of (await readdir("db/migrations")).sort()) {
    if (filename.endsWith(".sql"))
      await sql.unsafe(await readFile("db/migrations/" + filename, "utf8"));
  }
  await sql.end();
  app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "apps/web",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: database,
        APP_ORIGIN: origin,
        SESSION_SECRET: randomBytes(32).toString("hex"),
        SHARED_PASSWORD_HASH:
          "scrypt$" +
          salt.toString("hex") +
          "$" +
          scryptSync(password, salt, 64).toString("hex"),
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [app.stdout, app.stderr])
    stream?.on("data", (chunk) => {
      serverLogs = (serverLogs + String(chunk)).slice(-4000);
    });
  let ready = false;
  for (let attempt = 0; attempt < 80 && !ready; attempt++) {
    ready = await fetch(origin + "/login").then(
      (response) => response.ok,
      () => false,
    );
    if (!ready) await setTimeout(125);
  }
  assert.ok(ready, "Servidor de pruebas no disponible");
  const route = origin + "/api/records";
  assert.equal((await fetch(route + "?kind=scenario")).status, 401);
  assert.equal((await fetch(route, { method: "POST" })).status, 401);
  assert.equal((await fetch(origin + "/", { redirect: "manual" })).status, 307);
  async function login(alias: string) {
    const response = await fetch(origin + "/api/session", {
      method: "POST",
      redirect: "manual",
      headers: { Origin: origin },
      body: new URLSearchParams({ alias, password }),
    });
    assert.equal(response.status, 303);
    const header = response.headers.get("set-cookie");
    assert.ok(
      header?.includes("HttpOnly") &&
        header.includes("Secure") &&
        header.includes("SameSite=strict"),
    );
    return header!.split(";")[0]!;
  }
  const first = await login("Vigía");
  const second = await login("Cartógrafa");
  const scenario = tacticalDemo("integracion");
  function write(cookie: string, data: unknown, from = origin) {
    return fetch(route, {
      method: "POST",
      headers: {
        Origin: from,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }
  assert.equal((await write(first, {}, "http://127.0.0.1:1")).status, 403);
  const created = await write(first, {
    kind: "scenario",
    expected: 0,
    data: scenario,
  });
  assert.equal(created.status, 201, await created.clone().text());
  const { id } = (await created.json()) as { id: string };
  const update = (cookie: string, seed: string) =>
    write(cookie, {
      kind: "scenario",
      id,
      expected: 1,
      data: { ...scenario, seed },
    });
  const results = realDatabase
    ? await Promise.all([update(first, "primero"), update(second, "segundo")])
    : [await update(first, "primero"), await update(second, "segundo")];
  assert.deepEqual(
    results.map((response) => response.status).sort(),
    [200, 409],
  );
  const history = await fetch(route + "?kind=scenario&id=" + id, {
    headers: { Cookie: second },
  });
  assert.equal(history.status, 200);
  const versions = (await history.json()) as {
    revision: number;
    alias: string;
    data: unknown;
  }[];
  assert.deepEqual(
    versions.map((row) => row.revision),
    [2, 1],
  );
  assert.equal(versions[1]?.alias, "Vigía");
  const restored = await write(second, {
    kind: "scenario",
    id,
    expected: 2,
    data: versions[1]!.data,
  });
  assert.equal(restored.status, 200);
  const imported = await write(second, {
    kind: "scenario",
    expected: 0,
    data: scenario,
    origin: { id, revision: 1 },
  });
  assert.equal(imported.status, 201);
  assert.notEqual(((await imported.json()) as { id: string }).id, id);
  const sourceRun = randomUUID();
  const fixture = { ...scenario, roundLimit: 20 };
  const general = withFieldSources({ kind: "fixture" }, ["/roundLimit"], {
    kind: "general",
    id: randomUUID(),
    revision: 3,
  });
  const layered = layerConfigurationSource(
    general,
    { kind: "scenario", id, revision: 1 },
    fixture,
    scenario,
  );
  const variant = { ...scenario, light: "low" as const };
  const source = layerConfigurationSource(
    layered,
    { kind: "study", id: randomUUID(), revision: 2 },
    scenario,
    variant,
  );
  const initial = startTacticalEncounter(variant).state;
  const importedStudy = await write(first, {
    kind: "study",
    expected: 0,
    data: {
      schemaVersion: 1,
      name: "Estudio exportado",
      description: "",
      reference: "",
      tags: [],
      runs: [sourceRun],
      variants: [],
    },
    dependencies: [
      {
        id: sourceRun,
        revision: 2,
        data: { initial, state: initial, events: [], source },
      },
    ],
  });
  assert.equal(importedStudy.status, 201, await importedStudy.clone().text());
  const study = (await importedStudy.json()) as { data: { runs: string[] } };
  const newRun = study.data.runs[0];
  assert.notEqual(newRun, sourceRun);
  const storedRun = await fetch(route + "?kind=run&id=" + newRun, {
    headers: { Cookie: second },
  });
  const provenance = (await storedRun.json()) as {
    origin_id: string;
    origin_revision: number;
    data: { source: ConfigurationSource };
  }[];
  assert.deepEqual(
    provenance.map((run) => [run.origin_id, run.origin_revision]),
    [[sourceRun, 2]],
  );
  assert.deepEqual(provenance[0]?.data.source, source);
  const fields = new Map(
    listConfigurationFields(initial.setup, provenance[0]?.data.source).map(
      (field) => [field.path, field.source],
    ),
  );
  assert.equal(fields.get("/light")?.kind, "study");
  assert.equal(fields.get("/roundLimit")?.kind, "scenario");
  assert.equal(fields.get("/seed")?.kind, "fixture");
  const filtered = await fetch(
    route +
      "?kind=run&alias=Vig%C3%ADa&seed=integracion&weapon=daga&creature=acechador",
    { headers: { Cookie: second } },
  );
  assert.equal(filtered.status, 200, await filtered.clone().text());
  const matching = (await filtered.json()) as { id: string }[];
  assert.ok(matching.some((run) => run.id === newRun));
  const decision = initial.actors.flatMap(({ fighter }) =>
    getLegalActions(initial, fighter.id),
  )[0]!;
  const step = resolveAction(initial, decision);
  const appended = await write(first, {
    kind: "run",
    id: newRun,
    expected: 1,
    data: { initial, state: step.state, events: [step.event], source },
  });
  assert.equal(appended.status, 200, await appended.clone().text());
  const rewrite = await write(first, {
    kind: "run",
    id: newRun,
    expected: 2,
    data: { initial, state: initial, events: [] },
  });
  assert.equal(rewrite.status, 409);
  const checkpoints = origin + "/api/checkpoints";
  assert.equal((await fetch(checkpoints)).status, 401);
  const plan: BatchPlan = {
    setup: { ...scenario, roundLimit: 1 },
    requested: 3,
    encounterLimit: 1,
    mode: "encounter",
    capture: [0],
    profiles: {},
  };
  const job = randomUUID();
  const firstChunk = runBatchChunk(plan, 0, 1);
  const submit = (chunk: ReturnType<typeof runBatchChunk>, canceled = false) =>
    fetch(checkpoints, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: first,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ job, plan, chunk, canceled }),
    });
  const firstCheckpoint = await submit(firstChunk);
  assert.equal(
    firstCheckpoint.status,
    200,
    await firstCheckpoint.clone().text(),
  );
  assert.deepEqual(await firstCheckpoint.json(), {
    confirmed: 1,
    status: "running",
  });
  assert.deepEqual(await (await submit(firstChunk)).json(), {
    confirmed: 1,
    status: "running",
  });
  assert.equal((await submit(runBatchChunk(plan, 2, 3))).status, 409);
  assert.deepEqual(
    await (await submit(runBatchChunk(plan, 1, 2), true)).json(),
    { confirmed: 2, status: "canceled" },
  );
  const checkpointsPage = await fetch(checkpoints + "?job=" + job, {
    headers: { Cookie: second },
  });
  assert.equal(checkpointsPage.status, 200);
  const savedBatch = (await checkpointsPage.json()) as {
    record: { next_index: number };
    chunks: unknown[];
  };
  assert.equal(savedBatch.record.next_index, 2);
  assert.equal(savedBatch.chunks.length, 2);
  const logout = await fetch(origin + "/api/session", {
    method: "DELETE",
    headers: { Origin: origin, Cookie: second },
  });
  assert.equal(logout.status, 204);
  assert.ok(logout.headers.get("set-cookie")?.includes("Max-Age=0"));
  console.log(
    "Sesiones, CSRF, conflicto, restauración, importación de estudios y checkpoints verificados.",
  );
} catch (error) {
  if (serverLogs) console.error(serverLogs);
  throw error;
} finally {
  if (app && app.exitCode === null) {
    const stopped = new Promise((resolve) => app?.once("exit", resolve));
    app.kill();
    await stopped;
  }
  await sql.end({ timeout: 1 });
  await socket?.stop();
  await local?.close();
}
