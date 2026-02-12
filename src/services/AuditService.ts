import { Database } from '../infra/db';

export interface AuditLogEntry {
  usuarioId: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  dadosAntes?: Record<string, any>;
  dadosDepois?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

export interface AuditLog {
  id: string;
  usuarioId: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  dadosAntes: Record<string, any> | null;
  dadosDepois: Record<string, any> | null;
  ip: string | null;
  userAgent: string | null;
  criadoEm: Date;
}

/**
 * Serviço de auditoria para registrar ações no sistema
 */
export class AuditService {
  constructor(private readonly db: Database) {}

  /**
   * Registra uma ação no log de auditoria
   */
  public async registrar(entry: AuditLogEntry): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO public.audit_logs (usuario_id, acao, entidade, entidade_id, dados_antes, dados_depois, ip, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.usuarioId,
          entry.acao,
          entry.entidade,
          entry.entidadeId || null,
          entry.dadosAntes ? JSON.stringify(entry.dadosAntes) : null,
          entry.dadosDepois ? JSON.stringify(entry.dadosDepois) : null,
          entry.ip || null,
          entry.userAgent || null,
        ]
      );
    } catch (error) {
      // Não falhar a operação principal por erro de auditoria
      console.error('[AuditService.registrar] Erro ao registrar log:', error);
    }
  }

  /**
   * Lista logs de auditoria com filtros
   */
  public async listar(filtros: {
    usuarioId?: string;
    tenantId?: string;
    acao?: string;
    entidade?: string;
    entidadeId?: string;
    dataInicio?: Date;
    dataFim?: Date;
    limite?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (filtros.usuarioId) {
      conditions.push(`al.usuario_id = $${paramIndex++}`);
      params.push(filtros.usuarioId);
    }

    if (filtros.tenantId) {
      conditions.push(`u.tenant_id = $${paramIndex++}`);
      params.push(filtros.tenantId);
    }

    if (filtros.acao) {
      conditions.push(`al.acao = $${paramIndex++}`);
      params.push(filtros.acao);
    }

    if (filtros.entidade) {
      conditions.push(`al.entidade = $${paramIndex++}`);
      params.push(filtros.entidade);
    }

    if (filtros.entidadeId) {
      conditions.push(`al.entidade_id = $${paramIndex++}`);
      params.push(filtros.entidadeId);
    }

    if (filtros.dataInicio) {
      conditions.push(`al.criado_em >= $${paramIndex++}`);
      params.push(filtros.dataInicio);
    }

    if (filtros.dataFim) {
      conditions.push(`al.criado_em <= $${paramIndex++}`);
      params.push(filtros.dataFim);
    }

    const whereClause = conditions.join(' AND ');
    const limite = filtros.limite || 50;
    const offset = filtros.offset || 0;

    // Contar total
    const countRow = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM public.audit_logs al
       LEFT JOIN public.usuarios u ON u.id = al.usuario_id
       WHERE ${whereClause}`,
      params
    );
    const total = countRow ? parseInt(countRow.count, 10) : 0;

    // Buscar logs
    const rows = await this.db.query<any>(
      `SELECT al.*
       FROM public.audit_logs al
       LEFT JOIN public.usuarios u ON u.id = al.usuario_id
       WHERE ${whereClause}
       ORDER BY al.criado_em DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limite, offset]
    );

    const logs: AuditLog[] = rows.map((row) => ({
      id: row.id,
      usuarioId: row.usuario_id,
      acao: row.acao,
      entidade: row.entidade,
      entidadeId: row.entidade_id,
      dadosAntes: row.dados_antes,
      dadosDepois: row.dados_depois,
      ip: row.ip,
      userAgent: row.user_agent,
      criadoEm: new Date(row.criado_em),
    }));

    return { logs, total };
  }

  /**
   * Busca logs de uma entidade específica
   */
  public async listarPorEntidade(
    entidade: string,
    entidadeId: string,
    limite: number = 50
  ): Promise<AuditLog[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM public.audit_logs
       WHERE entidade = $1 AND entidade_id = $2
       ORDER BY criado_em DESC
       LIMIT $3`,
      [entidade, entidadeId, limite]
    );

    return rows.map((row) => ({
      id: row.id,
      usuarioId: row.usuario_id,
      acao: row.acao,
      entidade: row.entidade,
      entidadeId: row.entidade_id,
      dadosAntes: row.dados_antes,
      dadosDepois: row.dados_depois,
      ip: row.ip,
      userAgent: row.user_agent,
      criadoEm: new Date(row.criado_em),
    }));
  }

  /**
   * Busca logs de um usuário específico
   */
  public async listarPorUsuario(
    usuarioId: string,
    limite: number = 50
  ): Promise<AuditLog[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM public.audit_logs
       WHERE usuario_id = $1
       ORDER BY criado_em DESC
       LIMIT $2`,
      [usuarioId, limite]
    );

    return rows.map((row) => ({
      id: row.id,
      usuarioId: row.usuario_id,
      acao: row.acao,
      entidade: row.entidade,
      entidadeId: row.entidade_id,
      dadosAntes: row.dados_antes,
      dadosDepois: row.dados_depois,
      ip: row.ip,
      userAgent: row.user_agent,
      criadoEm: new Date(row.criado_em),
    }));
  }
}
