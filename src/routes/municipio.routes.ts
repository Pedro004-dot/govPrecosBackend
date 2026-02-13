import { Router } from 'express';
import { MunicipioController } from '../controllers/MunicipioController';

export function createMunicipioRoutes(controller: MunicipioController): Router {
  const router = Router();

  // GET /api/municipios/ufs - Lista todas as UFs
  router.get('/ufs', (req, res) => controller.listarUFs(req, res));

  // GET /api/municipios/por-uf/:uf - Lista municípios de uma UF
  router.get('/por-uf/:uf', (req, res) => controller.listarPorUF(req, res));

  return router;
}
