import { Request, Response } from 'express';
import { PesquisaPrecoRepository } from '../repositories/PesquisaPrecoRepository';
import { CalculadoraEstatisticaService } from '../services/CalculadoraEstatisticaService';
import { ItemLicitacao } from '../domain/ItemLicitacao';

/**
 * Controller para consolidar pesquisas e retornar estatísticas (média, mediana, outliers).
 */
export class ConsolidacaoController {
  constructor(
    private readonly pesquisaRepository: PesquisaPrecoRepository,
    private readonly calculadoraEstatistica: CalculadoraEstatisticaService
  ) {}

  /**
   * GET /api/pesquisas/:id/estatisticas — retorna estatísticas dos preços dos itens da pesquisa.
   */
  public async getEstatisticas(req: Request, res: Response): Promise<void> {
    try {
      const pesquisaId = req.params.id;
      if (!pesquisaId) {
        res.status(400).json({ success: false, message: 'id da pesquisa é obrigatório' });
        return;
      }

      const pesquisa = await this.pesquisaRepository.buscarPorId(pesquisaId);
      if (!pesquisa) {
        res.status(404).json({ success: false, message: 'Pesquisa não encontrada' });
        return;
      }

      const itens = await this.pesquisaRepository.buscarItensDaPesquisa(pesquisaId);
      const { precos, indicesPorPreco } = this.extrairPrecosEIndices(itens);
      const estatisticas = this.calculadoraEstatistica.calcular(precos);
      // Outliers são índices na lista de preços válidos; mapear para índice do item.
      const outlierItemIndices = new Set(estatisticas.outliers.map((i) => indicesPorPreco[i]));

      const itensComPreco = itens.map((item, index) => ({
        index,
        itemId: item.id,
        descricao: item.descricao,
        valorUnitarioEstimado: item.valorUnitarioEstimado,
        valorTotal: item.valorTotal,
        isOutlier: outlierItemIndices.has(index),
      }));

      res.json({
        success: true,
        pesquisaId,
        pesquisa: {
          id: pesquisa.id,
          nome: pesquisa.nome,
          status: pesquisa.status,
        },
        estatisticas: {
          media: estatisticas.media,
          mediana: estatisticas.mediana,
          menorPreco: estatisticas.menorPreco,
          maiorPreco: estatisticas.maiorPreco,
          desvioPadrao: estatisticas.desvioPadrao,
          quantidade: estatisticas.quantidade,
          outliers: estatisticas.outliers,
        },
        itens: itensComPreco,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao calcular estatísticas',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/pesquisas/:id/consolidar — calcula estatísticas e opcionalmente marca pesquisa como finalizada.
   */
  public async consolidar(req: Request, res: Response): Promise<void> {
    try {
      const pesquisaId = req.params.id;
      if (!pesquisaId) {
        res.status(400).json({ success: false, message: 'id da pesquisa é obrigatório' });
        return;
      }

      const pesquisa = await this.pesquisaRepository.buscarPorId(pesquisaId);
      if (!pesquisa) {
        res.status(404).json({ success: false, message: 'Pesquisa não encontrada' });
        return;
      }

      const itens = await this.pesquisaRepository.buscarItensDaPesquisa(pesquisaId);
      const { precos } = this.extrairPrecosEIndices(itens);
      const estatisticas = this.calculadoraEstatistica.calcular(precos);

      // Opcional: persistir status finalizada (se o repository tiver método atualizarStatus)
      // await this.pesquisaRepository.atualizarStatus(pesquisaId, 'finalizada');

      res.json({
        success: true,
        pesquisaId,
        message: 'Consolidação concluída',
        estatisticas: {
          media: estatisticas.media,
          mediana: estatisticas.mediana,
          menorPreco: estatisticas.menorPreco,
          maiorPreco: estatisticas.maiorPreco,
          desvioPadrao: estatisticas.desvioPadrao,
          quantidade: estatisticas.quantidade,
          outliers: estatisticas.outliers,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erro ao consolidar pesquisa',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Extrai preços válidos dos itens e o índice do item para cada preço (para mapear outliers).
   */
  private extrairPrecosEIndices(itens: ItemLicitacao[]): { precos: number[]; indicesPorPreco: number[] } {
    const precos: number[] = [];
    const indicesPorPreco: number[] = [];
    itens.forEach((item, index) => {
      const preco =
        item.valorUnitarioEstimado != null && item.valorUnitarioEstimado > 0
          ? item.valorUnitarioEstimado
          : item.valorTotal != null && item.valorTotal > 0
            ? item.valorTotal
            : 0;
      if (preco > 0) {
        precos.push(preco);
        indicesPorPreco.push(index);
      }
    });
    return { precos, indicesPorPreco };
  }
}
