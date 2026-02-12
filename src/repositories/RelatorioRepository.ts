import { Database } from '../infra/db';

export interface RelatorioRow {
  id: string;
  pesquisa_id: string;
  tenant_id: string;
  tipo: string;
  caminho_arquivo: string | null;
  url_acesso: string | null;
  hash_arquivo: string | null;
  gerado_em: Date;
  criado_em: Date;
}

/**
 * Repository para tabela relatorios (registro de relatórios gerados).
 */
export class RelatorioRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Cria registro de relatório (esqueleto: geração real de PDF em etapa futura).
   */
  public async criar(
    pesquisaId: string,
    tenantId: string,
    tipo: 'pdf' | 'word',
    urlOuCaminho?: string,
    hashArquivo?: string
  ): Promise<RelatorioRow> {
    const query = `
      INSERT INTO relatorios (pesquisa_id, tenant_id, tipo, url_acesso, hash_arquivo)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, pesquisa_id, tenant_id, tipo, caminho_arquivo, url_acesso, hash_arquivo, gerado_em, criado_em
    `;
    const row = await this.db.queryOne<RelatorioRow>(query, [
      pesquisaId,
      tenantId,
      tipo,
      urlOuCaminho ?? null,
      hashArquivo ?? null,
    ]);
    if (!row) throw new Error('Falha ao criar registro de relatório');
    return row;
  }
}
