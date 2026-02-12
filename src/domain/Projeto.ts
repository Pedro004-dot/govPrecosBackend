/**
 * Entidade de Domínio: Projeto
 * Representa um projeto de pesquisa de preços conforme Lei 14.133/2021.
 * Substitui o modelo antigo de "pesquisas_preco" com estrutura hierárquica Projeto → Itens → Fontes.
 */
export class Projeto {
  public readonly id?: string;
  public readonly tenantId: string;
  public readonly usuarioId: string;
  public readonly nome: string;
  public readonly descricao?: string;
  public readonly numeroProcesso?: string;
  public readonly objeto?: string;
  public readonly status: 'rascunho' | 'em_andamento' | 'finalizado' | 'cancelado';
  public readonly dataFinalizacao?: Date;
  public readonly criadoEm?: Date;
  public readonly atualizadoEm?: Date;

  constructor(data: {
    id?: string;
    tenantId: string;
    usuarioId: string;
    nome: string;
    descricao?: string;
    numeroProcesso?: string;
    objeto?: string;
    status?: 'rascunho' | 'em_andamento' | 'finalizado' | 'cancelado';
    dataFinalizacao?: Date;
    criadoEm?: Date;
    atualizadoEm?: Date;
  }) {
    this.id = data.id;
    this.tenantId = data.tenantId;
    this.usuarioId = data.usuarioId;
    this.nome = data.nome;
    this.descricao = data.descricao;
    this.numeroProcesso = data.numeroProcesso;
    this.objeto = data.objeto;
    this.status = data.status ?? 'rascunho';
    this.dataFinalizacao = data.dataFinalizacao;
    this.criadoEm = data.criadoEm;
    this.atualizadoEm = data.atualizadoEm;
  }

  /**
   * Verifica se o projeto pode ser finalizado.
   * Um projeto só pode ser finalizado se estiver em status 'em_andamento' ou 'rascunho'.
   */
  public podeSerFinalizado(): boolean {
    return this.status === 'em_andamento' || this.status === 'rascunho';
  }

  /**
   * Verifica se o projeto está finalizado.
   */
  public isFinalizado(): boolean {
    return this.status === 'finalizado';
  }

  /**
   * Verifica se o projeto está ativo (não cancelado ou finalizado).
   */
  public isAtivo(): boolean {
    return this.status === 'rascunho' || this.status === 'em_andamento';
  }
}
