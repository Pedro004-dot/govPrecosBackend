import { Request, Response } from 'express';
import { SincronizadorGovernoService } from '../services/SincronizadorGovernoService';

/**
 * Controller que expõe endpoints de sincronização com o PNCP.
 */
export class SincronizacaoController {
  constructor(private readonly sincronizadorService: SincronizadorGovernoService) {}

  /**
   * POST /api/admin/sincronizar-historico
   * Body opcional: { dataInicial?: string (YYYYMMDD), dataFinal?: string (YYYYMMDD), codigoModalidadeContratacao?: number }
   */
  public async sincronizarHistorico(req: Request, res: Response): Promise<void> {
    try {
      const { dataInicial, dataFinal, codigoModalidadeContratacao } = req.body ?? {};
      const { dataIni, dataFim } = this.parseDatas(dataInicial, dataFinal);

      console.log('[Admin] Sincronizar histórico: início', {
        dataInicial: dataIni.toISOString().slice(0, 10),
        dataFinal: dataFim.toISOString().slice(0, 10),
        codigoModalidade: codigoModalidadeContratacao ?? 8,
      });

      const resultado = await this.sincronizadorService.sincronizarHistorico(
        dataIni,
        dataFim,
        codigoModalidadeContratacao ?? 8
      );

      console.log('[Admin] Sincronizar histórico: concluído', {
        totalProcessadas: resultado.totalProcessadas,
        totalSalvas: resultado.totalSalvas,
        totalItensEnriquecidos: resultado.totalItensEnriquecidos,
        erros: resultado.erros.length,
      });

      res.status(200).json({
        success: true,
        message: 'Sincronização de histórico concluída',
        resultado,
      });
    } catch (error) {
      console.error('[Admin] Sincronizar histórico: erro', error);
      const message = error instanceof Error ? error.message : 'Erro ao sincronizar histórico';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/admin/sincronizar-atualizacoes
   * Body opcional: { dataInicial?, dataFinal?, codigoModalidadeContratacao? }
   */
  public async sincronizarAtualizacoes(req: Request, res: Response): Promise<void> {
    try {
      const { dataInicial, dataFinal, codigoModalidadeContratacao } = req.body ?? {};
      const { dataIni, dataFim } = this.parseDatas(dataInicial, dataFinal);

      console.log('[Admin] Sincronizar atualizações: início', {
        dataInicial: dataIni.toISOString().slice(0, 10),
        dataFinal: dataFim.toISOString().slice(0, 10),
        codigoModalidade: codigoModalidadeContratacao ?? 8,
      });

      const resultado = await this.sincronizadorService.sincronizarAtualizacoes(
        dataIni,
        dataFim,
        codigoModalidadeContratacao ?? 8
      );

      console.log('[Admin] Sincronizar atualizações: concluído', {
        totalProcessadas: resultado.totalProcessadas,
        totalSalvas: resultado.totalSalvas,
        totalItensEnriquecidos: resultado.totalItensEnriquecidos,
        erros: resultado.erros.length,
      });

      res.status(200).json({
        success: true,
        message: 'Sincronização de atualizações concluída',
        resultado,
      });
    } catch (error) {
      console.error('[Admin] Sincronizar atualizações: erro', error);
      const message = error instanceof Error ? error.message : 'Erro ao sincronizar atualizações';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * Converte strings YYYYMMDD ou ISO para Date. Default: hoje.
   */
  private parseDatas(
    dataInicial?: string,
    dataFinal?: string
  ): { dataIni: Date; dataFim: Date } {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const parse = (value: string | undefined): Date => {
      if (!value) return hoje;
      const trimmed = String(value).trim();
      if (/^\d{8}$/.test(trimmed)) {
        const y = parseInt(trimmed.slice(0, 4), 10);
        const m = parseInt(trimmed.slice(4, 6), 10) - 1;
        const d = parseInt(trimmed.slice(6, 8), 10);
        return new Date(y, m, d);
      }
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? hoje : d;
    };

    const dataIni = parse(dataInicial);
    const dataFim = parse(dataFinal);

    if (dataIni > dataFim) {
      return { dataIni: dataFim, dataFim: dataIni };
    }
    return { dataIni, dataFim };
  }
}
