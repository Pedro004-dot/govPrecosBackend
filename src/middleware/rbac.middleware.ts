import { Request, Response, NextFunction } from 'express';
import { PerfilUsuario } from '../domain/Usuario';

/**
 * Middleware de controle de acesso baseado em perfil (RBAC)
 *
 * @param perfisPermitidos Lista de perfis que podem acessar a rota
 * @returns Middleware function
 *
 * @example
 * router.get('/admin', authMiddleware, requirePerfil(['super_admin']), controller.metodo);
 * router.get('/usuarios', authMiddleware, requirePerfil(['super_admin', 'admin']), controller.metodo);
 */
export function requirePerfil(perfisPermitidos: PerfilUsuario[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const usuario = req.usuario;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        code: 'RBAC_NOT_AUTHENTICATED',
      });
      return;
    }

    // Super admin tem acesso a tudo
    if (usuario.isSuperAdmin) {
      next();
      return;
    }

    // Verificar se o perfil do usuário está na lista de permitidos
    if (!perfisPermitidos.includes(usuario.perfil)) {
      res.status(403).json({
        success: false,
        message: 'Acesso negado. Perfil insuficiente.',
        code: 'RBAC_INSUFFICIENT_PERMISSION',
        requiredPerfis: perfisPermitidos,
        userPerfil: usuario.perfil,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware que exige que o usuário seja super admin
 */
export function requireSuperAdmin() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const usuario = req.usuario;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        code: 'RBAC_NOT_AUTHENTICATED',
      });
      return;
    }

    if (!usuario.isSuperAdmin) {
      res.status(403).json({
        success: false,
        message: 'Acesso restrito a administradores do sistema',
        code: 'RBAC_SUPER_ADMIN_REQUIRED',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware que exige que o usuário seja admin (do tenant ou super admin)
 */
export function requireAdmin() {
  return requirePerfil(['super_admin', 'admin']);
}

/**
 * Middleware que verifica se o usuário pode acessar um tenant específico
 * O tenantId deve estar em req.params.tenantId ou req.body.tenantId ou req.query.tenantId
 */
export function requireTenantAccess() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const usuario = req.usuario;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        code: 'RBAC_NOT_AUTHENTICATED',
      });
      return;
    }

    // Super admin tem acesso a qualquer tenant
    if (usuario.isSuperAdmin) {
      next();
      return;
    }

    // Buscar tenantId da requisição
    const tenantId =
      req.params.tenantId ||
      req.body?.tenantId ||
      req.query.tenantId;

    if (!tenantId) {
      res.status(400).json({
        success: false,
        message: 'tenantId não fornecido',
        code: 'RBAC_TENANT_ID_MISSING',
      });
      return;
    }

    // Verificar se o usuário pertence ao tenant
    if (usuario.tenantId !== tenantId) {
      res.status(403).json({
        success: false,
        message: 'Acesso negado a este tenant',
        code: 'RBAC_TENANT_ACCESS_DENIED',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware que injeta o tenantId do usuário na requisição
 * Útil para rotas onde o tenantId deve vir do usuário logado
 */
export function injectTenantId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const usuario = req.usuario;

    if (!usuario) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
        code: 'RBAC_NOT_AUTHENTICATED',
      });
      return;
    }

    // Se for super admin e não tiver tenantId, requer que seja passado
    if (usuario.isSuperAdmin && !req.body?.tenantId && !req.query.tenantId) {
      // Super admin pode acessar sem tenant em algumas rotas
      next();
      return;
    }

    // Injetar tenantId no body se não for super admin
    if (!usuario.isSuperAdmin) {
      if (req.body) {
        req.body.tenantId = usuario.tenantId;
      }
      // Também sobrescrever query se existir
      if (req.query.tenantId && req.query.tenantId !== usuario.tenantId) {
        req.query.tenantId = usuario.tenantId as string;
      }
    }

    next();
  };
}
