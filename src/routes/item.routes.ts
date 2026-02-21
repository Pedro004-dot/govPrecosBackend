import { Router } from 'express';
import multer from 'multer';
import { ItemController } from '../controllers/ItemController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * Rotas de itens (busca, upload de planilha para cotação).
 */
export function createItemRoutes(controller: ItemController): Router {
  const router = Router();

  router.get('/buscar', (req, res) => controller.buscar(req, res));
  router.get('/modelo-planilha', (req, res) => controller.downloadModelo(req, res));
  router.post('/upload-planilha', upload.single('arquivo'), (req, res) =>
    controller.uploadPlanilha(req, res)
  );

  return router;
}
