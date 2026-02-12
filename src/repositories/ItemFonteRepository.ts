import { Database } from '../infra/db';
import { ItemFonte } from '../domain/ItemFonte';

/**
 * Fonte detalhada com dados denormalizados do PNCP para exibição.
 */
export interface ItemFonteDetalhada extends ItemFonte {
  // Dados do item_licitacao
  descricaoPNCP: string;
  quantidadePNCP?: number;
  unidadeMedidaPNCP?: string;
  // Dados da licitacao
  numeroControlePNCP: string;
  razaoSocialOrgao: string;
  municipioNome?: string;
  ufSigla?: string;
  numeroCompra?: string;
}

/**
 * Repository para fontes de itens (item_fontes).
 */
export class ItemFonteRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Adiciona uma fonte a um item.
   * Extrai automaticamente o valorUnitario e dataLicitacao do item_licitacao.
   */
  public async adicionarFonte(
    projetoItemId: string,
    itemLicitacaoId: string
  ): Promise<ItemFonte> {
    const query = `
      INSERT INTO item_fontes (
        projeto_item_id,
        item_licitacao_id,
        valor_unitario,
        data_licitacao
      )
      SELECT
        $1,
        i.id,
        COALESCE(i.valor_unitario_estimado, i.valor_total / NULLIF(i.quantidade, 0), 0),
        l.data_publicacao_pncp
      FROM itens_licitacao i
      INNER JOIN licitacoes l ON l.id = i.licitacao_id
      WHERE i.id = $2
      RETURNING *
    `;

    try {
      const row = await this.db.queryOne<any>(query, [projetoItemId, itemLicitacaoId]);
      return this.mapRowToItemFonte(row);
    } catch (error: any) {
      // Se for erro de constraint UNIQUE (duplicate fonte)
      if (error.code === '23505') {
        throw new Error('Esta fonte já está vinculada ao item');
      }
      throw error;
    }
  }

  /**
   * Lista todas as fontes de um item com dados detalhados do PNCP.
   */
  public async listarFontesPorItem(projetoItemId: string): Promise<ItemFonteDetalhada[]> {
    const query = `
      SELECT
        f.*,
        i.descricao as descricao_pncp,
        i.quantidade as quantidade_pncp,
        i.unidade_medida as unidade_medida_pncp,
        l.numero_controle_pncp,
        l.razao_social_orgao,
        l.municipio_nome,
        l.uf_sigla,
        l.numero_compra
      FROM item_fontes f
      INNER JOIN itens_licitacao i ON i.id = f.item_licitacao_id
      INNER JOIN licitacoes l ON l.id = i.licitacao_id
      WHERE f.projeto_item_id = $1
      ORDER BY f.criado_em ASC
    `;

    const rows = await this.db.query<any>(query, [projetoItemId]);
    return rows.map((row: any) => this.mapRowToItemFonteDetalhada(row));
  }

  /**
   * Busca uma fonte por ID.
   */
  public async buscarPorId(id: string): Promise<ItemFonte | null> {
    const query = 'SELECT * FROM item_fontes WHERE id = $1';
    const row = await this.db.queryOne<any>(query, [id]);
    if (!row) return null;
    return this.mapRowToItemFonte(row);
  }

  /**
   * Marca uma fonte como ignorada no cálculo (outlier).
   */
  public async marcarIgnorada(id: string, justificativa: string): Promise<ItemFonte> {
    const query = `
      UPDATE item_fontes
      SET ignorado_calculo = true, justificativa_exclusao = $1
      WHERE id = $2
      RETURNING *
    `;
    const row = await this.db.queryOne<any>(query, [justificativa, id]);
    return this.mapRowToItemFonte(row);
  }

  /**
   * Desmarca uma fonte como ignorada (inclui novamente no cálculo).
   */
  public async desmarcarIgnorada(id: string): Promise<ItemFonte> {
    const query = `
      UPDATE item_fontes
      SET ignorado_calculo = false, justificativa_exclusao = NULL
      WHERE id = $1
      RETURNING *
    `;
    const row = await this.db.queryOne<any>(query, [id]);
    return this.mapRowToItemFonte(row);
  }

  /**
   * Remove uma fonte de um item.
   * IMPORTANTE: Isso diminui a contagem de fontes (via trigger).
   */
  public async removerFonte(id: string): Promise<void> {
    const query = 'DELETE FROM item_fontes WHERE id = $1';
    await this.db.query(query, [id]);
  }

  /**
   * Verifica fontes antigas (>X meses) em um projeto.
   * Retorna alerta para fontes que podem ser muito antigas conforme Lei 14.133/2021.
   */
  public async verificarRecencia(projetoId: string, meses: number = 12): Promise<Array<{
    fonteId: string;
    itemId: string;
    itemNome: string;
    dataLicitacao: Date;
    idadeMeses: number;
  }>> {
    const query = `
      SELECT
        f.id as fonte_id,
        pi.id as item_id,
        pi.nome as item_nome,
        f.data_licitacao,
        EXTRACT(MONTH FROM AGE(NOW(), f.data_licitacao)) as idade_meses
      FROM item_fontes f
      INNER JOIN projeto_itens pi ON pi.id = f.projeto_item_id
      WHERE pi.projeto_id = $1
        AND f.data_licitacao < NOW() - INTERVAL '1 month' * $2
      ORDER BY f.data_licitacao ASC
    `;

    const rows = await this.db.query<any>(query, [projetoId, meses]);

    return rows.map((row: any) => ({
      fonteId: row.fonte_id,
      itemId: row.item_id,
      itemNome: row.item_nome,
      dataLicitacao: row.data_licitacao,
      idadeMeses: Math.floor(row.idade_meses)
    }));
  }

  /**
   * Mapeia uma linha do banco para um objeto ItemFonte.
   */
  private mapRowToItemFonte(row: any): ItemFonte {
    return new ItemFonte({
      id: row.id,
      projetoItemId: row.projeto_item_id,
      itemLicitacaoId: row.item_licitacao_id,
      valorUnitario: parseFloat(row.valor_unitario),
      ignoradoCalculo: row.ignorado_calculo,
      justificativaExclusao: row.justificativa_exclusao,
      dataLicitacao: row.data_licitacao,
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em
    });
  }

  /**
   * Mapeia uma linha do banco para ItemFonteDetalhada (com dados do PNCP).
   */
  private mapRowToItemFonteDetalhada(row: any): ItemFonteDetalhada {
    const fonte = this.mapRowToItemFonte(row);

    return {
      ...fonte,
      descricaoPNCP: row.descricao_pncp,
      quantidadePNCP: row.quantidade_pncp ? parseFloat(row.quantidade_pncp) : undefined,
      unidadeMedidaPNCP: row.unidade_medida_pncp,
      numeroControlePNCP: row.numero_controle_pncp,
      razaoSocialOrgao: row.razao_social_orgao,
      municipioNome: row.municipio_nome,
      ufSigla: row.uf_sigla,
      numeroCompra: row.numero_compra,
      // Preserve methods from ItemFonte instance
      isIncluida: () => fonte.isIncluida(),
      isIgnorada: () => fonte.isIgnorada(),
      isAntiga: (meses?: number) => fonte.isAntiga(meses),
      getIdadeMeses: () => fonte.getIdadeMeses()
    };
  }
}
