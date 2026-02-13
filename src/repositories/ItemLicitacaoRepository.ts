import { Database } from '../infra/db';
import { ItemLicitacao } from '../domain/ItemLicitacao';

/**
 * Repository para operações de persistência de ItemLicitacao
 */
export class ItemLicitacaoRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Salva múltiplos itens em batch (INSERT com múltiplos valores)
   */
  public async saveMany(itens: ItemLicitacao[]): Promise<void> {
    if (itens.length === 0) return;

    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      // Prepara os valores para inserção em batch
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramIndex = 1;

      for (const item of itens) {
        const itemPlaceholders: string[] = [];
        itemPlaceholders.push(`$${paramIndex++}`); // licitacao_id
        itemPlaceholders.push(`$${paramIndex++}`); // numero_item
        itemPlaceholders.push(`$${paramIndex++}`); // descricao
        itemPlaceholders.push(`$${paramIndex++}`); // material_ou_servico
        itemPlaceholders.push(`$${paramIndex++}`); // material_ou_servico_nome
        itemPlaceholders.push(`$${paramIndex++}`); // valor_unitario_estimado
        itemPlaceholders.push(`$${paramIndex++}`); // valor_total
        itemPlaceholders.push(`$${paramIndex++}`); // quantidade
        itemPlaceholders.push(`$${paramIndex++}`); // unidade_medida
        itemPlaceholders.push(`$${paramIndex++}`); // situacao_compra_item
        itemPlaceholders.push(`$${paramIndex++}`); // situacao_compra_item_nome
        itemPlaceholders.push(`$${paramIndex++}`); // criterio_julgamento_id
        itemPlaceholders.push(`$${paramIndex++}`); // criterio_julgamento_nome
        itemPlaceholders.push(`$${paramIndex++}`); // item_categoria_id
        itemPlaceholders.push(`$${paramIndex++}`); // item_categoria_nome
        itemPlaceholders.push(`$${paramIndex++}`); // ncm_nbs_codigo
        itemPlaceholders.push(`$${paramIndex++}`); // ncm_nbs_descricao
        itemPlaceholders.push(`$${paramIndex++}`); // catalogo_codigo_item
        itemPlaceholders.push(`$${paramIndex++}`); // informacao_complementar
        itemPlaceholders.push(`$${paramIndex++}`); // orcamento_sigiloso
        itemPlaceholders.push(`$${paramIndex++}`); // tem_resultado
        itemPlaceholders.push(`$${paramIndex++}`); // data_inclusao
        itemPlaceholders.push(`$${paramIndex++}`); // data_atualizacao

        placeholders.push(`(${itemPlaceholders.join(', ')})`);

        values.push(
          item.licitacaoId,
          item.numeroItem,
          item.descricao,
          item.materialOuServico,
          item.materialOuServicoNome,
          item.valorUnitarioEstimado,
          item.valorTotal,
          item.quantidade,
          item.unidadeMedida,
          item.situacaoCompraItem,
          item.situacaoCompraItemNome,
          item.criterioJulgamentoId,
          item.criterioJulgamentoNome,
          item.itemCategoriaId,
          item.itemCategoriaNome,
          item.ncmNbsCodigo,
          item.ncmNbsDescricao,
          item.catalogoCodigoItem,
          item.informacaoComplementar,
          item.orcamentoSigiloso,
          item.temResultado,
          item.dataInclusao,
          item.dataAtualizacao,
        );
      }

      const query = `
        INSERT INTO itens_licitacao (
          licitacao_id, numero_item, descricao, material_ou_servico, material_ou_servico_nome,
          valor_unitario_estimado, valor_total, quantidade, unidade_medida,
          situacao_compra_item, situacao_compra_item_nome,
          criterio_julgamento_id, criterio_julgamento_nome,
          item_categoria_id, item_categoria_nome,
          ncm_nbs_codigo, ncm_nbs_descricao, catalogo_codigo_item,
          informacao_complementar, orcamento_sigiloso, tem_resultado,
          data_inclusao, data_atualizacao
        ) VALUES ${placeholders.join(', ')}
      `;

      await client.query(query, values);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Busca um item de licitação por ID.
   */
  public async buscarPorId(id: string): Promise<ItemLicitacao | null> {
    const query = 'SELECT * FROM itens_licitacao WHERE id = $1';
    const row = await this.db.queryOne<any>(query, [id]);
    if (!row) return null;
    return this.mapRowToItemLicitacao(row);
  }

  /**
   * Busca todos os itens de uma licitação
   */
  public async findByLicitacaoId(licitacaoId: string): Promise<ItemLicitacao[]> {
    const query = 'SELECT * FROM itens_licitacao WHERE licitacao_id = $1 ORDER BY numero_item ASC';
    const rows = await this.db.query<any>(query, [licitacaoId]);
    return rows.map(row => this.mapRowToItemLicitacao(row));
  }

  /**
   * Busca textual com JOIN em licitacoes para obter codigo_ibge (filtro geográfico).
   * Retorna itens + dados da licitação (codigo_ibge, municipio_nome, uf_sigla).
   */
  public async searchByDescricaoWithLicitacao(
    searchTerm: string,
    limit?: number,
    offset: number = 0
  ): Promise<
    Array<{
      item: ItemLicitacao;
      codigoIbge: string | null;
      municipioNome: string | null;
      ufSigla: string | null;
      numeroControlePNCP: string | null;
      dataLicitacao: string | null;
    }>
  > {
    // Se limit for undefined, não aplica LIMIT (retorna todos)
    const limitClause = limit != null ? `LIMIT ${limit}` : '';
    const query = `
      SELECT i.*,
        l.codigo_ibge AS licitacao_codigo_ibge,
        l.municipio_nome AS licitacao_municipio_nome,
        l.uf_sigla AS licitacao_uf_sigla,
        l.numero_controle_pncp AS licitacao_numero_controle_pncp,
        l.data_publicacao_pncp AS licitacao_data_publicacao_pncp
      FROM itens_licitacao i
      INNER JOIN licitacoes l ON l.id = i.licitacao_id
      WHERE to_tsvector('portuguese', i.descricao) @@ plainto_tsquery('portuguese', $1)
      ORDER BY ts_rank(to_tsvector('portuguese', i.descricao), plainto_tsquery('portuguese', $1)) DESC
      ${limitClause} OFFSET $2
    `;
    const rows = await this.db.query<any>(query, [searchTerm, offset]);
    return rows.map((row: any) => ({
      item: this.mapRowToItemLicitacao(row),
      codigoIbge: row.licitacao_codigo_ibge ?? null,
      municipioNome: row.licitacao_municipio_nome ?? null,
      ufSigla: row.licitacao_uf_sigla ?? null,
      numeroControlePNCP: row.licitacao_numero_controle_pncp ?? null,
      dataLicitacao: row.licitacao_data_publicacao_pncp
        ? new Date(row.licitacao_data_publicacao_pncp).toISOString()
        : null,
    }));
  }

  /**
   * Mapeia uma linha do banco para a entidade ItemLicitacao
   */
  private mapRowToItemLicitacao(row: any): ItemLicitacao {
    return new ItemLicitacao({
      id: row.id,
      licitacaoId: row.licitacao_id,
      numeroItem: row.numero_item,
      descricao: row.descricao,
      materialOuServico: row.material_ou_servico,
      materialOuServicoNome: row.material_ou_servico_nome,
      valorUnitarioEstimado: row.valor_unitario_estimado ? parseFloat(row.valor_unitario_estimado) : undefined,
      valorTotal: row.valor_total ? parseFloat(row.valor_total) : undefined,
      quantidade: row.quantidade ? parseFloat(row.quantidade) : undefined,
      unidadeMedida: row.unidade_medida,
      situacaoCompraItem: row.situacao_compra_item,
      situacaoCompraItemNome: row.situacao_compra_item_nome,
      criterioJulgamentoId: row.criterio_julgamento_id,
      criterioJulgamentoNome: row.criterio_julgamento_nome,
      itemCategoriaId: row.item_categoria_id,
      itemCategoriaNome: row.item_categoria_nome,
      ncmNbsCodigo: row.ncm_nbs_codigo,
      ncmNbsDescricao: row.ncm_nbs_descricao,
      catalogoCodigoItem: row.catalogo_codigo_item,
      informacaoComplementar: row.informacao_complementar,
      orcamentoSigiloso: row.orcamento_sigiloso,
      temResultado: row.tem_resultado,
      dataInclusao: row.data_inclusao,
      dataAtualizacao: row.data_atualizacao,
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em,
    });
  }
}
