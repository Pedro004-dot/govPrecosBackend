/**
 * Entidade de Domínio: ItemLicitacao
 * Representa um item de uma licitação coletado do PNCP
 */
export class ItemLicitacao {
  public readonly id?: string;
  public readonly licitacaoId: string;
  public readonly numeroItem: number;
  public readonly descricao: string;
  public readonly materialOuServico?: string;
  public readonly materialOuServicoNome?: string;
  public readonly valorUnitarioEstimado?: number;
  public readonly valorTotal?: number;
  public readonly quantidade?: number;
  public readonly unidadeMedida?: string;
  public readonly situacaoCompraItem?: number;
  public readonly situacaoCompraItemNome?: string;
  public readonly criterioJulgamentoId?: number;
  public readonly criterioJulgamentoNome?: string;
  public readonly itemCategoriaId?: number;
  public readonly itemCategoriaNome?: string;
  public readonly ncmNbsCodigo?: string;
  public readonly ncmNbsDescricao?: string;
  public readonly catalogoCodigoItem?: string;
  public readonly informacaoComplementar?: string;
  public readonly orcamentoSigiloso: boolean;
  public readonly temResultado: boolean;
  public readonly dataInclusao?: Date;
  public readonly dataAtualizacao?: Date;
  public readonly criadoEm?: Date;
  public readonly atualizadoEm?: Date;

  constructor(data: {
    id?: string;
    licitacaoId: string;
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
    dataInclusao?: Date;
    dataAtualizacao?: Date;
    criadoEm?: Date;
    atualizadoEm?: Date;
  }) {
    this.id = data.id;
    this.licitacaoId = data.licitacaoId;
    this.numeroItem = data.numeroItem;
    this.descricao = data.descricao;
    this.materialOuServico = data.materialOuServico;
    this.materialOuServicoNome = data.materialOuServicoNome;
    this.valorUnitarioEstimado = data.valorUnitarioEstimado;
    this.valorTotal = data.valorTotal;
    this.quantidade = data.quantidade;
    this.unidadeMedida = data.unidadeMedida;
    this.situacaoCompraItem = data.situacaoCompraItem;
    this.situacaoCompraItemNome = data.situacaoCompraItemNome;
    this.criterioJulgamentoId = data.criterioJulgamentoId;
    this.criterioJulgamentoNome = data.criterioJulgamentoNome;
    this.itemCategoriaId = data.itemCategoriaId;
    this.itemCategoriaNome = data.itemCategoriaNome;
    this.ncmNbsCodigo = data.ncmNbsCodigo;
    this.ncmNbsDescricao = data.ncmNbsDescricao;
    this.catalogoCodigoItem = data.catalogoCodigoItem;
    this.informacaoComplementar = data.informacaoComplementar;
    this.orcamentoSigiloso = data.orcamentoSigiloso ?? false;
    this.temResultado = data.temResultado ?? false;
    this.dataInclusao = data.dataInclusao;
    this.dataAtualizacao = data.dataAtualizacao;
    this.criadoEm = data.criadoEm;
    this.atualizadoEm = data.atualizadoEm;
  }
}
