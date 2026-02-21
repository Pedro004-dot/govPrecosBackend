import { Database } from '../infra/db';
import { Tenant, TipoTenant } from '../domain/Tenant';

/**
 * Repositório para operações de tenant no banco de dados
 */
export class TenantRepository {
  constructor(private readonly db: Database) {}

  /**
   * Busca tenant por ID
   */
  public async buscarPorId(id: string): Promise<Tenant | null> {
    const row = await this.db.queryOne<any>(
      `SELECT * FROM public.tenants WHERE id = $1`,
      [id]
    );
    return row ? Tenant.fromRow(row) : null;
  }

  /**
   * Busca tenant por CNPJ
   */
  public async buscarPorCnpj(cnpj: string): Promise<Tenant | null> {
    // Normalizar CNPJ (remover formatação)
    const cnpjNormalizado = this.normalizarCnpj(cnpj);

    const row = await this.db.queryOne<any>(
      `SELECT * FROM public.tenants WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = $1`,
      [cnpjNormalizado]
    );
    return row ? Tenant.fromRow(row) : null;
  }

  /**
   * Lista todos os tenants
   */
  public async listarTodos(incluirInativos: boolean = false): Promise<Tenant[]> {
    let query = `SELECT * FROM public.tenants`;

    if (!incluirInativos) {
      query += ` WHERE ativo = true`;
    }

    query += ` ORDER BY nome ASC`;

    const rows = await this.db.query<any>(query);
    return rows.map((row) => Tenant.fromRow(row));
  }

  /**
   * Lista tenants por tipo
   */
  public async listarPorTipo(tipo: TipoTenant, incluirInativos: boolean = false): Promise<Tenant[]> {
    let query = `SELECT * FROM public.tenants WHERE tipo = $1`;

    if (!incluirInativos) {
      query += ` AND ativo = true`;
    }

    query += ` ORDER BY nome ASC`;

    const rows = await this.db.query<any>(query, [tipo]);
    return rows.map((row) => Tenant.fromRow(row));
  }

  /**
   * Cria um novo tenant
   */
  public async criar(
    cnpj: string,
    nome: string,
    tipo: TipoTenant
  ): Promise<Tenant> {
    const row = await this.db.queryOne<any>(
      `INSERT INTO public.tenants (cnpj, nome, tipo, ativo)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [cnpj, nome, tipo]
    );

    if (!row) {
      throw new Error('Erro ao criar tenant');
    }

    return Tenant.fromRow(row);
  }

  /**
   * Atualiza dados de um tenant
   */
  public async atualizar(
    id: string,
    dados: {
      nome?: string;
      tipo?: TipoTenant;
      ativo?: boolean;
      brasaoUrl?: string;
    }
  ): Promise<Tenant> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dados.nome !== undefined) {
      updates.push(`nome = $${paramIndex++}`);
      values.push(dados.nome);
    }

    if (dados.tipo !== undefined) {
      updates.push(`tipo = $${paramIndex++}`);
      values.push(dados.tipo);
    }

    if (dados.ativo !== undefined) {
      updates.push(`ativo = $${paramIndex++}`);
      values.push(dados.ativo);
    }

    if (dados.brasaoUrl !== undefined) {
      updates.push(`brasao_url = $${paramIndex++}`);
      values.push(dados.brasaoUrl);
    }

    if (updates.length === 0) {
      const tenant = await this.buscarPorId(id);
      if (!tenant) {
        throw new Error('Tenant não encontrado');
      }
      return tenant;
    }

    values.push(id);

    const row = await this.db.queryOne<any>(
      `UPDATE public.tenants
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (!row) {
      throw new Error('Tenant não encontrado');
    }

    return Tenant.fromRow(row);
  }

  /**
   * Desativa um tenant (soft delete)
   */
  public async desativar(id: string): Promise<Tenant> {
    return this.atualizar(id, { ativo: false });
  }

  /**
   * Ativa um tenant
   */
  public async ativar(id: string): Promise<Tenant> {
    return this.atualizar(id, { ativo: true });
  }

  /**
   * Verifica se um CNPJ já está em uso
   */
  public async cnpjEmUso(cnpj: string, excluirId?: string): Promise<boolean> {
    const cnpjNormalizado = this.normalizarCnpj(cnpj);

    let query = `SELECT COUNT(*) as count FROM public.tenants
                 WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = $1`;
    const params: any[] = [cnpjNormalizado];

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
  public async contarUsuarios(tenantId: string): Promise<number> {
    const row = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM public.usuarios WHERE tenant_id = $1 AND ativo = true`,
      [tenantId]
    );
    return row ? parseInt(row.count, 10) : 0;
  }

  /**
   * Busca estatísticas de um tenant
   */
  public async buscarEstatisticas(tenantId: string): Promise<{
    usuarios: number;
    projetos: number;
    projetosFinalizados: number;
  }> {
    const [usuarios, projetos, projetosFinalizados] = await Promise.all([
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM public.usuarios WHERE tenant_id = $1 AND ativo = true`,
        [tenantId]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM public.projetos WHERE tenant_id = $1`,
        [tenantId]
      ),
      this.db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM public.projetos WHERE tenant_id = $1 AND status = 'finalizado'`,
        [tenantId]
      ),
    ]);

    return {
      usuarios: usuarios ? parseInt(usuarios.count, 10) : 0,
      projetos: projetos ? parseInt(projetos.count, 10) : 0,
      projetosFinalizados: projetosFinalizados ? parseInt(projetosFinalizados.count, 10) : 0,
    };
  }

  /**
   * Normaliza CNPJ removendo formatação
   */
  private normalizarCnpj(cnpj: string): string {
    return cnpj.replace(/[.\-\/]/g, '');
  }
}
