import { Database } from '../infra/db';
import { PesquisaPreco } from '../domain/PesquisaPreco';
import { ItemLicitacao } from '../domain/ItemLicitacao';

/**
 * Repository para pesquisas de preço e pesquisa_itens.
 */
export class PesquisaPrecoRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  public async criar(
    tenantId: string,
    usuarioId: string,
    nome: string,
    descricao?: string
  ): Promise<PesquisaPreco> {
    const query = `
      INSERT INTO pesquisas_preco (tenant_id, usuario_id, nome, descricao, status)
      VALUES ($1, $2, $3, $4, 'rascunho')
      RETURNING *
    `;
    const row = await this.db.queryOne<any>(query, [tenantId, usuarioId, nome, descricao ?? null]);
    return this.mapRowToPesquisa(row);
  }

  public async listarPorTenant(tenantId: string): Promise<PesquisaPreco[]> {
    const query = `
      SELECT * FROM pesquisas_preco
      WHERE tenant_id = $1
      ORDER BY criado_em DESC
    `;
    const rows = await this.db.query<any>(query, [tenantId]);
    return rows.map((row: any) => this.mapRowToPesquisa(row));
  }

  public async buscarPorId(id: string): Promise<PesquisaPreco | null> {
    const query = 'SELECT * FROM pesquisas_preco WHERE id = $1';
    const row = await this.db.queryOne<any>(query, [id]);
    if (!row) return null;
    return this.mapRowToPesquisa(row);
  }

  public async adicionarItens(
    pesquisaId: string,
    itemLicitacaoIds: string[],
    ordem?: number
  ): Promise<void> {
    if (itemLicitacaoIds.length === 0) return;

    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');
      let ord = ordem ?? 0;
      for (const itemId of itemLicitacaoIds) {
        await client.query(
          `INSERT INTO pesquisa_itens (pesquisa_id, item_licitacao_id, ordem)
           VALUES ($1, $2, $3)
           ON CONFLICT (pesquisa_id, item_licitacao_id) DO NOTHING`,
          [pesquisaId, itemId, ord]
        );
        ord += 1;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async buscarItensDaPesquisa(pesquisaId: string): Promise<ItemLicitacao[]> {
    const query = `
      SELECT i.*
      FROM itens_licitacao i
      INNER JOIN pesquisa_itens pi ON pi.item_licitacao_id = i.id
      WHERE pi.pesquisa_id = $1
      ORDER BY pi.ordem ASC NULLS LAST, pi.criado_em ASC
    `;
    const rows = await this.db.query<any>(query, [pesquisaId]);
    return rows.map((row: any) => this.mapRowToItemLicitacao(row));
  }

  public async removerItens(pesquisaId: string, itemLicitacaoIds: string[]): Promise<void> {
    if (itemLicitacaoIds.length === 0) return;
    const query = `
      DELETE FROM pesquisa_itens
      WHERE pesquisa_id = $1 AND item_licitacao_id = ANY($2::uuid[])
    `;
    await this.db.query(query, [pesquisaId, itemLicitacaoIds]);
  }

  private mapRowToPesquisa(row: any): PesquisaPreco {
    return new PesquisaPreco({
      id: row.id,
      tenantId: row.tenant_id,
      usuarioId: row.usuario_id,
      nome: row.nome,
      descricao: row.descricao,
      status: row.status,
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em,
    });
  }

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
