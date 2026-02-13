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

  /**
   * Lista todas as UFs distintas.
   */
  public async listarUFs(): Promise<{ codigoUf: string; sigla: string }[]> {
    const ufMap: Record<string, string> = {
      '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
      '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
      '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
      '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
    };
    const query = `
      SELECT DISTINCT codigo_uf
      FROM municipios
      ORDER BY codigo_uf
    `;
    const rows = await this.db.query<{ codigo_uf: string }>(query, []);
    return rows.map((row) => ({
      codigoUf: row.codigo_uf,
      sigla: ufMap[row.codigo_uf] ?? row.codigo_uf,
    }));
  }

  /**
   * Lista municípios de uma UF específica.
   */
  public async listarPorUF(codigoUf: string): Promise<MunicipioCoords[]> {
    const query = `
      SELECT codigo_ibge, nome, codigo_uf, latitude, longitude
      FROM municipios
      WHERE codigo_uf = $1
      ORDER BY nome
    `;
    const rows = await this.db.query<any>(query, [codigoUf]);
    return rows.map((row) => ({
      codigoIbge: row.codigo_ibge,
      nome: row.nome,
      codigoUf: row.codigo_uf,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    }));
  }
}
