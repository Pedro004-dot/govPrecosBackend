/**
 * Entidade de Domínio: ProjetoItem
 * Representa um item definido manualmente pelo usuário dentro de um projeto.
 * Diferente de ItemLicitacao (que vem do PNCP), este é criado pelo usuário
 * e vincula múltiplas fontes PNCP como referências de preço.
 */
export class ProjetoItem {
  public readonly id?: string;
  public readonly projetoId: string;
  public readonly nome: string;
  public readonly descricao?: string;
  public readonly quantidade: number;
  public readonly unidadeMedida: string;
  public readonly ordem?: number;
  public readonly medianaCalculada?: number;
  public readonly quantidadeFontes: number;
  public readonly observacoes?: string;
  public readonly criadoEm?: Date;
  public readonly atualizadoEm?: Date;

  constructor(data: {
    id?: string;
    projetoId: string;
    nome: string;
    descricao?: string;
    quantidade: number;
    unidadeMedida: string;
    ordem?: number;
    medianaCalculada?: number;
    quantidadeFontes?: number;
    observacoes?: string;
    criadoEm?: Date;
    atualizadoEm?: Date;
  }) {
    this.id = data.id;
    this.projetoId = data.projetoId;
    this.nome = data.nome;
    this.descricao = data.descricao;
    this.quantidade = data.quantidade;
    this.unidadeMedida = data.unidadeMedida;
    this.ordem = data.ordem;
    this.medianaCalculada = data.medianaCalculada;
    this.quantidadeFontes = data.quantidadeFontes ?? 0;
    this.observacoes = data.observacoes;
    this.criadoEm = data.criadoEm;
    this.atualizadoEm = data.atualizadoEm;
  }

  /**
   * Verifica se o item possui o mínimo de 3 fontes exigido pela Lei 14.133/2021.
   */
  public temFontesSuficientes(): boolean {
    return this.quantidadeFontes >= 3;
  }

  /**
   * Retorna quantas fontes faltam para atingir o mínimo de 3.
   */
  public fontesFaltantes(): number {
    return Math.max(0, 3 - this.quantidadeFontes);
  }

  /**
   * Verifica se o item possui mediana calculada.
   */
  public temMedianaCalculada(): boolean {
    return this.medianaCalculada !== null && this.medianaCalculada !== undefined && this.medianaCalculada > 0;
  }

  /**
   * Calcula o valor total estimado (mediana × quantidade).
   */
  public getValorTotalEstimado(): number | null {
    if (!this.temMedianaCalculada()) {
      return null;
    }
    return this.medianaCalculada! * this.quantidade;
  }
}
