import { Database } from '../infra/db';

export interface MunicipioCoords {
  codigoIbge: string;
  nome?: string;
  codigoUf?: string;
  latitude: number;
  longitude: number;
}

/**
 * Repository para leitura da tabela municipios (lat/long para filtro geográfico).
 */
export class MunicipioRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Busca um município por código IBGE e retorna latitude/longitude.
   */
  public async findByCodigoIbge(
    codigoIbge: string
  ): Promise<{ latitude: number; longitude: number; nome?: string; codigoUf?: string } | null> {
    const query = `
      SELECT codigo_ibge, nome, codigo_uf, latitude, longitude
      FROM municipios
      WHERE codigo_ibge = $1
    `;
    const row = await this.db.queryOne<any>(query, [codigoIbge]);
    if (!row) return null;
    return {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      nome: row.nome,
      codigoUf: row.codigo_uf,
    };
  }

  /**
   * Busca latitude/longitude para vários códigos IBGE de uma vez (batch).
   */
  public async findLatLongByCodigos(
    codigos: string[]
  ): Promise<Map<string, { latitude: number; longitude: number }>> {
    const map = new Map<string, { latitude: number; longitude: number }>();
    if (codigos.length === 0) return map;

    const unique = [...new Set(codigos)].filter(Boolean);
    if (unique.length === 0) return map;

    const placeholders = unique.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      SELECT codigo_ibge, latitude, longitude
      FROM municipios
      WHERE codigo_ibge IN (${placeholders})
    `;
    const rows = await this.db.query<any>(query, unique);
    for (const row of rows) {
      map.set(row.codigo_ibge, {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      });
    }
    return map;
  }
}
