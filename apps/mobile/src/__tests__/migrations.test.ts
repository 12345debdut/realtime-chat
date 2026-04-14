/**
 * Tests for WatermelonDB schema migrations — validates that migration steps
 * match the schema definition and no migration is missing.
 */
import { schema } from '../foundation/storage/schema';
import { migrations } from '../foundation/storage/migrations';

// WatermelonDB's appSchema returns tables as { [name]: tableSchema }
// and schemaMigrations returns { sortedMigrations, minVersion, maxVersion }
const allMigrations = (migrations as any).sortedMigrations as any[];

describe('schema migrations', () => {
  it('should have migration steps up to the current schema version', () => {
    const maxMigrationVersion = Math.max(...allMigrations.map((m) => m.toVersion));
    expect(schema.version).toBe(maxMigrationVersion);
  });

  it('should have a v1->v2 migration that adds is_pinned, tags, and room_tags', () => {
    const v2Migration = allMigrations.find((m) => m.toVersion === 2);
    expect(v2Migration).toBeDefined();

    const steps = v2Migration!.steps;
    expect(steps).toHaveLength(3);

    // Step 1: Add is_pinned to rooms
    const addColumnsStep = steps.find(
      (s: any) => s.type === 'add_columns' && s.table === 'rooms',
    );
    expect(addColumnsStep).toBeDefined();
    expect(addColumnsStep!.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'is_pinned', type: 'boolean' }),
      ]),
    );

    // Step 2: Create tags table
    const createTagsStep = steps.find(
      (s: any) => s.type === 'create_table' && s.schema?.name === 'tags',
    );
    expect(createTagsStep).toBeDefined();

    // Step 3: Create room_tags table
    const createRoomTagsStep = steps.find(
      (s: any) => s.type === 'create_table' && s.schema?.name === 'room_tags',
    );
    expect(createRoomTagsStep).toBeDefined();
  });

  it('tags table migration columns should match schema', () => {
    const v2Migration = allMigrations.find((m) => m.toVersion === 2);
    const createTagsStep = v2Migration!.steps.find(
      (s: any) => s.type === 'create_table' && s.schema?.name === 'tags',
    );

    // schema.tables is a dict: { tags: { name: 'tags', columns: {...} } }
    const schemaTagTable = (schema.tables as any).tags;
    expect(schemaTagTable).toBeDefined();

    // Schema columns is also a dict keyed by column name
    const schemaColumns = schemaTagTable.columns;
    const migrationColumns = createTagsStep!.schema.columnArray;

    for (const migCol of migrationColumns) {
      const schemaCol = schemaColumns[migCol.name];
      expect(schemaCol).toBeDefined();
      expect(schemaCol.type).toBe(migCol.type);
    }
  });

  it('room_tags table migration columns should match schema', () => {
    const v2Migration = allMigrations.find((m) => m.toVersion === 2);
    const createRoomTagsStep = v2Migration!.steps.find(
      (s: any) => s.type === 'create_table' && s.schema?.name === 'room_tags',
    );

    const schemaRoomTagTable = (schema.tables as any).room_tags;
    expect(schemaRoomTagTable).toBeDefined();

    const schemaColumns = schemaRoomTagTable.columns;
    const migrationColumns = createRoomTagsStep!.schema.columnArray;

    for (const migCol of migrationColumns) {
      const schemaCol = schemaColumns[migCol.name];
      expect(schemaCol).toBeDefined();
      expect(schemaCol.type).toBe(migCol.type);
    }
  });

  it('should have a v2->v3 safety-net migration with SQL steps', () => {
    const v3Migration = allMigrations.find((m) => m.toVersion === 3);
    expect(v3Migration).toBeDefined();

    const sqlSteps = v3Migration!.steps.filter((s: any) => s.type === 'sql');
    // 5 SQL steps: CREATE TABLE tags, INDEX tags_server_id,
    // CREATE TABLE room_tags, INDEX room_tags_room_id, INDEX room_tags_tag_id
    expect(sqlSteps).toHaveLength(5);
  });

  it('v2->v3 SQL creates tags and room_tags tables with IF NOT EXISTS', () => {
    const v3Migration = allMigrations.find((m) => m.toVersion === 3);
    const sqlSteps = v3Migration!.steps.filter((s: any) => s.type === 'sql');
    const allSql = sqlSteps.map((s: any) => s.sql).join('\n');

    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS "tags"');
    expect(allSql).toContain('CREATE TABLE IF NOT EXISTS "room_tags"');
    expect(allSql).toContain('CREATE INDEX IF NOT EXISTS');
  });
});
