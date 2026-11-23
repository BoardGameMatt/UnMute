import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';

export const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let database;
let participantId = 'a';
const requestContext = new AsyncLocalStorage();
export const withRequestDatabase = (database, participantId, callback) => requestContext.run({ database, participantId }, callback);

export function useDatabase(next, actor = 'a') {
  database = next;
  participantId = actor;
}

export function currentDatabase() {
  if (requestContext.getStore()) return requestContext.getStore().database;
  if (!database) throw new Error('Reliability fixture did not supply a database');
  return database;
}

export function cookieStore() {
  return { get: (name) => name === 'unmute_participant_id' ? { value: requestContext.getStore()?.participantId ?? participantId } : undefined };
}

// Replace infrastructure boundaries only. The handlers, authorization helpers,
// stores, and engines are imported unchanged from application source.
const runtimeUrl = JSON.stringify(import.meta.url);
const stubs = new Map([
  ['server-only', 'export {};'],
  ['next/server', 'export const NextResponse = { json: (body, init) => Response.json(body, init) };'],
  ['next/headers', `export { cookieStore as cookies } from ${runtimeUrl};`],
  ['next/navigation', 'export const redirect = url => { throw new Error("NEXT_REDIRECT:" + url); };'],
  ['@/lib/supabase/server', `export { currentDatabase as createClient } from ${runtimeUrl};`],
  ['@/lib/supabase/admin', `export { currentDatabase as createServiceClient } from ${runtimeUrl};`],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (stubs.has(specifier)) return { url: `reliability:${specifier}`, shortCircuit: true };
    if (specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.startsWith('file:'))) {
      const base = specifier.startsWith('@/')
        ? resolve(appRoot, specifier.slice(2))
        : fileURLToPath(new URL(specifier, context.parentURL));
      for (const candidate of [base, `${base}.ts`, resolve(base, 'index.ts')]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('reliability:')) {
      const source = stubs.get(url.slice('reliability:'.length));
      if (source === undefined) throw new Error(`Unknown reliability stub: ${url}`);
      return { format: 'module', source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

// This runner must never fall through to a remote service.
globalThis.fetch = async () => { throw new Error('Network disabled in the local reliability harness'); };

export async function importApp(relativePath) {
  return import(pathToFileURL(resolve(appRoot, relativePath)).href);
}
