import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { PerfilUsuario } from '../domain/Usuario';

/**
 * Controller de usuários
 */
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /api/users
   * Query: tenantId?, incluirInativos?
   */
  public async listar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const tenantId = req.query.tenantId as string | undefined;
      const incluirInativos = req.query.incluirInativos === 'true';

      const usuarios = await this.userService.listar(usuario, tenantId, incluirInativos);

      res.status(200).json({
        success: true,
        usuarios: usuarios.map((u) => u.toJson()),
      });
    } catch (error) {
      console.error('[UserController.listar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao listar usuários';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * GET /api/users/:id
   */
  public async buscarPorId(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const id = req.params.id;
      const usuarioEncontrado = await this.userService.buscarPorId(id, usuario);

      if (!usuarioEncontrado) {
        res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        return;
      }

      res.status(200).json({
        success: true,
        usuario: usuarioEncontrado.toJson(),
      });
    } catch (error) {
      console.error('[UserController.buscarPorId] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao buscar usuário';
      res.status(500).json({ success: false, message });
    }
  }

  /**
   * POST /api/users
   * Body: { tenantId, email, nome, perfil, senha?, enviarEmail? }
   */
  public async criar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const { tenantId, email, nome, perfil, senha, enviarEmail } = req.body ?? {};

      if (!email || !nome || !perfil) {
        res.status(400).json({
          success: false,
          message: 'email, nome e perfil são obrigatórios',
        });
        return;
      }

      // Validar perfil
      const perfisValidos: PerfilUsuario[] = ['super_admin', 'admin', 'operador', 'auditor'];
      if (!perfisValidos.includes(perfil)) {
        res.status(400).json({
          success: false,
          message: `Perfil inválido. Valores válidos: ${perfisValidos.join(', ')}`,
        });
        return;
      }

      // Se não for super_admin, deve ter tenantId
      if (perfil !== 'super_admin' && !tenantId) {
        res.status(400).json({
          success: false,
          message: 'tenantId é obrigatório para usuários não super_admin',
        });
        return;
      }

      // Admin do tenant só pode criar no próprio tenant
      if (!usuario.isSuperAdmin && tenantId !== usuario.tenantId) {
        res.status(403).json({
          success: false,
          message: 'Sem permissão para criar usuário em outro tenant',
        });
        return;
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const novoUsuario = await this.userService.criar(
        {
          tenantId: perfil === 'super_admin' ? null : tenantId,
          email,
          nome,
          perfil,
          senha,
          enviarEmail,
        },
        usuario,
        ip,
        userAgent
      );

      res.status(201).json({
        success: true,
        usuario: novoUsuario.toJson(),
      });
    } catch (error) {
      console.error('[UserController.criar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao criar usuário';
      res.status(400).json({ success: false, message });
    }
  }

  /**
   * PUT /api/users/:id
   * Body: { nome?, perfil?, ativo? }
   */
  public async atualizar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const id = req.params.id;
      const { nome, perfil, ativo } = req.body ?? {};

      // Validar perfil se fornecido
      if (perfil) {
        const perfisValidos: PerfilUsuario[] = ['super_admin', 'admin', 'operador', 'auditor'];
        if (!perfisValidos.includes(perfil)) {
          res.status(400).json({
            success: false,
            message: `Perfil inválido. Valores válidos: ${perfisValidos.join(', ')}`,
          });
          return;
        }
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const usuarioAtualizado = await this.userService.atualizar(
        id,
        { nome, perfil, ativo },
        usuario,
        ip,
        userAgent
      );

      res.status(200).json({
        success: true,
        usuario: usuarioAtualizado.toJson(),
      });
    } catch (error) {
      console.error('[UserController.atualizar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao atualizar usuário';
      res.status(400).json({ success: false, message });
    }
  }

  /**
   * DELETE /api/users/:id (desativa)
   */
  public async desativar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const id = req.params.id;
      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const usuarioDesativado = await this.userService.desativar(
        id,
        usuario,
        ip,
        userAgent
      );

      res.status(200).json({
        success: true,
        usuario: usuarioDesativado.toJson(),
        message: 'Usuário desativado com sucesso',
      });
    } catch (error) {
      console.error('[UserController.desativar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao desativar usuário';
      res.status(400).json({ success: false, message });
    }
  }

  /**
   * POST /api/users/:id/ativar
   */
  public async ativar(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const id = req.params.id;
      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      const usuarioAtivado = await this.userService.ativar(id, usuario, ip, userAgent);

      res.status(200).json({
        success: true,
        usuario: usuarioAtivado.toJson(),
        message: 'Usuário ativado com sucesso',
      });
    } catch (error) {
      console.error('[UserController.ativar] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao ativar usuário';
      res.status(400).json({ success: false, message });
    }
  }

  /**
   * POST /api/users/:id/reset-password
   * Body: { novaSenha }
   */
  public async resetarSenha(req: Request, res: Response): Promise<void> {
    try {
      const usuario = req.usuario;
      if (!usuario) {
        res.status(401).json({ success: false, message: 'Não autenticado' });
        return;
      }

      const id = req.params.id;
      const { novaSenha } = req.body ?? {};

      if (!novaSenha || novaSenha.length < 8) {
        res.status(400).json({
          success: false,
          message: 'novaSenha é obrigatória e deve ter pelo menos 8 caracteres',
        });
        return;
      }

      const ip = req.ip || req.headers['x-forwarded-for']?.toString();
      const userAgent = req.headers['user-agent'];

      await this.userService.resetarSenha(id, novaSenha, usuario, ip, userAgent);

      res.status(200).json({
        success: true,
        message: 'Senha resetada com sucesso',
      });
    } catch (error) {
      console.error('[UserController.resetarSenha] Erro:', error);
      const message = error instanceof Error ? error.message : 'Erro ao resetar senha';
      res.status(400).json({ success: false, message });
    }
  }
}
