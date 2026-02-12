import { Router } from 'express';
import { TenantController } from '../controllers/TenantController';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/rbac.middleware';

/**
 * Cria rotas de tenants
 * Todas as rotas são restritas a super_admin
 */
export function createTenantRoutes(tenantController: TenantController): Router {
  const router = Router();

  // Todas as rotas requerem autenticação e perfil super_admin
  router.use(authMiddleware);
  router.use(requireSuperAdmin());

  // CRUD de tenants
  router.get('/', (req, res) => tenantController.listar(req, res));
  router.get('/:id', (req, res) => tenantController.buscarPorId(req, res));
  router.post('/', (req, res) => tenantController.criar(req, res));
  router.put('/:id', (req, res) => tenantController.atualizar(req, res));
  router.delete('/:id', (req, res) => tenantController.desativar(req, res));

  // Ações adicionais
  router.post('/:id/ativar', (req, res) => tenantController.ativar(req, res));

  return router;
}
