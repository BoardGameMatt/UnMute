import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer } from 'node:net';
import { appRoot } from './runtime.mjs';

const identifier = (value) => {
  if (!/^[a-z_][a-z_0-9]*$/i.test(value)) throw new Error(`Unsupported SQL identifier: ${value}`);
  return `"${value}"`;
};

/** SQL transport for actual application queries. No protocol/RPC behavior is mocked. */
export class PostgresDatabase {
  constructor(pool, hooks = {}) { this.pool = pool; this.hooks = hooks; }
  from(table) { return new SqlQuery(this.pool, table, this.hooks); }
  async rpc(name, args = {}) {
    try {
      await this.hooks.beforeRpc?.(name, args);
      const keys = Object.keys(args);
      const params = keys.map((key, index) => `${identifier(key)} => $${index + 1}`).join(', ');
      const values = keys.map((key) => args[key] !== null && typeof args[key] === 'object' ? JSON.stringify(args[key]) : args[key]);
      const result = await this.pool.query(`SELECT public.${identifier(name)}(${params}) AS result`, values);
      const response = { data: result.rows[0].result, error: null };
      await this.hooks.afterRpc?.(name, args, response);
      return response;
    } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
  }
}

class SqlQuery {
  constructor(pool, table, hooks) {
    this.pool = pool; this.table = table; this.operation = 'select'; this.filters = []; this.columns = '*';
    this.hooks = hooks;
  }
  select(columns = '*', options = {}) { this.columns = columns; this.counted = options.count === 'exact'; this.head = options.head; return this; }
  eq(key, value) { this.filters.push([key, 'eq', value]); return this; }
  is(key, value) { this.filters.push([key, 'is', value]); return this; }
  in(key, value) { this.filters.push([key, 'in', value]); return this; }
  not(key, op, value) { if(op!=='is') throw new Error('Unsupported NOT filter'); this.filters.push([key,'notis',value]);return this; }
  limit(count) { this.maximum=count;return this; }
  order(key, { ascending = true } = {}) { this.ordering = [key, ascending]; return this; }
  update(patch) { this.operation = 'update'; this.patch = patch; return this; }
  insert(patch) { this.operation = 'insert'; this.patch = patch; return this; }
  delete() { this.operation = 'delete'; return this; }
  maybeSingle() { this.cardinality = 'optional'; return this; }
  single() { this.cardinality = 'required'; return this; }
  async execute() {
    const values = [];
    const param = (value) => { values.push(value); return `$${values.length}`; };
    const table = `public.${identifier(this.table)}`;
    const where = () => this.filters.length ? ' WHERE ' + this.filters.map(([key, op, value]) => {
      const jsonPath = key.match(/^([a-z_][a-z_0-9]*)->>([a-z_][a-z_0-9]*)$/i);
      const column = jsonPath ? `${identifier(jsonPath[1])}->>${param(jsonPath[2])}` : identifier(key);
      if (op === 'is' && value === null) return `${column} IS NULL`;
      if (op === 'notis' && value === null) return `${column} IS NOT NULL`;
      if (op === 'in') return `${column} = ANY(${param(value)})`;
      return `${column} = ${param(value)}`;
    }).join(' AND ') : '';
    try {
      let sql;
      if (this.operation === 'select') {
        // The only nested relationship used by these coordinators is the roster.
        const projection = this.columns.includes('protocols ( slug )')
          ? `${table}.*, (SELECT json_build_object('slug', p.slug) FROM public.protocols p WHERE p.id = ${table}.protocol_id) AS protocols`
          : this.columns.includes('participants ( display_name )')
          ? `${table}.*, (SELECT json_build_object('display_name', p.display_name) FROM public.participants p WHERE p.id = ${table}.participant_id) AS participants`
          : this.columns === '*' ? '*' : this.columns.split(',').map((key) => identifier(key.trim())).join(',');
        sql = `SELECT ${projection} FROM ${table}${where()}`;
        if (this.ordering) sql += ` ORDER BY ${identifier(this.ordering[0])} ${this.ordering[1] ? 'ASC' : 'DESC'}`;
        if (this.maximum!==undefined) sql += ` LIMIT ${param(this.maximum)}`;
      } else if (this.operation === 'update') {
        const set = Object.entries(this.patch).map(([key, value]) => `${identifier(key)} = ${param(value)}`).join(',');
        sql = `UPDATE ${table} SET ${set}${where()} RETURNING *`;
      } else if (this.operation === 'insert') {
        const rows = Array.isArray(this.patch) ? this.patch : [this.patch];
        const keys = Object.keys(rows[0]);
        const tuples = rows.map((row) => `(${keys.map((key) => param(row[key])).join(',')})`).join(',');
        sql = `INSERT INTO ${table} (${keys.map(identifier).join(',')}) VALUES ${tuples} RETURNING *`;
      } else if (this.operation === 'delete') sql = `DELETE FROM ${table}${where()} RETURNING *`;
      else throw new Error(`Unsupported operation: ${this.operation}`);
      await this.hooks.beforeQuery?.(this);
      const result = await this.pool.query(sql, values);
      // PostgREST transports timestamps as ISO strings, never native Date
      // objects (Date.parse(Date) would silently discard milliseconds).
      const wireRows = JSON.parse(JSON.stringify(result.rows));
      if (this.cardinality && (result.rows.length > 1 || (this.cardinality === 'required' && result.rows.length !== 1))) {
        return { data: null, error: { code: 'PGRST116', message: 'Wrong single-row cardinality' } };
      }
      const response = { data: this.head ? null : this.cardinality ? wireRows[0] ?? null : wireRows, error: null,
        ...(this.counted ? { count: result.rows.length } : {}) };
      await this.hooks.afterQuery?.(this, response);
      return response;
    } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
  }
  then(resolve, reject) { this.execution ??= this.execute(); return this.execution.then(resolve, reject); }
}

