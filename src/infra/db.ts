import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Classe responsável por gerenciar a conexão com o banco de dados PostgreSQL
 */
export class Database {
  private static instance: Database;
  private pool: Pool;

  private constructor() {
    const databaseUrl = this.buildDatabaseUrl();
    
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('Erro inesperado no pool de conexões:', err);
    });
  }

  /**
   * Constrói a URL de conexão do banco a partir das variáveis de ambiente
   */
  private buildDatabaseUrl(): string {
    // Se já tiver DATABASE_URL, usa ela
    if (process.env.DATABASE_URL) {
      return process.env.DATABASE_URL;
    }

    // Caso contrário, tenta construir a partir do SUPABASE_URL
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('DATABASE_URL ou SUPABASE_URL deve estar configurado no .env');
    }

    // Extrai o project_id do SUPABASE_URL
    const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (!match) {
      throw new Error('SUPABASE_URL inválido. Formato esperado: https://PROJECT_ID.supabase.co');
    }

    const projectId = match[1];
    const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!dbPassword) {
      throw new Error('SUPABASE_DB_PASSWORD ou SUPABASE_SERVICE_ROLE_KEY deve estar configurado');
    }

    // Monta a connection string do Postgres
    return `postgresql://postgres.${projectId}:${dbPassword}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;
  }

  /**
   * Retorna a instância singleton do Database
   */
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Obtém uma conexão do pool
   */
  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Executa uma query e retorna o resultado
   */
  public async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result.rows as T[];
    } finally {
      client.release();
    }
  }

  /**
   * Executa uma query e retorna apenas uma linha
   */
  public async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Fecha todas as conexões do pool
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Retorna o pool diretamente (para casos especiais)
   */
  public getPool(): Pool {
    return this.pool;
  }
}
