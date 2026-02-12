/**
 * Tipos de perfil de usuário no sistema
 */
export type PerfilUsuario = 'super_admin' | 'admin' | 'operador' | 'auditor';

/**
 * Interface para dados do usuário autenticado (usada no request)
 */
export interface UsuarioAutenticado {
  id: string;
  authId: string;
  tenantId: string | null;
  email: string;
  nome: string;
  perfil: PerfilUsuario;
  isSuperAdmin: boolean;
  ativo: boolean;
}

/**
 * Entidade de domínio para Usuário
 */
export class Usuario {
  constructor(
    public readonly id: string,
    public readonly authId: string | null,
    public readonly tenantId: string | null,
    public readonly email: string,
    public readonly nome: string,
    public readonly perfil: PerfilUsuario,
    public readonly isSuperAdmin: boolean,
    public readonly ativo: boolean,
    public readonly criadoEm: Date,
    public readonly atualizadoEm: Date
  ) {}

  /**
   * Verifica se o usuário é super admin
   */
  public isSuperAdminUser(): boolean {
    return this.isSuperAdmin || this.perfil === 'super_admin';
  }

  /**
   * Verifica se o usuário é admin do tenant
   */
  public isAdminTenant(): boolean {
    return this.perfil === 'admin' && !this.isSuperAdmin;
  }

  /**
   * Verifica se o usuário pode gerenciar outros usuários
   */
  public podeGerenciarUsuarios(): boolean {
    return this.isSuperAdminUser() || this.isAdminTenant();
  }

  /**
   * Verifica se o usuário pode acessar um tenant específico
   */
  public podeAcessarTenant(tenantId: string): boolean {
    if (this.isSuperAdminUser()) {
      return true;
    }
    return this.tenantId === tenantId;
  }

  /**
   * Verifica se o usuário pode gerenciar um usuário específico
   */
  public podeGerenciarUsuario(outroUsuario: Usuario): boolean {
    // Super admin pode tudo
    if (this.isSuperAdminUser()) {
      return true;
    }

    // Admin do tenant só pode gerenciar usuários do mesmo tenant
    if (this.isAdminTenant() && this.tenantId === outroUsuario.tenantId) {
      // Não pode gerenciar outro admin ou super admin
      return !outroUsuario.isSuperAdminUser() && outroUsuario.perfil !== 'admin';
    }

    return false;
  }

  /**
   * Converte para objeto de resposta da API
   */
  public toJson() {
    return {
      id: this.id,
      authId: this.authId,
      tenantId: this.tenantId,
      email: this.email,
      nome: this.nome,
      perfil: this.perfil,
      isSuperAdmin: this.isSuperAdmin,
      ativo: this.ativo,
      criadoEm: this.criadoEm,
      atualizadoEm: this.atualizadoEm,
    };
  }

  /**
   * Converte para UsuarioAutenticado (para uso no middleware)
   */
  public toAutenticado(): UsuarioAutenticado {
    return {
      id: this.id,
      authId: this.authId || '',
      tenantId: this.tenantId,
      email: this.email,
      nome: this.nome,
      perfil: this.perfil,
      isSuperAdmin: this.isSuperAdminUser(),
      ativo: this.ativo,
    };
  }

  /**
   * Cria instância a partir de row do banco
   */
  public static fromRow(row: any): Usuario {
    return new Usuario(
      row.id,
      row.auth_id,
      row.tenant_id,
      row.email,
      row.nome,
      row.perfil as PerfilUsuario,
      row.is_super_admin ?? false,
      row.ativo ?? true,
      new Date(row.criado_em),
      new Date(row.atualizado_em)
    );
  }
}
