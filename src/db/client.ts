import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  insertId?: number;
  [key: number]: any;
}

export class DatabasePool {
  private _sql: any = null;
  public readonly isNeon: boolean = true;

  private getSql(): any {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL environment variable is not defined.');
    }
    if (!this._sql) {
      this._sql = neon(connStr, { fullResults: true });
    }
    return this._sql;
  }

  /**
   * Universal query executor supporting:
   * 1. MySQL-style array destructuring: const [rows] = await pool.query(...)
   * 2. pg-style object destructuring: const { rows } = await pool.query(...)
   * 3. Insert ID helper: const [res] = await ...; res.insertId
   * 4. Automatic placeholder translation: '?' -> '$1, $2, ...'
   */
  async query<T = any>(text: string, params: any[] = []): Promise<[T, any]> {
    let paramIndex = 1;
    let pgText = text.trim().replace(/;+$/, '').replace(/\?/g, () => `$${paramIndex++}`);

    const isInsert = /^\s*INSERT\s+INTO\s+/i.test(pgText);
    const hasReturning = /RETURNING\s+/i.test(pgText);
    if (isInsert && !hasReturning) {
      pgText += ' RETURNING id';
    }

    const sql = this.getSql();
    const res = await sql.query(pgText, params);
    const rows = (res.rows || []) as any;

    const resultArr: any = [rows, null];
    resultArr.rows = rows;
    resultArr.rowCount = res.rowCount || 0;
    
    if (isInsert && rows.length > 0 && rows[0]?.id) {
      const insertedId = Number(rows[0].id);
      resultArr.insertId = insertedId;
      resultArr[0].insertId = insertedId;
    }

    return resultArr;
  }

  async getConnection() {
    return {
      query: (text: string, params: any[] = []) => this.query(text, params),
      release: () => {},
    };
  }

  async end() {
    this._sql = null;
  }
}

export const pool = new DatabasePool();

export async function checkConnection(): Promise<boolean> {
  try {
    const [rows] = await pool.query('SELECT 1 as connected');
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    console.error('Failed to connect to Neon PostgreSQL database:', error);
    return false;
  }
}
