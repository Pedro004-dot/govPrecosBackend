import { Router } from 'express';
import { TenantController } from '../controllers/TenantController';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/rbac.middleware';
import multer from 'multer';

// Configurar multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

/**
 * Cria rotas de tenants
 * Todas as rotas são restritas a super_admin (exceto upload de brasão)
 */
export function createTenantRoutes(tenantController: TenantController): Router {
  const router = Router();

  // Todas as rotas requerem autenticação
  router.use(authMiddleware);

  // Upload de brasão (qualquer usuário autenticado do tenant)
  router.post(
    '/:id/brasao/upload',
    upload.single('brasao'),
    (req, res) => tenantController.uploadBrasao(req, res)
  );

  // Rotas de super_admin
  router.use(requireSuperAdmin());

  // CRUD de tenants
  router.get('/', (req, res) => tenantController.listar(req, res));
  router.get('/:id', (req, res) => tenantController.buscarPorId(req, res));
  router.post('/', (req, res) => tenantController.criar(req, res));
  router.put('/:id', (req, res) => tenantController.atualizar(req, res));
  router.delete('/:id', (req, res) => tenantController.desativar(req, res));

  // Ações adicionais
  router.post('/:id/ativar', (req, res) => tenantController.ativar(req, res));
  router.put('/:id/brasao', (req, res) => tenantController.atualizarBrasao(req, res));

  return router;
}
