import { randomUUID } from 'node:crypto';

const copy = (value) => structuredClone(value);
const matches = (query, rule) => query.table === rule.table && query.operation === rule.operation;

/** Deliberately small PostgREST double. Unsupported tables/operations fail loudly. */
export class MemoryDatabase {
  constructor(tables, unique = {}) {
    this.tables = copy(tables);
    this.unique = unique;
    this.trace = [];
    this.faults = [];
    this.gates = [];
    this.broadcasts = [];
  }

  from(table) {
    if (!Object.hasOwn(this.tables, table)) throw new Error(`Unmodelled table: ${table}`);
    return new Query(this, table);
  }

  rows(table) { return copy(this.tables[table]); }

  failNext(table, operation, times = 1) {
    this.faults.push({ table, operation, remaining: times });
  }

  /** Pause matching operations before execution or after a read snapshot is taken. */
  hold(table, operation, { stage = 'before', count = 1 } = {}) {
    let hit;
    let release;
    const reached = new Promise((resolve) => { hit = resolve; });
    const released = new Promise((resolve) => { release = resolve; });
    const gate = { table, operation, stage, remaining: count, released, hit, release };
    this.gates.push(gate);
    return { reached, release };
  }

  async checkpoint(query, stage) {
    const gate = this.gates.find((item) => item.stage === stage && item.remaining > 0 && matches(query, item));
    if (!gate) return;
    gate.remaining -= 1;
    if (gate.remaining === 0) gate.hit();
    await gate.released;
  }

  channel(topic) {
    return { httpSend: async (event, payload) => {
      this.broadcasts.push(copy({ topic, event, payload }));
      return { success: true };
    } };
  }

  async removeChannel() { return 'ok'; }

  async execute(query) {
    const record = { table: query.table, operation: query.operation, filters: copy(query.filters) };
    this.trace.push(record);
    await this.checkpoint(query, 'before');
    const fault = this.faults.find((item) => item.remaining > 0 && matches(query, item));
    if (fault) {
      fault.remaining -= 1;
      record.failed = true;
      return { data: null, error: { code: 'TEST_FAILURE', message: 'Injected storage failure' } };
    }

    const rows = this.tables[query.table];
    const selected = rows.filter((row) => query.filters.every(([key, op, value]) => {
      if (op === 'in') return value.includes(row[key]);
      if (key.includes('->>')) {
        const [column, property] = key.split('->>');
        const field = row[column]?.[property];
        return (field == null ? null : String(field)) === value;
      }
      return row[key] === value;
    }));
    let result;
    if (query.operation === 'select') result = copy(selected);
    else if (query.operation === 'update') {
      for (const row of selected) Object.assign(row, copy(query.patch));
      result = copy(selected);
    } else if (query.operation === 'delete') {
      this.tables[query.table] = rows.filter((row) => !selected.includes(row));
      result = copy(selected);
    } else if (query.operation === 'insert') {
      const additions = (Array.isArray(query.patch) ? query.patch : [query.patch])
        .map((row) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...copy(row) }));
      const candidateRows = [...rows];
      for (const row of additions) {
        const duplicate = (this.unique[query.table] ?? []).some((keys) =>
          candidateRows.some((other) => keys.every((key) => other[key] === row[key])));
        if (duplicate) return { data: null, error: { code: '23505', message: 'Duplicate operation' } };
        candidateRows.push(row);
      }
      rows.push(...additions);
      result = copy(additions);
    } else throw new Error(`Unmodelled operation: ${query.operation}`);

    if (query.ordering) {
      const { key, ascending } = query.ordering;
      result.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1));
    }
    // Snapshot before the barrier: two readers really see the same revision.
    if (query.operation === 'select') await this.checkpoint(query, 'afterRead');
    if (query.cardinality && (result.length > 1 || (query.cardinality === 'required' && result.length !== 1))) {
      return { data: null, error: { code: 'PGRST116', message: 'Wrong single-row cardinality' } };
    }
    return { data: query.cardinality ? result[0] ?? null : result, error: null };
  }
}

class Query {
  constructor(database, table) {
    this.database = database;
    this.table = table;
    this.operation = 'select';
    this.filters = [];
  }

  select() { return this; }
  eq(key, value) { this.filters.push([key, 'eq', value]); return this; }
  is(key, value) { this.filters.push([key, 'is', value]); return this; }
  in(key, value) { this.filters.push([key, 'in', value]); return this; }
  order(key, { ascending = true } = {}) { this.ordering = { key, ascending }; return this; }
  update(patch) { this.operation = 'update'; this.patch = patch; return this; }
  insert(patch) { this.operation = 'insert'; this.patch = patch; return this; }
  delete() { this.operation = 'delete'; return this; }
  maybeSingle() { this.cardinality = 'optional'; return this; }
  single() { this.cardinality = 'required'; return this; }
  then(resolve, reject) {
    this.execution ??= this.database.execute(this);
    return this.execution.then(resolve, reject);
  }
}
