import { Database } from '../infra/db';
import { Usuario, PerfilUsuario } from '../domain/Usuario';

/**
 * Repositório para operações de usuário no banco de dados
 */
export class UsuarioRepository {
  constructor(private readonly db: Database) {}

  /**
   * Busca usuário por ID
   */
  public async buscarPorId(id: string): Promise<Usuario | null> {
    const row = await this.db.queryOne<any>(
      `SELECT * FROM public.usuarios WHERE id = $1`,
      [id]
    );
    return row ? Usuario.fromRow(row) : null;
  }

  /**
   * Busca usuário por auth_id (id do Supabase Auth)
   */
  public async buscarPorAuthId(authId: string): Promise<Usuario | null> {
    const row = await this.db.queryOne<any>(
      `SELECT * FROM public.usuarios WHERE auth_id = $1`,
      [authId]
    );
    return row ? Usuario.fromRow(row) : null;
  }

  /**
   * Busca usuário por email
   */
  public async buscarPorEmail(email: string): Promise<Usuario | null> {
    const row = await this.db.queryOne<any>(
      `SELECT * FROM public.usuarios WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    return row ? Usuario.fromRow(row) : null;
  }

  /**
   * Lista usuários de um tenant
   */
  public async listarPorTenant(
    tenantId: string,
    incluirInativos: boolean = false
  ): Promise<Usuario[]> {
    let query = `
      SELECT * FROM public.usuarios
      WHERE tenant_id = $1
    `;

    if (!incluirInativos) {
      query += ` AND ativo = true`;
    }

    query += ` ORDER BY nome ASC`;

    const rows = await this.db.query<any>(query, [tenantId]);
    return rows.map((row) => Usuario.fromRow(row));
  }

  /**
   * Lista todos os usuários (apenas super admin)
   */
  public async listarTodos(incluirInativos: boolean = false): Promise<Usuario[]> {
    let query = `SELECT * FROM public.usuarios`;

    if (!incluirInativos) {
      query += ` WHERE ativo = true`;
    }

    query += ` ORDER BY nome ASC`;

    const rows = await this.db.query<any>(query);
    return rows.map((row) => Usuario.fromRow(row));
  }

  /**
   * Cria um novo usuário
   */
  public async criar(
    authId: string,
    tenantId: string | null,
    email: string,
    nome: string,
    perfil: PerfilUsuario,
    isSuperAdmin: boolean = false
  ): Promise<Usuario> {
    const row = await this.db.queryOne<any>(
      `INSERT INTO public.usuarios (auth_id, tenant_id, email, nome, perfil, is_super_admin, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [authId, tenantId, email, nome, perfil, isSuperAdmin]
    );

    if (!row) {
      throw new Error('Erro ao criar usuário');
    }

    return Usuario.fromRow(row);
  }

  /**
   * Atualiza dados de um usuário
   */
  public async atualizar(
    id: string,
    dados: {
      nome?: string;
      perfil?: PerfilUsuario;
      ativo?: boolean;
      tenantId?: string | null;
    }
  ): Promise<Usuario> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dados.nome !== undefined) {
      updates.push(`nome = $${paramIndex++}`);
      values.push(dados.nome);
    }

    if (dados.perfil !== undefined) {
      updates.push(`perfil = $${paramIndex++}`);
      values.push(dados.perfil);
    }

    if (dados.ativo !== undefined) {
      updates.push(`ativo = $${paramIndex++}`);
      values.push(dados.ativo);
    }

    if (dados.tenantId !== undefined) {
      updates.push(`tenant_id = $${paramIndex++}`);
      values.push(dados.tenantId);
    }

    if (updates.length === 0) {
      const usuario = await this.buscarPorId(id);
      if (!usuario) {
        throw new Error('Usuário não encontrado');
      }
      return usuario;
    }

    values.push(id);

    const row = await this.db.queryOne<any>(
      `UPDATE public.usuarios
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (!row) {
      throw new Error('Usuário não encontrado');
    }

    return Usuario.fromRow(row);
  }

  /**
   * Atualiza o auth_id de um usuário (após criar no Supabase Auth)
   */
  public async atualizarAuthId(id: string, authId: string): Promise<Usuario> {
    const row = await this.db.queryOne<any>(
      `UPDATE public.usuarios SET auth_id = $1 WHERE id = $2 RETURNING *`,
      [authId, id]
    );

    if (!row) {
      throw new Error('Usuário não encontrado');
    }

    return Usuario.fromRow(row);
  }

  /**
   * Atualiza o email de um usuário
   */
  public async atualizarEmail(id: string, email: string): Promise<Usuario> {
    const row = await this.db.queryOne<any>(
      `UPDATE public.usuarios SET email = $1 WHERE id = $2 RETURNING *`,
      [email, id]
    );

    if (!row) {
      throw new Error('Usuário não encontrado');
    }

    return Usuario.fromRow(row);
  }

  /**
   * Desativa um usuário (soft delete)
   */
  public async desativar(id: string): Promise<Usuario> {
    return this.atualizar(id, { ativo: false });
  }

  /**
   * Ativa um usuário
   */
  public async ativar(id: string): Promise<Usuario> {
    return this.atualizar(id, { ativo: true });
  }

  /**
   * Deleta um usuário permanentemente
   */
  public async deletar(id: string): Promise<void> {
    await this.db.query(`DELETE FROM public.usuarios WHERE id = $1`, [id]);
  }

  /**
   * Verifica se um email já está em uso
   */
  public async emailEmUso(email: string, excluirId?: string): Promise<boolean> {
    let query = `SELECT COUNT(*) as count FROM public.usuarios WHERE LOWER(email) = LOWER($1)`;
    const params: any[] = [email];

    if (excluirId) {
      query += ` AND id != $2`;
      params.push(excluirId);
    }

    const row = await this.db.queryOne<{ count: string }>(query, params);
    return row ? parseInt(row.count, 10) > 0 : false;
  }

  /**
   * Conta usuários de um tenant
   */
  public async contarPorTenant(tenantId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM public.usuarios WHERE tenant_id = $1 AND ativo = true`,
      [tenantId]
    );
    return row ? parseInt(row.count, 10) : 0;
  }
}
