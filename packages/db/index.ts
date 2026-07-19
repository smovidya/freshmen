import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schemas/schema';

export function createDatabaseConnection(d1: D1Database) {
  return drizzle(d1, {
    schema
  });
}

export type Db = ReturnType<typeof createDatabaseConnection>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export { schema as tables, schema };
