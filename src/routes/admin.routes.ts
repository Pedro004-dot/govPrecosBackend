import { Router } from 'express';
import { SincronizacaoController } from '../controllers/SincronizacaoController';

/**
 * Rotas administrativas (sincronização PNCP).
 */
export function createAdminRoutes(controller: SincronizacaoController): Router {
  const router = Router();

  router.post('/sincronizar-historico', (req, res) =>
    controller.sincronizarHistorico(req, res)
  );

  router.post('/sincronizar-atualizacoes', (req, res) =>
    controller.sincronizarAtualizacoes(req, res)
  );

  return router;
}
