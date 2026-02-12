/**
 * Entidade de Domínio: PesquisaPreco
 * Representa uma pesquisa de preços criada pelo usuário.
 */
export class PesquisaPreco {
  public readonly id?: string;
  public readonly tenantId: string;
  public readonly usuarioId: string;
  public readonly nome: string;
  public readonly descricao?: string;
  public readonly status: string;
  public readonly criadoEm?: Date;
  public readonly atualizadoEm?: Date;

  constructor(data: {
    id?: string;
    tenantId: string;
    usuarioId: string;
    nome: string;
    descricao?: string;
    status?: string;
    criadoEm?: Date;
    atualizadoEm?: Date;
  }) {
    this.id = data.id;
    this.tenantId = data.tenantId;
    this.usuarioId = data.usuarioId;
    this.nome = data.nome;
    this.descricao = data.descricao;
    this.status = data.status ?? 'rascunho';
    this.criadoEm = data.criadoEm;
    this.atualizadoEm = data.atualizadoEm;
  }
}
