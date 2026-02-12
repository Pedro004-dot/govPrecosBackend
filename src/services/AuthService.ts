import { SupabaseService } from '../infra/supabase';
import { EmailService } from '../infra/email';
import { Database } from '../infra/db';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { PasswordResetRepository } from '../repositories/PasswordResetRepository';
import { AuditService } from './AuditService';
import { Usuario } from '../domain/Usuario';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  usuario: {
    id: string;
    email: string;
    nome: string;
    perfil: string;
    tenantId: string | null;
    isSuperAdmin: boolean;
  };
}

export interface MeResult {
  id: string;
  email: string;
  nome: string;
  perfil: string;
  tenantId: string | null;
  isSuperAdmin: boolean;
  tenant?: {
    id: string;
    nome: string;
    cnpj: string;
    tipo: string;
  };
}

/**
 * Serviço de autenticação
 */
export class AuthService {
  constructor(
    private readonly usuarioRepository: UsuarioRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly auditService: AuditService
  ) {}

  /**
   * Login com email e senha
   */
  public async login(
    email: string,
    password: string,
    ip?: string,
    userAgent?: string
  ): Promise<LoginResult> {
    // Verificar se o usuário existe na nossa tabela
    const usuario = await this.usuarioRepository.buscarPorEmail(email);

    if (!usuario) {
      throw new Error('Credenciais inválidas');
    }

    if (!usuario.ativo) {
      throw new Error('Usuário desativado');
    }

    if (!usuario.authId) {
      throw new Error('Usuário não possui acesso configurado');
    }

    // Fazer login no Supabase Auth
    const supabase = SupabaseService.getInstance();
    let authData;

    try {
      authData = await supabase.signInWithPassword(email, password);
    } catch (error) {
      throw new Error('Credenciais inválidas');
    }

    if (!authData.session) {
      throw new Error('Erro ao criar sessão');
    }

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: usuario.id,
      acao: 'login',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      ip,
      userAgent,
    });

    return {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      expiresAt: authData.session.expires_at || 0,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
        tenantId: usuario.tenantId,
        isSuperAdmin: usuario.isSuperAdminUser(),
      },
    };
  }

  /**
   * Logout (invalida sessão)
   */
  public async logout(
    usuarioId: string,
    accessToken: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const supabase = SupabaseService.getInstance();

    try {
      await supabase.signOut(accessToken);
    } catch (error) {
      console.warn('[AuthService.logout] Aviso ao fazer logout:', error);
    }

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId,
      acao: 'logout',
      entidade: 'usuarios',
      entidadeId: usuarioId,
      ip,
      userAgent,
    });
  }

  /**
   * Solicita recuperação de senha
   */
  public async forgotPassword(email: string, ip?: string): Promise<void> {
    const usuario = await this.usuarioRepository.buscarPorEmail(email);

    // Não revelar se o email existe ou não
    if (!usuario || !usuario.ativo) {
      console.log(`[AuthService.forgotPassword] Email não encontrado: ${email}`);
      return;
    }

    // Criar token de recuperação
    const token = await this.passwordResetRepository.criar(usuario.id);

    // Enviar email
    const emailService = EmailService.getInstance();
    await emailService.sendPasswordResetEmail(usuario.email, usuario.nome, token);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: usuario.id,
      acao: 'password_reset_request',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      ip,
    });

    console.log(`[AuthService.forgotPassword] Email de recuperação enviado para: ${email}`);
  }

  /**
   * Reseta a senha com token
   */
  public async resetPassword(
    token: string,
    newPassword: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    // Buscar token válido
    const resetToken = await this.passwordResetRepository.buscarPorToken(token);

    if (!resetToken) {
      throw new Error('Token inválido ou expirado');
    }

    // Buscar usuário
    const usuario = await this.usuarioRepository.buscarPorId(resetToken.usuarioId);

    if (!usuario || !usuario.authId) {
      throw new Error('Usuário não encontrado');
    }

    // Atualizar senha no Supabase Auth
    const supabase = SupabaseService.getInstance();
    await supabase.updateUserPassword(usuario.authId, newPassword);

    // Marcar token como usado
    await this.passwordResetRepository.marcarComoUsado(resetToken.id);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: usuario.id,
      acao: 'password_reset',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      ip,
      userAgent,
    });

    console.log(`[AuthService.resetPassword] Senha resetada para usuário: ${usuario.id}`);
  }

  /**
   * Retorna dados do usuário logado com informações do tenant
   */
  public async me(usuarioId: string, db: Database): Promise<MeResult> {
    const usuario = await this.usuarioRepository.buscarPorId(usuarioId);

    if (!usuario) {
      throw new Error('Usuário não encontrado');
    }

    const result: MeResult = {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      perfil: usuario.perfil,
      tenantId: usuario.tenantId,
      isSuperAdmin: usuario.isSuperAdminUser(),
    };

    // Buscar dados do tenant se existir
    if (usuario.tenantId) {
      const tenantRow = await db.queryOne<any>(
        `SELECT id, nome, cnpj, tipo FROM public.tenants WHERE id = $1`,
        [usuario.tenantId]
      );

      if (tenantRow) {
        result.tenant = {
          id: tenantRow.id,
          nome: tenantRow.nome,
          cnpj: tenantRow.cnpj,
          tipo: tenantRow.tipo,
        };
      }
    }

    return result;
  }

  /**
   * Altera senha do próprio usuário
   */
  public async changePassword(
    usuarioId: string,
    currentPassword: string,
    newPassword: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const usuario = await this.usuarioRepository.buscarPorId(usuarioId);

    if (!usuario || !usuario.authId) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar senha atual fazendo login
    const supabase = SupabaseService.getInstance();

    try {
      await supabase.signInWithPassword(usuario.email, currentPassword);
    } catch (error) {
      throw new Error('Senha atual incorreta');
    }

    // Atualizar senha
    await supabase.updateUserPassword(usuario.authId, newPassword);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: usuario.id,
      acao: 'password_change',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      ip,
      userAgent,
    });

    console.log(`[AuthService.changePassword] Senha alterada para usuário: ${usuario.id}`);
  }
}
