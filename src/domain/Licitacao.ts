/**
 * Entidade de Domínio: Licitacao
 * Representa uma licitação coletada do PNCP
 */
export class Licitacao {
  public readonly id?: string;
  public readonly numeroControlePNCP: string;
  public readonly cnpjOrgao: string;
  public readonly razaoSocialOrgao?: string;
  public readonly poderId?: string;
  public readonly esferaId?: string;
  public readonly anoCompra: number;
  public readonly sequencialCompra: number;
  public readonly numeroCompra?: string;
  public readonly processo?: string;
  public readonly objetoCompra?: string;
  public readonly modalidadeId?: number;
  public readonly modalidadeNome?: string;
  public readonly situacaoCompraId?: number;
  public readonly situacaoCompraNome?: string;
  public readonly valorTotalEstimado?: number;
  public readonly valorTotalHomologado?: number;
  public readonly dataPublicacaoPncp: Date;
  public readonly dataInclusao?: Date;
  public readonly dataAtualizacao?: Date;
  public readonly dataAtualizacaoGlobal?: Date;
  public readonly codigoUnidade?: string;
  public readonly nomeUnidade?: string;
  public readonly ufSigla?: string;
  public readonly municipioNome?: string;
  public readonly codigoIbge?: string;
  public readonly amparoLegalCodigo?: number;
  public readonly amparoLegalNome?: string;
  public readonly amparoLegalDescricao?: string;
  public readonly linkProcessoEletronico?: string;
  public readonly linkSistemaOrigem?: string;
  public readonly informacaoComplementar?: string;
  public readonly justificativaPresencial?: string;
  public readonly srp: boolean;
  public readonly criadoEm?: Date;
  public readonly atualizadoEm?: Date;

  constructor(data: {
    id?: string;
    numeroControlePNCP: string;
    cnpjOrgao: string;
    razaoSocialOrgao?: string;
    poderId?: string;
    esferaId?: string;
    anoCompra: number;
    sequencialCompra: number;
    numeroCompra?: string;
    processo?: string;
    objetoCompra?: string;
    modalidadeId?: number;
    modalidadeNome?: string;
    situacaoCompraId?: number;
    situacaoCompraNome?: string;
    valorTotalEstimado?: number;
    valorTotalHomologado?: number;
    dataPublicacaoPncp: Date;
    dataInclusao?: Date;
    dataAtualizacao?: Date;
    dataAtualizacaoGlobal?: Date;
    codigoUnidade?: string;
    nomeUnidade?: string;
    ufSigla?: string;
    municipioNome?: string;
    codigoIbge?: string;
    amparoLegalCodigo?: number;
    amparoLegalNome?: string;
    amparoLegalDescricao?: string;
    linkProcessoEletronico?: string;
    linkSistemaOrigem?: string;
    informacaoComplementar?: string;
    justificativaPresencial?: string;
    srp?: boolean;
    criadoEm?: Date;
    atualizadoEm?: Date;
  }) {
    this.id = data.id;
    this.numeroControlePNCP = data.numeroControlePNCP;
    this.cnpjOrgao = data.cnpjOrgao;
    this.razaoSocialOrgao = data.razaoSocialOrgao;
    this.poderId = data.poderId;
    this.esferaId = data.esferaId;
    this.anoCompra = data.anoCompra;
    this.sequencialCompra = data.sequencialCompra;
    this.numeroCompra = data.numeroCompra;
    this.processo = data.processo;
    this.objetoCompra = data.objetoCompra;
    this.modalidadeId = data.modalidadeId;
    this.modalidadeNome = data.modalidadeNome;
    this.situacaoCompraId = data.situacaoCompraId;
    this.situacaoCompraNome = data.situacaoCompraNome;
    this.valorTotalEstimado = data.valorTotalEstimado;
    this.valorTotalHomologado = data.valorTotalHomologado;
    this.dataPublicacaoPncp = data.dataPublicacaoPncp;
    this.dataInclusao = data.dataInclusao;
    this.dataAtualizacao = data.dataAtualizacao;
    this.dataAtualizacaoGlobal = data.dataAtualizacaoGlobal;
    this.codigoUnidade = data.codigoUnidade;
    this.nomeUnidade = data.nomeUnidade;
    this.ufSigla = data.ufSigla;
    this.municipioNome = data.municipioNome;
    this.codigoIbge = data.codigoIbge;
    this.amparoLegalCodigo = data.amparoLegalCodigo;
    this.amparoLegalNome = data.amparoLegalNome;
    this.amparoLegalDescricao = data.amparoLegalDescricao;
    this.linkProcessoEletronico = data.linkProcessoEletronico;
    this.linkSistemaOrigem = data.linkSistemaOrigem;
    this.informacaoComplementar = data.informacaoComplementar;
    this.justificativaPresencial = data.justificativaPresencial;
    this.srp = data.srp ?? false;
    this.criadoEm = data.criadoEm;
    this.atualizadoEm = data.atualizadoEm;
  }

  /**
   * Verifica se a licitação foi homologada (valorTotalHomologado > 1)
   */
  public isHomologada(): boolean {
    return (this.valorTotalHomologado ?? 0) > 1;
  }
}
