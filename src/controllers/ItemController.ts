import { Request, Response } from 'express';
import { ItemService } from '../services/ItemService';
import { PlanilhaCotacaoService } from '../services/PlanilhaCotacaoService';

/**
 * Controller para busca de itens (cotação) e upload de planilha.
 */
export class ItemController {
  constructor(
    private readonly itemService: ItemService,
    private readonly planilhaService: PlanilhaCotacaoService
  ) {}

  /**
   * GET /api/itens/buscar?q=...&lat=...&lng=...&raioKm=...&ufSigla=...&limit=50&offset=0
   */
  public async buscar(req: Request, res: Response): Promise<void> {
    try {
      const q = String(req.query.q ?? '').trim();
      if (!q) {
        res.status(400).json({ success: false, message: 'Parâmetro q é obrigatório' });
        return;
      }

      const lat = req.query.lat != null ? Number(req.query.lat) : undefined;
      const lng = req.query.lng != null ? Number(req.query.lng) : undefined;
      const raioKm = req.query.raioKm != null ? Number(req.query.raioKm) : undefined;
      const ufSigla = req.query.ufSigla ? String(req.query.ufSigla).trim().toUpperCase() : undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const offset = Math.max(0, Number(req.query.offset) || 0);

      const resultado = await this.itemService.buscarItensParaCotacao(
        q,
        lat,
        lng,
        raioKm,
        limit,
        offset,
        ufSigla
      );

      res.status(200).json({
        success: true,
        ...resultado,
        itens: resultado.itens.map(
          ({ item, distanciaKm, municipioNome, ufSigla, numeroControlePNCP, dataLicitacao }) => ({
            id: item.id,
            licitacaoId: item.licitacaoId,
            numeroItem: item.numeroItem,
            descricao: item.descricao,
            valorUnitarioEstimado: item.valorUnitarioEstimado,
            valorTotal: item.valorTotal,
            quantidade: item.quantidade,
            unidadeMedida: item.unidadeMedida,
            distanciaKm,
            municipioNome,
            ufSigla,
            numeroControlePNCP,
            dataLicitacao,
          })
        ),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar itens';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/itens-licitacao/modelo-planilha
   * Faz download do modelo de planilha Excel para importação de itens.
   */
  public async downloadModelo(req: Request, res: Response): Promise<void> {
    try {
      const buffer = this.planilhaService.gerarModelo();

      // Configurar headers para download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="modelo-importacao-itens.xlsx"');
      res.setHeader('Content-Length', buffer.length);

      res.status(200).send(buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar modelo';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/itens/upload-planilha — multipart: arquivo (Excel).
   * Retorna linhas da planilha com sugestões de itens do histórico para o usuário selecionar.
   */
  public async uploadPlanilha(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file || !file.buffer) {
        res.status(400).json({
          success: false,
          message: 'Envie um arquivo (campo "arquivo"). Formatos aceitos: .xlsx, .xls',
        });
        return;
      }

      const ext = (file.originalname || '').toLowerCase();
      if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
        res.status(400).json({
          success: false,
          message: 'Formato inválido. Use .xlsx ou .xls',
        });
        return;
      }

      const resultado = await this.planilhaService.processar(file.buffer);
      res.status(200).json({ success: true, ...resultado });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao processar planilha';
      res.status(500).json({ success: false, message });
    }
  }
}
