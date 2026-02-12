import axios, { AxiosInstance } from 'axios';
import { Licitacao } from '../domain/Licitacao';
import { ItemLicitacao } from '../domain/ItemLicitacao';
import type {
  PncpLicitacaoRaw,
  PncpRespostaPublicacao,
  PncpItemRaw,
} from './pncp.types';

const BASE_PUBLICACAO = 'https://pncp.gov.br/api/consulta/v1/contratacoes';
const BASE_ITENS = 'https://pncp.gov.br/pncp-api/v1';

/**
 * Gateway que encapsula as chamadas às APIs do PNCP.
 * Traduz o JSON bruto para entidades de domínio.
 */
export class GovernoApiGateway {
  private client: AxiosInstance;

  constructor(timeoutMs: number = 30000) {
    this.client = axios.create({
      timeout: timeoutMs,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Formata Date para YYYYMMDD (formato esperado pela API)
   */
  private formatDateToApi(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  /**
   * Converte string ISO ou null para Date
   */
  private parseDate(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }

  /**
   * Mapeia um item bruto da API 1 ou 2 para a entidade Licitacao
   */
  private mapRawToLicitacao(raw: PncpLicitacaoRaw): Licitacao {
    const orgao = raw.orgaoEntidade;
    const unidade = raw.unidadeOrgao;
    const amparo = raw.amparoLegal;

    return new Licitacao({
      numeroControlePNCP: raw.numeroControlePNCP,
      cnpjOrgao: orgao?.cnpj ?? '',
      razaoSocialOrgao: orgao?.razaoSocial,
      poderId: orgao?.poderId,
      esferaId: orgao?.esferaId,
      anoCompra: raw.anoCompra,
      sequencialCompra: raw.sequencialCompra,
      numeroCompra: raw.numeroCompra,
      processo: raw.processo,
      objetoCompra: raw.objetoCompra,
      modalidadeId: raw.modalidadeId,
      modalidadeNome: raw.modalidadeNome,
      situacaoCompraId: raw.situacaoCompraId,
      situacaoCompraNome: raw.situacaoCompraNome,
      valorTotalEstimado: raw.valorTotalEstimado,
      valorTotalHomologado: raw.valorTotalHomologado,
      dataPublicacaoPncp: this.parseDate(raw.dataPublicacaoPncp) ?? new Date(),
      dataInclusao: this.parseDate(raw.dataInclusao),
      dataAtualizacao: this.parseDate(raw.dataAtualizacao),
      dataAtualizacaoGlobal: this.parseDate(raw.dataAtualizacaoGlobal),
      codigoUnidade: unidade?.codigoUnidade,
      nomeUnidade: unidade?.nomeUnidade,
      ufSigla: unidade?.ufSigla,
      municipioNome: unidade?.municipioNome,
      codigoIbge: unidade?.codigoIbge,
      amparoLegalCodigo: amparo?.codigo,
      amparoLegalNome: amparo?.nome,
      amparoLegalDescricao: amparo?.descricao,
      linkProcessoEletronico: raw.linkProcessoEletronico,
      linkSistemaOrigem: raw.linkSistemaOrigem,
      informacaoComplementar: raw.informacaoComplementar,
      justificativaPresencial: raw.justificativaPresencial,
      srp: raw.srp ?? false,
    });
  }

  /**
   * API 1: Busca editais por dia de publicação (histórico)
   */
  public async buscarHistorico(
    dataInicial: Date,
    dataFinal: Date,
    codigoModalidadeContratacao: number,
    pagina: number
  ): Promise<{ licitacoes: Licitacao[]; totalPaginas: number; totalRegistros: number }> {
    const dataIni = this.formatDateToApi(dataInicial);
    const dataFim = this.formatDateToApi(dataFinal);

    console.log(`[Gateway] API 1 (publicação): página ${pagina}, ${dataIni} a ${dataFim}`);
    const { data } = await this.client.get<PncpRespostaPublicacao>(
      `${BASE_PUBLICACAO}/publicacao`,
      {
        params: {
          dataInicial: dataIni,
          dataFinal: dataFim,
          codigoModalidadeContratacao,
          pagina,
        },
      }
    );

    const licitacoes = (data.data ?? []).map((raw) => this.mapRawToLicitacao(raw));
    return {
      licitacoes,
      totalPaginas: data.totalPaginas ?? 1,
      totalRegistros: data.totalRegistros ?? 0,
    };
  }

  /**
   * API 2: Busca atualizações de editais por dia
   */
  public async buscarAtualizacoesSemanais(
    dataInicial: Date,
    dataFinal: Date,
    codigoModalidadeContratacao: number,
    pagina: number
  ): Promise<{ licitacoes: Licitacao[]; totalPaginas: number; totalRegistros: number }> {
    const dataIni = this.formatDateToApi(dataInicial);
    const dataFim = this.formatDateToApi(dataFinal);

    console.log(`[Gateway] API 2 (atualização): página ${pagina}, ${dataIni} a ${dataFim}`);
    const { data } = await this.client.get<PncpRespostaPublicacao>(
      `${BASE_PUBLICACAO}/atualizacao`,
      {
        params: {
          dataInicial: dataIni,
          dataFinal: dataFim,
          codigoModalidadeContratacao,
          pagina,
        },
      }
    );

    const licitacoes = (data.data ?? []).map((raw) => this.mapRawToLicitacao(raw));
    return {
      licitacoes,
      totalPaginas: data.totalPaginas ?? 1,
      totalRegistros: data.totalRegistros ?? 0,
    };
  }

  /**
   * API 3: Busca itens de uma licitação (CNPJ, ano, sequencial)
   * @param licitacaoId ID da licitação no nosso banco (para vincular os itens)
   */
  public async buscarDetalhesItem(
    cnpj: string,
    anoCompra: number,
    sequencialCompra: number,
    licitacaoId: string = ''
  ): Promise<ItemLicitacao[]> {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    const url = `${BASE_ITENS}/orgaos/${cnpjLimpo}/compras/${anoCompra}/${sequencialCompra}/itens`;

    console.log(`[Gateway] API 3 (itens): ${cnpjLimpo} / ${anoCompra}/${sequencialCompra}`);
    const { data } = await this.client.get<PncpItemRaw[]>(url);

    if (!Array.isArray(data)) return [];

    return data.map((raw) => this.mapRawToItemLicitacao(raw, licitacaoId));
  }

  /**
   * Mapeia item bruto da API 3 para ItemLicitacao (licitacaoId deve ser setado pelo caller)
   */
  public mapRawToItemLicitacao(raw: PncpItemRaw, licitacaoId: string): ItemLicitacao {
    return new ItemLicitacao({
      licitacaoId,
      numeroItem: raw.numeroItem,
      descricao: raw.descricao,
      materialOuServico: raw.materialOuServico,
      materialOuServicoNome: raw.materialOuServicoNome,
      valorUnitarioEstimado: raw.valorUnitarioEstimado,
      valorTotal: raw.valorTotal,
      quantidade: raw.quantidade,
      unidadeMedida: raw.unidadeMedida,
      situacaoCompraItem: raw.situacaoCompraItem,
      situacaoCompraItemNome: raw.situacaoCompraItemNome,
      criterioJulgamentoId: raw.criterioJulgamentoId,
      criterioJulgamentoNome: raw.criterioJulgamentoNome,
      itemCategoriaId: raw.itemCategoriaId,
      itemCategoriaNome: raw.itemCategoriaNome,
      ncmNbsCodigo: raw.ncmNbsCodigo,
      ncmNbsDescricao: raw.ncmNbsDescricao,
      catalogoCodigoItem: raw.catalogoCodigoItem,
      informacaoComplementar: raw.informacaoComplementar,
      orcamentoSigiloso: raw.orcamentoSigiloso ?? false,
      temResultado: raw.temResultado ?? false,
      dataInclusao: this.parseDate(raw.dataInclusao),
      dataAtualizacao: this.parseDate(raw.dataAtualizacao),
    });
  }
}
