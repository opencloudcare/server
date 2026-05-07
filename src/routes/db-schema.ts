import { Router } from "express";
import { auth } from "../utils/auth";
import { fromNodeHeaders } from "better-auth/node";
import db from "../utils/db";

const router = Router();
const LOG = "\x1b[35m[DB Schema]\x1b[0m";

router.get("/", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).send("User not authenticated");
    return;
  }
  console.log(`${LOG} GET / | user: ${session.user.id}`);

  try {
    // 1. Tables with live row-count estimates from pg stats
    const tablesResult = await db.query<{ table_name: string; row_count: string }>(`
      SELECT
        t.table_name,
        COALESCE(s.n_live_tup, 0)::bigint AS row_count
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);

    // 2. All columns in the public schema
    const columnsResult = await db.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: string | null;
      ordinal_position: number;
    }>(`
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        c.ordinal_position
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `);

    // 3. Primary key columns
    const pksResult = await db.query<{ table_name: string; column_name: string }>(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema  = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema    = 'public'
    `);

    // 4. Unique constraint columns
    const uniqueResult = await db.query<{ table_name: string; column_name: string }>(`
      SELECT tc.table_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema  = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema    = 'public'
    `);

    // 5. Foreign key relationships with referential actions
    const fksResult = await db.query<{
      from_table: string;
      from_column: string;
      to_table: string;
      to_column: string;
      on_delete: string;
      on_update: string;
      constraint_name: string;
    }>(`
      SELECT
        tc.table_name            AS from_table,
        kcu.column_name          AS from_column,
        ccu.table_name           AS to_table,
        ccu.column_name          AS to_column,
        rc.delete_rule           AS on_delete,
        rc.update_rule           AS on_update,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema  = kcu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema    = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);

    // 6. Check constraints (e.g. role IN ('user', 'model'))
    const checksResult = await db.query<{
      table_name: string;
      constraint_name: string;
      check_clause: string;
    }>(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
        AND tc.table_schema   = cc.constraint_schema
      WHERE tc.constraint_type = 'CHECK'
        AND tc.table_schema    = 'public'
        AND cc.check_clause NOT LIKE '%IS NOT NULL%'
      ORDER BY tc.table_name
    `);

    // 7. Indexes (including expression indexes like HNSW)
    const indexesResult = await db.query<{
      tablename: string;
      indexname: string;
      indexdef: string;
    }>(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    // Build lookup sets
    const pkSet     = new Set(pksResult.rows.map(r => `${r.table_name}.${r.column_name}`));
    const uniqueSet = new Set(uniqueResult.rows.map(r => `${r.table_name}.${r.column_name}`));
    const fkSet     = new Set(fksResult.rows.map(r => `${r.from_table}.${r.from_column}`));

    // Group columns by table
    const columnsByTable: Record<string, {
      name: string; type: string; nullable: boolean;
      default: string | null; isPk: boolean; isUnique: boolean; isFk: boolean;
    }[]> = {};

    for (const col of columnsResult.rows) {
      if (!columnsByTable[col.table_name]) columnsByTable[col.table_name] = [];
      // Prefer the udt_name (e.g. "vector", "timestamptz") over the generic data_type
      const displayType = col.udt_name !== col.data_type ? col.udt_name : col.data_type;
      columnsByTable[col.table_name].push({
        name:     col.column_name,
        type:     displayType,
        nullable: col.is_nullable === "YES",
        default:  col.column_default,
        isPk:     pkSet.has(`${col.table_name}.${col.column_name}`),
        isUnique: uniqueSet.has(`${col.table_name}.${col.column_name}`),
        isFk:     fkSet.has(`${col.table_name}.${col.column_name}`),
      });
    }

    // Group indexes by table
    const indexesByTable: Record<string, { name: string; definition: string }[]> = {};
    for (const idx of indexesResult.rows) {
      if (!indexesByTable[idx.tablename]) indexesByTable[idx.tablename] = [];
      indexesByTable[idx.tablename].push({ name: idx.indexname, definition: idx.indexdef });
    }

    // Group check constraints by table
    const checksByTable: Record<string, { name: string; clause: string }[]> = {};
    for (const chk of checksResult.rows) {
      if (!checksByTable[chk.table_name]) checksByTable[chk.table_name] = [];
      checksByTable[chk.table_name].push({ name: chk.constraint_name, clause: chk.check_clause });
    }

    // Assemble final response
    const tables = tablesResult.rows.map(t => ({
      name:     t.table_name,
      rowCount: Number(t.row_count),
      columns:  columnsByTable[t.table_name]  ?? [],
      indexes:  indexesByTable[t.table_name]  ?? [],
      checks:   checksByTable[t.table_name]   ?? [],
    }));

    const foreignKeys = fksResult.rows.map(fk => ({
      fromTable:      fk.from_table,
      fromColumn:     fk.from_column,
      toTable:        fk.to_table,
      toColumn:       fk.to_column,
      onDelete:       fk.on_delete,
      onUpdate:       fk.on_update,
      constraintName: fk.constraint_name,
    }));

    console.log(`${LOG} returned ${tables.length} tables, ${foreignKeys.length} FK(s)`);
    res.status(200).json({ tables, foreignKeys });

  } catch (error) {
    console.error(`${LOG} error`, error);
    res.status(500).send(error instanceof Error ? error.message : "Internal Server Error");
  }
});

export default router;