export async function startPostgres() {
  const temporaryRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'unmute-transactions-'));
  const socket = createServer();
  await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const password = randomUUID();
  const logs = [];
  const server = new EmbeddedPostgres({
    databaseDir: join(directory, 'data'), port, user: 'postgres', password, persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-h', '127.0.0.1', '-c', 'wal_level=logical'],
    onLog: (message) => logs.push(String(message)), onError: (message) => logs.push(String(message)),
  });
  let pool;
  let servicePool;
  let currentMigration;
  const close = async () => {
    await servicePool?.end();
    await pool?.end();
    await server.stop();
    // Delete only the fresh test cluster directory, never a caller-supplied DB.
    if (resolve(directory).startsWith(temporaryRoot + sep) && directory.split(sep).at(-1).startsWith('unmute-transactions-')) {
      await rm(directory, { recursive: true, force: true });
    }
  };
  try {
    await server.initialise();
    await server.start();
    const connection = { host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', connectionTimeoutMillis: 5000 };
    pool = new pg.Pool({ ...connection, max: 4 });
    await pool.query(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
      CREATE PUBLICATION supabase_realtime;`);
    const migrations = (await readdir(join(appRoot, 'supabase/migrations'))).filter(name => /^\d+.*\.sql$/.test(name)).sort();
    for (const migration of migrations) { currentMigration = migration; await pool.query(await readFile(join(appRoot, 'supabase/migrations', migration), 'utf8')); }
    await pool.query(`GRANT USAGE ON SCHEMA public TO service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;`);
    servicePool = new pg.Pool({ ...connection, max: 6, options: '-c role=service_role' });
    await pool.query(`CREATE SCHEMA test_control;
      CREATE TABLE test_control.failures(point text PRIMARY KEY);
      GRANT USAGE ON SCHEMA test_control TO service_role;
      GRANT SELECT ON test_control.failures TO service_role;
      CREATE FUNCTION test_control.fail_write() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM test_control.failures WHERE point = TG_TABLE_NAME || ':' || TG_OP) THEN
          RAISE EXCEPTION 'Injected storage failure: %:%', TG_TABLE_NAME, TG_OP;
        END IF;
        RETURN NEW;
      END; $$;`);
    for (const [table, operation] of [
      ['code_switch_rounds', 'UPDATE'], ['code_switch_sessions', 'UPDATE'], ['code_switch_clues', 'UPDATE'],
      ['say_less_sessions', 'UPDATE'], ['say_less_card_events', 'INSERT'], ['say_less_turns', 'UPDATE'], ['session_state', 'UPDATE'],
      ['sessions', 'UPDATE'], ['say_less_teams', 'UPDATE'], ['say_less_previews', 'INSERT'], ['say_less_turns', 'INSERT'], ['code_switch_rounds', 'INSERT'],
    ]) await pool.query(`CREATE TRIGGER test_failure_${operation.toLowerCase()} AFTER ${operation} ON public.${identifier(table)} FOR EACH ROW EXECUTE FUNCTION test_control.fail_write()`);
    const { rows: extraTables } = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public'
      AND (tablename ~ '^(talk_track|zoning_rights|ikwym|rank_and_file|truth_is|airtime|otsp|cover_story|wao)_'
      OR tablename IN ('dibe_teams','workshop_action_receipts'))`);
    for (const { tablename } of extraTables) for (const operation of ['INSERT','UPDATE','DELETE']) {
      await pool.query(`DROP TRIGGER IF EXISTS test_failure_${operation.toLowerCase()} ON public.${identifier(tablename)}`);
      await pool.query(`CREATE TRIGGER test_failure_${operation.toLowerCase()} AFTER ${operation} ON public.${identifier(tablename)} FOR EACH ROW EXECUTE FUNCTION test_control.fail_write()`);
    }
    return { pool, servicePool, database: new PostgresDatabase(servicePool), close };
  } catch (error) {
    await close().catch(() => {});
    throw new Error(`Local PostgreSQL setup failed (${currentMigration ?? "bootstrap"}): ${error.message} ${(error.where ?? "").slice(0, 300)}\n${logs.slice(-15).join('\n')}`);
  }
}
