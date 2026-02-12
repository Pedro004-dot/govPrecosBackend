import { SupabaseService } from '../infra/supabase';
import { EmailService } from '../infra/email';
import { UsuarioRepository } from '../repositories/UsuarioRepository';
import { AuditService } from './AuditService';
import { Usuario, PerfilUsuario, UsuarioAutenticado } from '../domain/Usuario';
import crypto from 'crypto';

export interface CreateUserInput {
  tenantId: string | null;
  email: string;
  nome: string;
  perfil: PerfilUsuario;
  senha?: string; // Se não fornecida, gera uma temporária
  enviarEmail?: boolean;
}

export interface UpdateUserInput {
  nome?: string;
  perfil?: PerfilUsuario;
  ativo?: boolean;
}

/**
 * Serviço para gerenciamento de usuários
 */
export class UserService {
  constructor(
    private readonly usuarioRepository: UsuarioRepository,
    private readonly auditService: AuditService
  ) {}

  /**
   * Cria um novo usuário
   */
  public async criar(
    input: CreateUserInput,
    executadoPor: UsuarioAutenticado,
    ip?: string,
    userAgent?: string
  ): Promise<Usuario> {
    // Verificar se email já existe
    const emailEmUso = await this.usuarioRepository.emailEmUso(input.email);
    if (emailEmUso) {
      throw new Error('Email já está em uso');
    }

    // Validar perfil
    if (input.perfil === 'super_admin' && !executadoPor.isSuperAdmin) {
      throw new Error('Apenas super admin pode criar outros super admins');
    }

    // Gerar senha temporária se não fornecida
    const senha = input.senha || this.gerarSenhaTemporaria();

    // Criar usuário no Supabase Auth
    const supabase = SupabaseService.getInstance();
    const authUser = await supabase.createUser(input.email, senha, {
      nome: input.nome,
    });

    if (!authUser) {
      throw new Error('Erro ao criar usuário no sistema de autenticação');
    }

    // Criar usuário na nossa tabela
    const isSuperAdmin = input.perfil === 'super_admin';
    const usuario = await this.usuarioRepository.criar(
      authUser.id,
      input.tenantId,
      input.email,
      input.nome,
      input.perfil,
      isSuperAdmin
    );

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: executadoPor.id,
      acao: 'create',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      dadosDepois: {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
        tenantId: usuario.tenantId,
      },
      ip,
      userAgent,
    });

    // Enviar email de boas-vindas se solicitado
    if (input.enviarEmail !== false) {
      try {
        const emailService = EmailService.getInstance();
        await emailService.sendWelcomeEmail(input.email, input.nome, input.senha ? undefined : senha);
      } catch (error) {
        console.error('[UserService.criar] Erro ao enviar email:', error);
        // Não falhar a criação por erro de email
      }
    }

    console.log(`[UserService.criar] Usuário criado: ${usuario.id}`);
    return usuario;
  }

  /**
   * Atualiza um usuário
   */
  public async atualizar(
    id: string,
    input: UpdateUserInput,
    executadoPor: UsuarioAutenticado,
    ip?: string,
    userAgent?: string
  ): Promise<Usuario> {
    const usuarioAntes = await this.usuarioRepository.buscarPorId(id);
    if (!usuarioAntes) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar permissões
    const executante = new Usuario(
      executadoPor.id,
      executadoPor.authId,
      executadoPor.tenantId,
      executadoPor.email,
      executadoPor.nome,
      executadoPor.perfil,
      executadoPor.isSuperAdmin,
      executadoPor.ativo,
      new Date(),
      new Date()
    );

    if (!executante.podeGerenciarUsuario(usuarioAntes)) {
      throw new Error('Sem permissão para editar este usuário');
    }

    // Validar alteração de perfil
    if (input.perfil === 'super_admin' && !executadoPor.isSuperAdmin) {
      throw new Error('Apenas super admin pode promover a super admin');
    }

    // Não permitir rebaixar super admin se não for super admin
    if (usuarioAntes.isSuperAdminUser() && input.perfil && input.perfil !== 'super_admin') {
      if (!executadoPor.isSuperAdmin) {
        throw new Error('Apenas super admin pode rebaixar outro super admin');
      }
    }

    const usuario = await this.usuarioRepository.atualizar(id, input);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: executadoPor.id,
      acao: 'update',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      dadosAntes: {
        nome: usuarioAntes.nome,
        perfil: usuarioAntes.perfil,
        ativo: usuarioAntes.ativo,
      },
      dadosDepois: {
        nome: usuario.nome,
        perfil: usuario.perfil,
        ativo: usuario.ativo,
      },
      ip,
      userAgent,
    });

    console.log(`[UserService.atualizar] Usuário atualizado: ${usuario.id}`);
    return usuario;
  }

  /**
   * Desativa um usuário
   */
  public async desativar(
    id: string,
    executadoPor: UsuarioAutenticado,
    ip?: string,
    userAgent?: string
  ): Promise<Usuario> {
    const usuarioAntes = await this.usuarioRepository.buscarPorId(id);
    if (!usuarioAntes) {
      throw new Error('Usuário não encontrado');
    }

    // Não pode desativar a si mesmo
    if (usuarioAntes.id === executadoPor.id) {
      throw new Error('Não é possível desativar seu próprio usuário');
    }

    // Verificar permissões
    const executante = new Usuario(
      executadoPor.id,
      executadoPor.authId,
      executadoPor.tenantId,
      executadoPor.email,
      executadoPor.nome,
      executadoPor.perfil,
      executadoPor.isSuperAdmin,
      executadoPor.ativo,
      new Date(),
      new Date()
    );

    if (!executante.podeGerenciarUsuario(usuarioAntes)) {
      throw new Error('Sem permissão para desativar este usuário');
    }

    const usuario = await this.usuarioRepository.desativar(id);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: executadoPor.id,
      acao: 'deactivate',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      dadosAntes: { ativo: true },
      dadosDepois: { ativo: false },
      ip,
      userAgent,
    });

    console.log(`[UserService.desativar] Usuário desativado: ${usuario.id}`);
    return usuario;
  }

  /**
   * Ativa um usuário
   */
  public async ativar(
    id: string,
    executadoPor: UsuarioAutenticado,
    ip?: string,
    userAgent?: string
  ): Promise<Usuario> {
    const usuarioAntes = await this.usuarioRepository.buscarPorId(id);
    if (!usuarioAntes) {
      throw new Error('Usuário não encontrado');
    }

    const usuario = await this.usuarioRepository.ativar(id);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: executadoPor.id,
      acao: 'activate',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      dadosAntes: { ativo: false },
      dadosDepois: { ativo: true },
      ip,
      userAgent,
    });

    console.log(`[UserService.ativar] Usuário ativado: ${usuario.id}`);
    return usuario;
  }

  /**
   * Reseta a senha de um usuário (admin)
   */
  public async resetarSenha(
    id: string,
    novaSenha: string,
    executadoPor: UsuarioAutenticado,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    const usuario = await this.usuarioRepository.buscarPorId(id);
    if (!usuario || !usuario.authId) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar permissões
    const executante = new Usuario(
      executadoPor.id,
      executadoPor.authId,
      executadoPor.tenantId,
      executadoPor.email,
      executadoPor.nome,
      executadoPor.perfil,
      executadoPor.isSuperAdmin,
      executadoPor.ativo,
      new Date(),
      new Date()
    );

    if (!executante.podeGerenciarUsuario(usuario)) {
      throw new Error('Sem permissão para resetar senha deste usuário');
    }

    // Atualizar senha no Supabase
    const supabase = SupabaseService.getInstance();
    await supabase.updateUserPassword(usuario.authId, novaSenha);

    // Registrar no audit log
    await this.auditService.registrar({
      usuarioId: executadoPor.id,
      acao: 'password_reset_admin',
      entidade: 'usuarios',
      entidadeId: usuario.id,
      ip,
      userAgent,
    });

    console.log(`[UserService.resetarSenha] Senha resetada para: ${usuario.id}`);
  }

  /**
   * Lista usuários (com permissões)
   */
  public async listar(
    executadoPor: UsuarioAutenticado,
    tenantId?: string,
    incluirInativos: boolean = false
  ): Promise<Usuario[]> {
    // Super admin pode ver todos
    if (executadoPor.isSuperAdmin) {
      if (tenantId) {
        return this.usuarioRepository.listarPorTenant(tenantId, incluirInativos);
      }
      return this.usuarioRepository.listarTodos(incluirInativos);
    }

    // Admin do tenant só pode ver usuários do próprio tenant
    if (executadoPor.perfil === 'admin' && executadoPor.tenantId) {
      return this.usuarioRepository.listarPorTenant(
        executadoPor.tenantId,
        incluirInativos
      );
    }

    // Outros perfis não podem listar usuários
    throw new Error('Sem permissão para listar usuários');
  }

  /**
   * Busca um usuário por ID
   */
  public async buscarPorId(
    id: string,
    executadoPor: UsuarioAutenticado
  ): Promise<Usuario | null> {
    const usuario = await this.usuarioRepository.buscarPorId(id);

    if (!usuario) {
      return null;
    }

    // Verificar se pode ver este usuário
    if (!executadoPor.isSuperAdmin) {
      if (executadoPor.perfil !== 'admin') {
        // Só pode ver a si mesmo
        if (usuario.id !== executadoPor.id) {
          throw new Error('Sem permissão para ver este usuário');
        }
      } else {
        // Admin só pode ver usuários do mesmo tenant
        if (usuario.tenantId !== executadoPor.tenantId) {
          throw new Error('Sem permissão para ver este usuário');
        }
      }
    }

    return usuario;
  }

  /**
   * Gera uma senha temporária segura
   */
  private gerarSenhaTemporaria(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%';
    let senha = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      senha += charset[randomBytes[i] % charset.length];
    }

    return senha;
  }
}
