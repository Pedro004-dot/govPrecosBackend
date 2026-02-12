import { Router } from 'express';
import { PesquisaController } from '../controllers/PesquisaController';
import { ConsolidacaoController } from '../controllers/ConsolidacaoController';
import { RelatorioController } from '../controllers/RelatorioController';

/**
 * Rotas de pesquisas de preço (criar, gerenciar, consolidar, estatísticas e relatório).
 */
export function createPesquisaRoutes(
  controller: PesquisaController,
  consolidacaoController: ConsolidacaoController,
  relatorioController: RelatorioController
): Router {
  const router = Router();

  router.post('/', (req, res) => controller.criar(req, res));
  router.get('/', (req, res) => controller.listar(req, res));
  router.get('/:id/estatisticas', (req, res) => consolidacaoController.getEstatisticas(req, res));
  router.post('/:id/consolidar', (req, res) => consolidacaoController.consolidar(req, res));
  router.post('/:id/relatorio', (req, res) => relatorioController.gerar(req, res));
  router.get('/:id', (req, res) => controller.buscarPorId(req, res));
  router.post('/:id/itens', (req, res) => controller.adicionarItens(req, res));
  router.delete('/:id/itens', (req, res) => controller.removerItens(req, res));

  return router;
}
