import { Request, Response } from 'express';
import { RelatorioService } from '../services/RelatorioService';

/**
 * Controller para geração de relatórios (esqueleto; PDF real em etapa futura).
 */
export class RelatorioController {
  constructor(private readonly relatorioService: RelatorioService) {}

  /**
   * POST /api/pesquisas/:id/relatorio — body opcional: { tipo?: 'pdf' | 'word' }
   */
  public async gerar(req: Request, res: Response): Promise<void> {
    try {
      const pesquisaId = req.params.id;
      const tipo = (req.body?.tipo === 'word' ? 'word' : 'pdf') as 'pdf' | 'word';

      if (!pesquisaId) {
        res.status(400).json({ success: false, message: 'id da pesquisa é obrigatório' });
        return;
      }

      const resultado = await this.relatorioService.gerar(pesquisaId, tipo);

      res.status(201).json({
        success: true,
        message: 'Relatório registrado (geração real em etapa futura)',
        urlOuCaminho: resultado.urlOuCaminho,
        hash: resultado.hash,
        relatorioId: resultado.relatorioId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('não encontrada')) {
        res.status(404).json({ success: false, message });
        return;
      }
      res.status(500).json({
        success: false,
        message: 'Erro ao gerar relatório',
        error: message,
      });
    }
  }
}
