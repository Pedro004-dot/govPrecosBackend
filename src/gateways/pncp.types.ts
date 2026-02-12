/**
 * Tipos das respostas brutas das APIs do PNCP
 */

export interface PncpOrgaoEntidade {
  cnpj: string;
  razaoSocial: string;
  poderId?: string;
  esferaId?: string;
}

export interface PncpUnidadeOrgao {
  ufNome?: string;
  codigoUnidade?: string;
  ufSigla?: string;
  municipioNome?: string;
  nomeUnidade?: string;
  codigoIbge?: string;
}

export interface PncpAmparoLegal {
  codigo?: number;
  nome?: string;
  descricao?: string;
}

export interface PncpLicitacaoRaw {
  numeroControlePNCP: string;
  orgaoEntidade: PncpOrgaoEntidade;
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
  dataPublicacaoPncp: string;
  dataInclusao?: string;
  dataAtualizacao?: string;
  dataAtualizacaoGlobal?: string;
  unidadeOrgao?: PncpUnidadeOrgao;
  amparoLegal?: PncpAmparoLegal;
  linkProcessoEletronico?: string;
  linkSistemaOrigem?: string;
  informacaoComplementar?: string;
  justificativaPresencial?: string;
  srp?: boolean;
}

export interface PncpRespostaPublicacao {
  data: PncpLicitacaoRaw[];
  totalRegistros: number;
  totalPaginas: number;
  numeroPagina: number;
  paginasRestantes: number;
  empty: boolean;
}

export interface PncpItemRaw {
  numeroItem: number;
  descricao: string;
  materialOuServico?: string;
  materialOuServicoNome?: string;
  valorUnitarioEstimado?: number;
  valorTotal?: number;
  quantidade?: number;
  unidadeMedida?: string;
  situacaoCompraItem?: number;
  situacaoCompraItemNome?: string;
  criterioJulgamentoId?: number;
  criterioJulgamentoNome?: string;
  itemCategoriaId?: number;
  itemCategoriaNome?: string;
  ncmNbsCodigo?: string;
  ncmNbsDescricao?: string;
  catalogoCodigoItem?: string;
  informacaoComplementar?: string;
  orcamentoSigiloso?: boolean;
  temResultado?: boolean;
  dataInclusao?: string;
  dataAtualizacao?: string;
}
