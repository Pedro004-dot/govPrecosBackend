/**
 * Entidade de Domínio: ItemFonte
 * Representa uma fonte PNCP (item de licitação) vinculada a um item do projeto.
 * A Lei 14.133/2021 exige mínimo de 3 fontes por item para justificar o preço estimado.
 */
export class ItemFonte {
  public readonly id?: string;
  public readonly projetoItemId: string;
  public readonly itemLicitacaoId: string;
  public readonly valorUnitario: number;
  public readonly ignoradoCalculo: boolean;
  public readonly justificativaExclusao?: string;
  public readonly dataLicitacao?: Date;
  public readonly criadoEm?: Date;
  public readonly atualizadoEm?: Date;

  constructor(data: {
    id?: string;
    projetoItemId: string;
    itemLicitacaoId: string;
    valorUnitario: number;
    ignoradoCalculo?: boolean;
    justificativaExclusao?: string;
    dataLicitacao?: Date;
    criadoEm?: Date;
    atualizadoEm?: Date;
  }) {
    this.id = data.id;
    this.projetoItemId = data.projetoItemId;
    this.itemLicitacaoId = data.itemLicitacaoId;
    this.valorUnitario = data.valorUnitario;
    this.ignoradoCalculo = data.ignoradoCalculo ?? false;
    this.justificativaExclusao = data.justificativaExclusao;
    this.dataLicitacao = data.dataLicitacao;
    this.criadoEm = data.criadoEm;
    this.atualizadoEm = data.atualizadoEm;
  }

  /**
   * Verifica se a fonte está incluída no cálculo da mediana.
   */
  public isIncluida(): boolean {
    return !this.ignoradoCalculo;
  }

  /**
   * Verifica se a fonte foi marcada como outlier/ignorada.
   */
  public isIgnorada(): boolean {
    return this.ignoradoCalculo;
  }

  /**
   * Verifica se a fonte é antiga (mais de X meses).
   * @param meses Número de meses para considerar "antiga" (padrão: 12 meses conforme Lei 14.133/2021)
   */
  public isAntiga(meses: number = 12): boolean {
    if (!this.dataLicitacao) {
      return false; // Se não tem data, assume que é recente
    }

    const hoje = new Date();
    const dataLimite = new Date();
    dataLimite.setMonth(dataLimite.getMonth() - meses);

    return this.dataLicitacao < dataLimite;
  }

  /**
   * Calcula a idade da fonte em meses.
   */
  public getIdadeMeses(): number | null {
    if (!this.dataLicitacao) {
      return null;
    }

    const hoje = new Date();
    const diffMs = hoje.getTime() - this.dataLicitacao.getTime();
    const diffMeses = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44)); // Aproximação de 30.44 dias/mês

    return diffMeses;
  }
}
