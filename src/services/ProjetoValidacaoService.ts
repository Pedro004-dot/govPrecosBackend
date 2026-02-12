import { ProjetoRepository } from '../repositories/ProjetoRepository';
import { ProjetoItemRepository } from '../repositories/ProjetoItemRepository';
import { ItemFonteRepository } from '../repositories/ItemFonteRepository';
import { CalculadoraEstatisticaService } from './CalculadoraEstatisticaService';

/**
 * Mensagem de validação com nível de severidade.
 */
export interface ValidationMessage {
  tipo: string;
  nivel: 'erro' | 'aviso' | 'info';
  mensagem: string;
  itemId?: string;
  fonteId?: string;
  dados?: any;
}

/**
 * Resultado de validação de um projeto.
 */
export interface ValidationResult {
  valido: boolean;
  erros: ValidationMessage[];
  avisos: ValidationMessage[];
  infos: ValidationMessage[];
}

/**
 * Service para validar compliance de projetos conforme Lei 14.133/2021.
 */
export class ProjetoValidacaoService {
  constructor(
    private projetoRepo: ProjetoRepository,
    private itemRepo: ProjetoItemRepository,
    private fonteRepo: ItemFonteRepository,
    private calculadora: CalculadoraEstatisticaService
  ) {}

  /**
   * Valida um projeto completo.
   * Verifica: mínimo 3 fontes por item, recência, outliers.
   */
  public async validarProjeto(projetoId: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valido: true,
      erros: [],
      avisos: [],
      infos: []
    };

    // 1. Validar mínimo de 3 fontes por item
    await this.validarMinimo3Fontes(projetoId, result);

    // 2. Validar recência (fontes >12 meses)
    await this.validarRecencia(projetoId, result);

    // 3. Detectar outliers usando IQR
    await this.detectarOutliers(projetoId, result);

    // 4. Verificar itens sem mediana calculada
    await this.validarMedianas(projetoId, result);

    // Projeto só é válido se não houver erros
    result.valido = result.erros.length === 0;

