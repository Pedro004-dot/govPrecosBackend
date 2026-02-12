import { Request, Response, NextFunction } from 'express';
import { SupabaseService } from '../infra/supabase';
import { Database } from '../infra/db';
import { Usuario, UsuarioAutenticado } from '../domain/Usuario';

/**
 * Extensão do Request do Express para incluir usuário autenticado
 */
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
      accessToken?: string;
    }
  }
}

/**
 * Middleware de autenticação
 * Verifica o JWT do Supabase e carrega os dados do usuário
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Token de autenticação não fornecido',
        code: 'AUTH_TOKEN_MISSING',
      });
      return;
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      res.status(401).json({
        success: false,
        message: 'Formato de token inválido. Use: Bearer <token>',
        code: 'AUTH_TOKEN_INVALID_FORMAT',
      });
      return;
    }

    // Verificar token no Supabase
    const supabase = SupabaseService.getInstance();
    let authUser;

    try {
      authUser = await supabase.verifyToken(token);
    } catch (error) {
      console.error('[authMiddleware] Erro ao verificar token:', error);
      res.status(401).json({
        success: false,
        message: 'Token inválido ou expirado',
        code: 'AUTH_TOKEN_INVALID',
      });
      return;
    }

    if (!authUser || !authUser.id) {
      res.status(401).json({
        success: false,
        message: 'Usuário não encontrado no token',
        code: 'AUTH_USER_NOT_FOUND',
      });
      return;
    }

    // Buscar dados do usuário na tabela public.usuarios
    const db = Database.getInstance();
    const usuarioRow = await db.queryOne<any>(
      `SELECT * FROM public.usuarios WHERE auth_id = $1`,
      [authUser.id]
    );

    if (!usuarioRow) {
      res.status(401).json({
        success: false,
        message: 'Usuário não cadastrado no sistema',
        code: 'AUTH_USER_NOT_REGISTERED',
      });
      return;
    }

    const usuario = Usuario.fromRow(usuarioRow);

    // Verificar se usuário está ativo
    if (!usuario.ativo) {
      res.status(403).json({
        success: false,
        message: 'Usuário desativado',
        code: 'AUTH_USER_DISABLED',
      });
      return;
    }

    // Se não for super admin, verificar se o tenant está ativo
    if (!usuario.isSuperAdminUser() && usuario.tenantId) {
      const tenantRow = await db.queryOne<any>(
        `SELECT ativo FROM public.tenants WHERE id = $1`,
        [usuario.tenantId]
      );

      if (!tenantRow || !tenantRow.ativo) {
        res.status(403).json({
          success: false,
          message: 'Prefeitura desativada',
          code: 'AUTH_TENANT_DISABLED',
        });
        return;
      }
    }

    // Adicionar usuário ao request
    req.usuario = usuario.toAutenticado();
    req.accessToken = token;

    next();
  } catch (error) {
    console.error('[authMiddleware] Erro inesperado:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno de autenticação',
      code: 'AUTH_INTERNAL_ERROR',
    });
  }
}

/**
 * Middleware opcional de autenticação
 * Se tiver token, valida. Se não tiver, continua sem usuário.
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // Se não tiver header, continua sem autenticação
  if (!authHeader) {
    next();
    return;
  }

  // Se tiver, usa o middleware normal
  await authMiddleware(req, res, next);
}
