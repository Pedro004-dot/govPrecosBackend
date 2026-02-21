/**
 * Tipos de tenant (prefeitura ou câmara)
 */
export type TipoTenant = 'prefeitura' | 'camara';

/**
 * Entidade de domínio para Tenant (Prefeitura/Câmara)
 */
export class Tenant {
  constructor(
    public readonly id: string,
    public readonly cnpj: string,
    public readonly nome: string,
    public readonly tipo: TipoTenant,
    public readonly ativo: boolean,
    public readonly criadoEm: Date,
    public readonly atualizadoEm: Date,
    public readonly brasaoUrl?: string
  ) {}

  /**
   * Verifica se o tenant está ativo
   */
  public isAtivo(): boolean {
    return this.ativo;
  }

  /**
   * Verifica se é uma prefeitura
   */
  public isPrefeitura(): boolean {
    return this.tipo === 'prefeitura';
  }

  /**
   * Verifica se é uma câmara
   */
  public isCamara(): boolean {
    return this.tipo === 'camara';
  }

  /**
   * Converte para objeto de resposta da API
   */
  public toJson() {
    return {
      id: this.id,
      cnpj: this.cnpj,
      nome: this.nome,
      tipo: this.tipo,
      ativo: this.ativo,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm,
      brasaoUrl: this.brasaoUrl,
    };
  }

  /**
   * Cria instância a partir de row do banco
   */
  public static fromRow(row: any): Tenant {
    return new Tenant(
      row.id,
      row.cnpj,
      row.nome,
      row.tipo as TipoTenant,
      row.ativo ?? true,
      new Date(row.criado_em),
      new Date(row.atualizado_em),
      row.brasao_url || undefined
    );
  }
}