    return result;
  }

  /**
   * Valida um item específico.
   */
  public async validarItem(itemId: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valido: true,
      erros: [],
      avisos: [],
      infos: []
    };

    const item = await this.itemRepo.buscarPorId(itemId);
    if (!item) {
      result.erros.push({
        tipo: 'item_not_found',
        nivel: 'erro',
        mensagem: 'Item não encontrado',
        itemId
      });
      result.valido = false;
      return result;
    }

    // 1. Verificar mínimo de 3 fontes
    if (!item.temFontesSuficientes()) {
      result.erros.push({
        tipo: 'minimum_sources',
        nivel: 'erro',
        mensagem: `Item "${item.nome}" precisa de ${item.fontesFaltantes()} fonte(s) adicional(is) para cumprir o mínimo de 3 fontes (Lei 14.133/2021).`,
        itemId: item.id,
        dados: { quantidadeAtual: item.quantidadeFontes, faltantes: item.fontesFaltantes() }
      });
      result.valido = false;
    }

    // 2. Verificar se tem mediana calculada
    if (item.temFontesSuficientes() && !item.temMedianaCalculada()) {
      result.avisos.push({
        tipo: 'mediana_missing',
        nivel: 'aviso',
        mensagem: `Item "${item.nome}" tem ${item.quantidadeFontes} fontes mas mediana não calculada. Execute recálculo.`,
        itemId: item.id
      });
    }

    // 3. Verificar recência das fontes
    const fontes = await this.fonteRepo.listarFontesPorItem(itemId);
    for (const fonte of fontes) {
      if (fonte.isAntiga(12) && !fonte.isIgnorada()) {
        const idadeMeses = fonte.getIdadeMeses();
        result.avisos.push({
          tipo: 'recency_check',
          nivel: 'aviso',
          mensagem: `Fonte com ${idadeMeses} meses de idade (>12 meses). Priorize fontes mais recentes conforme Lei 14.133/2021.`,
          itemId: item.id,
          fonteId: fonte.id,
          dados: { idadeMeses, dataLicitacao: fonte.dataLicitacao }
        });
      }
    }

    return result;
  }

  /**
   * Valida mínimo de 3 fontes por item.
   */
  private async validarMinimo3Fontes(projetoId: string, result: ValidationResult): Promise<void> {
    const itensPendentes = await this.itemRepo.getItensComFontesInsuficientes(projetoId);

    if (itensPendentes.length > 0) {
      result.valido = false;
      for (const item of itensPendentes) {
        result.erros.push({
          tipo: 'minimum_sources',
          nivel: 'erro',
          mensagem: `Item "${item.nome}" possui apenas ${item.quantidadeFontesAtual} fonte(s). Faltam ${item.fontesFaltantes} para atingir o mínimo de 3 fontes exigido pela Lei 14.133/2021.`,
          itemId: item.itemId,
          dados: item
        });
      }
    }
  }

  /**
   * Valida recência das fontes (>12 meses = aviso).
   */
  private async validarRecencia(projetoId: string, result: ValidationResult): Promise<void> {
    const fontesAntigas = await this.fonteRepo.verificarRecencia(projetoId, 12);

    for (const fonte of fontesAntigas) {
      result.avisos.push({
        tipo: 'recency_check',
        nivel: 'aviso',
        mensagem: `Item "${fonte.itemNome}" possui fonte com ${fonte.idadeMeses} meses de idade. A Lei 14.133/2021 recomenda priorizar preços de até 12 meses.`,
        itemId: fonte.itemId,
        fonteId: fonte.fonteId,
        dados: fonte
      });
    }
  }

  /**
   * Detecta outliers usando método IQR.
   * INFO level apenas - usuário decide se ignora.
   */
  private async detectarOutliers(projetoId: string, result: ValidationResult): Promise<void> {
    const itens = await this.itemRepo.listarPorProjeto(projetoId);

    for (const item of itens) {
      if (item.quantidadeFontes < 3) {
        continue; // Pula itens sem fontes suficientes
      }

      const fontes = await this.fonteRepo.listarFontesPorItem(item.id!);
      const fontesIncluidas = fontes.filter(f => !f.ignoradoCalculo);

      if (fontesIncluidas.length < 3) {
        continue; // Precisa de pelo menos 3 fontes não-ignoradas
      }

      // Calcular estatísticas
      const precos = fontesIncluidas.map(f => f.valorUnitario);
      const stats = this.calculadora.calcular(precos);

      // Verificar se há outliers detectados
      if (stats.outliers && stats.outliers.length > 0) {
        for (const outlierIndex of stats.outliers) {
          const fonte = fontesIncluidas[outlierIndex];
          const desvioPercentual = ((fonte.valorUnitario - stats.mediana!) / stats.mediana!) * 100;

          result.infos.push({
            tipo: 'outlier_review',
            nivel: 'info',
            mensagem: `Item "${item.nome}": fonte com preço R$ ${fonte.valorUnitario.toFixed(4)} identificada como outlier (${desvioPercentual > 0 ? '+' : ''}${desvioPercentual.toFixed(1)}% da mediana). Revise e considere excluir do cálculo.`,
            itemId: item.id,
            fonteId: fonte.id,
            dados: {
              valorFonte: fonte.valorUnitario,
              mediana: stats.mediana,
              desvioPercentual: desvioPercentual.toFixed(1)
            }
          });
        }
      }
    }
  }

  /**
   * Valida se todos os itens com fontes suficientes têm mediana calculada.
   */
  private async validarMedianas(projetoId: string, result: ValidationResult): Promise<void> {
    const itens = await this.itemRepo.listarPorProjeto(projetoId);

    for (const item of itens) {
      if (item.temFontesSuficientes() && !item.temMedianaCalculada()) {
        result.avisos.push({
          tipo: 'mediana_missing',
          nivel: 'aviso',
          mensagem: `Item "${item.nome}" possui ${item.quantidadeFontes} fontes mas mediana não foi calculada. Execute o recálculo.`,
          itemId: item.id
        });
      }
    }
  }
}
