import { Database } from '../infra/db';
import { Licitacao } from '../domain/Licitacao';

/**
 * Repository para operações de persistência de Licitacao
 */
export class LicitacaoRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Realiza upsert (insert ou update) de uma licitação baseado no numeroControlePNCP
   */
  public async upsert(licitacao: Licitacao): Promise<Licitacao> {
    const query = `
      INSERT INTO licitacoes (
        numero_controle_pncp, cnpj_orgao, razao_social_orgao, poder_id, esfera_id,
        ano_compra, sequencial_compra, numero_compra, processo, objeto_compra,
        modalidade_id, modalidade_nome, situacao_compra_id, situacao_compra_nome,
        valor_total_estimado, valor_total_homologado, data_publicacao_pncp,
        data_inclusao, data_atualizacao, data_atualizacao_global,
        codigo_unidade, nome_unidade, uf_sigla, municipio_nome, codigo_ibge,
        amparo_legal_codigo, amparo_legal_nome, amparo_legal_descricao,
        link_processo_eletronico, link_sistema_origem, informacao_complementar,
        justificativa_presencial, srp
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
      )
      ON CONFLICT (numero_controle_pncp) 
      DO UPDATE SET
        cnpj_orgao = EXCLUDED.cnpj_orgao,
        razao_social_orgao = EXCLUDED.razao_social_orgao,
        poder_id = EXCLUDED.poder_id,
        esfera_id = EXCLUDED.esfera_id,
        ano_compra = EXCLUDED.ano_compra,
        sequencial_compra = EXCLUDED.sequencial_compra,
        numero_compra = EXCLUDED.numero_compra,
        processo = EXCLUDED.processo,
        objeto_compra = EXCLUDED.objeto_compra,
        modalidade_id = EXCLUDED.modalidade_id,
        modalidade_nome = EXCLUDED.modalidade_nome,
        situacao_compra_id = EXCLUDED.situacao_compra_id,
        situacao_compra_nome = EXCLUDED.situacao_compra_nome,
        valor_total_estimado = EXCLUDED.valor_total_estimado,
        valor_total_homologado = EXCLUDED.valor_total_homologado,
        data_publicacao_pncp = EXCLUDED.data_publicacao_pncp,
        data_inclusao = EXCLUDED.data_inclusao,
        data_atualizacao = EXCLUDED.data_atualizacao,
        data_atualizacao_global = EXCLUDED.data_atualizacao_global,
        codigo_unidade = EXCLUDED.codigo_unidade,
        nome_unidade = EXCLUDED.nome_unidade,
        uf_sigla = EXCLUDED.uf_sigla,
        municipio_nome = EXCLUDED.municipio_nome,
        codigo_ibge = EXCLUDED.codigo_ibge,
        amparo_legal_codigo = EXCLUDED.amparo_legal_codigo,
        amparo_legal_nome = EXCLUDED.amparo_legal_nome,
        amparo_legal_descricao = EXCLUDED.amparo_legal_descricao,
        link_processo_eletronico = EXCLUDED.link_processo_eletronico,
        link_sistema_origem = EXCLUDED.link_sistema_origem,
        informacao_complementar = EXCLUDED.informacao_complementar,
        justificativa_presencial = EXCLUDED.justificativa_presencial,
        srp = EXCLUDED.srp,
        atualizado_em = NOW()
      RETURNING *
    `;

    const params = [
      licitacao.numeroControlePNCP,
      licitacao.cnpjOrgao,
      licitacao.razaoSocialOrgao,
      licitacao.poderId,
      licitacao.esferaId,
      licitacao.anoCompra,
      licitacao.sequencialCompra,
      licitacao.numeroCompra,
      licitacao.processo,
      licitacao.objetoCompra,
      licitacao.modalidadeId,
      licitacao.modalidadeNome,
      licitacao.situacaoCompraId,
      licitacao.situacaoCompraNome,
      licitacao.valorTotalEstimado,
      licitacao.valorTotalHomologado,
      licitacao.dataPublicacaoPncp,
      licitacao.dataInclusao,
      licitacao.dataAtualizacao,
      licitacao.dataAtualizacaoGlobal,
      licitacao.codigoUnidade,
      licitacao.nomeUnidade,
      licitacao.ufSigla,
      licitacao.municipioNome,
      licitacao.codigoIbge,
      licitacao.amparoLegalCodigo,
      licitacao.amparoLegalNome,
      licitacao.amparoLegalDescricao,
      licitacao.linkProcessoEletronico,
      licitacao.linkSistemaOrigem,
      licitacao.informacaoComplementar,
      licitacao.justificativaPresencial,
      licitacao.srp,
    ];

    const row = await this.db.queryOne<any>(query, params);
    return this.mapRowToLicitacao(row!);
  }

  /**
   * Busca uma licitação por ID.
   */
  public async buscarPorId(id: string): Promise<Licitacao | null> {
    const query = 'SELECT * FROM licitacoes WHERE id = $1';
    const row = await this.db.queryOne<any>(query, [id]);

    if (!row) return null;
    return this.mapRowToLicitacao(row);
  }

  /**
   * Busca uma licitação pelo numeroControlePNCP
   */
  public async findByNumeroControlePNCP(numeroControlePNCP: string): Promise<Licitacao | null> {
    const query = 'SELECT * FROM licitacoes WHERE numero_controle_pncp = $1';
    const row = await this.db.queryOne<any>(query, [numeroControlePNCP]);

    if (!row) return null;
    return this.mapRowToLicitacao(row);
  }

  /**
   * Busca licitações por intervalo de datas de publicação
   */
  public async findByDataPublicacao(
    dataInicial: Date,
    dataFinal: Date
  ): Promise<Licitacao[]> {
    const query = `
      SELECT * FROM licitacoes 
      WHERE data_publicacao_pncp >= $1 AND data_publicacao_pncp <= $2
      ORDER BY data_publicacao_pncp ASC
    `;
    const rows = await this.db.query<any>(query, [dataInicial, dataFinal]);
    return rows.map(row => this.mapRowToLicitacao(row));
  }

  /**
   * Mapeia uma linha do banco para a entidade Licitacao
   */
  private mapRowToLicitacao(row: any): Licitacao {
    return new Licitacao({
      id: row.id,
      numeroControlePNCP: row.numero_controle_pncp,
      cnpjOrgao: row.cnpj_orgao,
      razaoSocialOrgao: row.razao_social_orgao,
      poderId: row.poder_id,
      esferaId: row.esfera_id,
      anoCompra: row.ano_compra,
      sequencialCompra: row.sequencial_compra,
      numeroCompra: row.numero_compra,
      processo: row.processo,
      objetoCompra: row.objeto_compra,
      modalidadeId: row.modalidade_id,
      modalidadeNome: row.modalidade_nome,
      situacaoCompraId: row.situacao_compra_id,
      situacaoCompraNome: row.situacao_compra_nome,
      valorTotalEstimado: row.valor_total_estimado ? parseFloat(row.valor_total_estimado) : undefined,
      valorTotalHomologado: row.valor_total_homologado ? parseFloat(row.valor_total_homologado) : undefined,
      dataPublicacaoPncp: row.data_publicacao_pncp,
      dataInclusao: row.data_inclusao,
      dataAtualizacao: row.data_atualizacao,
      dataAtualizacaoGlobal: row.data_atualizacao_global,
      codigoUnidade: row.codigo_unidade,
      nomeUnidade: row.nome_unidade,
      ufSigla: row.uf_sigla,
      municipioNome: row.municipio_nome,
      codigoIbge: row.codigo_ibge,
      amparoLegalCodigo: row.amparo_legal_codigo,
      amparoLegalNome: row.amparo_legal_nome,
      amparoLegalDescricao: row.amparo_legal_descricao,
      linkProcessoEletronico: row.link_processo_eletronico,
      linkSistemaOrigem: row.link_sistema_origem,
      informacaoComplementar: row.informacao_complementar,
      justificativaPresencial: row.justificativa_presencial,
      srp: row.srp,
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em,
    });
  }
}
