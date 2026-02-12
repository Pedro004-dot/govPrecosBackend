import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authMiddleware } from '../middleware/auth.middleware';

/**
 * Cria rotas de autenticação
 */
export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  // Rotas públicas (sem autenticação)
  router.post('/login', (req, res) => authController.login(req, res));
  router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));
  router.post('/reset-password', (req, res) => authController.resetPassword(req, res));

  // Rotas protegidas (requerem autenticação)
  router.post('/logout', authMiddleware, (req, res) => authController.logout(req, res));
  router.get('/me', authMiddleware, (req, res) => authController.me(req, res));
  router.post('/change-password', authMiddleware, (req, res) =>
    authController.changePassword(req, res)
  );

  return router;
}
