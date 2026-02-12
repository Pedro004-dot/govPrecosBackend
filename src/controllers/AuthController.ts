import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { Database } from '../infra/db';

/**
 * Controller de autenticação
 */
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly db: Database
  ) {}

  /**
   * POST /api/auth/login
   * Body: { email, password }
   */
  public async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body ?? {};

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email e senha são obrigatórios',
          code: 'LOGIN_MISSING_FIELDS',
        });
        return;
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const result = await this.authService.login(email, password, ip, userAgent);

      console.log(`[AuthController.login] Login bem-sucedido: ${email}`);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error('[AuthController.login] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao fazer login';

      res.status(401).json({
        success: false,
        message,
        code: 'LOGIN_FAILED',
      });
    }
  }

  /**
   * POST /api/auth/logout
   */
  public async logout(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      const accessToken = req.accessToken;

      if (!usuario || !accessToken) {
        res.status(401).json({
          success: false,
          message: 'Não autenticado',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      await this.authService.logout(usuario.id, accessToken, ip, userAgent);

      console.log(`[AuthController.logout] Logout: ${usuario.email}`);

      res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso',
      });
    } catch (error) {
      console.error('[AuthController.logout] Erro:', error);

      // Mesmo com erro, consideramos logout ok
      res.status(200).json({
        success: true,
        message: 'Logout realizado',
      });
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Body: { email }
   */
  public async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body ?? {};

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email é obrigatório',
          code: 'FORGOT_PASSWORD_MISSING_EMAIL',
        });
        return;
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();

      await this.authService.forgotPassword(email, ip);

      // Sempre retornar sucesso para não revelar se o email existe
      res.status(200).json({
        success: true,
        message: 'Se o email existir, você receberá instruções de recuperação',
      });
    } catch (error) {
      console.error('[AuthController.forgotPassword] Erro:', error);

      // Não revelar erro para não expor informações
      res.status(200).json({
        success: true,
        message: 'Se o email existir, você receberá instruções de recuperação',
      });
    }
  }

  /**
   * POST /api/auth/reset-password
   * Body: { token, newPassword }
   */
  public async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, newPassword } = req.body ?? {};

      if (!token || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Token e nova senha são obrigatórios',
          code: 'RESET_PASSWORD_MISSING_FIELDS',
        });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: 'A senha deve ter pelo menos 8 caracteres',
          code: 'RESET_PASSWORD_WEAK',
        });
        return;
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      await this.authService.resetPassword(token, newPassword, ip, userAgent);

      res.status(200).json({
        success: true,
        message: 'Senha alterada com sucesso',
      });
    } catch (error) {
      console.error('[AuthController.resetPassword] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao resetar senha';

      res.status(400).json({
        success: false,
        message,
        code: 'RESET_PASSWORD_FAILED',
      });
    }
  }

  /**
   * GET /api/auth/me
   */
  public async me(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;

      if (!usuario) {
        res.status(401).json({
          success: false,
          message: 'Não autenticado',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      const result = await this.authService.me(usuario.id, this.db);

      res.status(200).json({
        success: true,
        usuario: result,
      });
    } catch (error) {
      console.error('[AuthController.me] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar dados';

      res.status(500).json({
        success: false,
        message,
        code: 'ME_FAILED',
      });
    }
  }

  /**
   * POST /api/auth/change-password
   * Body: { currentPassword, newPassword }
   */
  public async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      const { currentPassword, newPassword } = req.body ?? {};

      if (!usuario) {
        res.status(401).json({
          success: false,
          message: 'Não autenticado',
          code: 'NOT_AUTHENTICATED',
        });
        return;
      }

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Senha atual e nova senha são obrigatórias',
          code: 'CHANGE_PASSWORD_MISSING_FIELDS',
        });
        return;
      }

      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: 'A nova senha deve ter pelo menos 8 caracteres',
          code: 'CHANGE_PASSWORD_WEAK',
        });
        return;
      }

      if (currentPassword === newPassword) {
        res.status(400).json({
          success: false,
          message: 'A nova senha deve ser diferente da atual',
          code: 'CHANGE_PASSWORD_SAME',
        });
        return;
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      await this.authService.changePassword(
        usuario.id,
        currentPassword,
        newPassword,
        ip,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Senha alterada com sucesso',
      });
    } catch (error) {
      console.error('[AuthController.changePassword] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao alterar senha';

      res.status(400).json({
        success: false,
        message,
        code: 'CHANGE_PASSWORD_FAILED',
      });
    }
  }
}
