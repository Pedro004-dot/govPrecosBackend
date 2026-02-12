/**
 * Resultado do cálculo estatístico sobre uma lista de preços.
 */
export interface ResultadoEstatisticas {
  media: number;
  mediana: number;
  menorPreco: number;
  maiorPreco: number;
  desvioPadrao: number;
  /** Índices (na lista original) dos preços considerados outliers (critério IQR). */
  outliers: number[];
  /** Quantidade de preços considerados na amostra (excluindo null/undefined). */
  quantidade: number;
}

/**
 * Serviço com funções puras para estatísticas descritivas e detecção de outliers (IQR).
 */
export class CalculadoraEstatisticaService {
  /**
   * Calcula média, mediana, menor/maior preço, desvio padrão e identifica outliers por IQR.
   * @param precos Lista de preços (ex.: valorUnitarioEstimado); valores inválidos são ignorados.
   */
  public calcular(precos: number[]): ResultadoEstatisticas {
    const validos = precos.filter((p) => typeof p === 'number' && !Number.isNaN(p) && p > 0);
    const quantidade = validos.length;

    if (quantidade === 0) {
      return {
        media: 0,
        mediana: 0,
        menorPreco: 0,
        maiorPreco: 0,
        desvioPadrao: 0,
        outliers: [],
        quantidade: 0,
      };
    }

    const media = this.media(validos);
    const mediana = this.mediana(validos);
    const menorPreco = Math.min(...validos);
    const maiorPreco = Math.max(...validos);
    const desvioPadrao = this.desvioPadrao(validos, media);
    const outliers = this.outliersPorIQR(validos);

    return {
      media,
      mediana,
      menorPreco,
      maiorPreco,
      desvioPadrao,
      outliers,
      quantidade,
    };
  }

  public media(valores: number[]): number {
    if (valores.length === 0) return 0;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  }

  public mediana(valores: number[]): number {
    if (valores.length === 0) return 0;
    const sorted = [...valores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  public desvioPadrao(valores: number[], media?: number): number {
    if (valores.length === 0) return 0;
    const m = media ?? this.media(valores);
    const somaQuadrados = valores.reduce((acc, v) => acc + (v - m) ** 2, 0);
    return Math.sqrt(somaQuadrados / valores.length);
  }

  /**
   * Retorna os índices (em relação ao array passado) dos valores considerados outliers pelo critério IQR.
   * Limite inferior = Q1 - 1.5*IQR, limite superior = Q3 + 1.5*IQR.
   */
  public outliersPorIQR(valores: number[]): number[] {
    if (valores.length < 4) return [];
    const sorted = [...valores].sort((a, b) => a - b);
    const q1 = this.quartil(sorted, 0.25);
    const q3 = this.quartil(sorted, 0.75);
    const iqr = q3 - q1;
    const limiteInferior = q1 - 1.5 * iqr;
    const limiteSuperior = q3 + 1.5 * iqr;

    const indices: number[] = [];
    valores.forEach((v, i) => {
      if (v < limiteInferior || v > limiteSuperior) indices.push(i);
    });
    return indices;
  }

  private quartil(sorted: number[], p: number): number {
    const index = p * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
  }
}
