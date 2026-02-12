import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

/**
 * Cria rotas de usuários
 */
export function createUserRoutes(userController: UserController): Router {
  const router = Router();

  // Todas as rotas requerem autenticação e perfil admin
  router.use(authMiddleware);
  router.use(requireAdmin());

  // CRUD de usuários
  router.get('/', (req, res) => userController.listar(req, res));
  router.get('/:id', (req, res) => userController.buscarPorId(req, res));
  router.post('/', (req, res) => userController.criar(req, res));
  router.put('/:id', (req, res) => userController.atualizar(req, res));
  router.delete('/:id', (req, res) => userController.desativar(req, res));

  // Ações adicionais
  router.post('/:id/ativar', (req, res) => userController.ativar(req, res));
  router.post('/:id/reset-password', (req, res) => userController.resetarSenha(req, res));

  return router;
}
