import { Database } from '../infra/db';
import { Projeto } from '../domain/Projeto';

/**
 * Repository para projetos de pesquisa de preços (Lei 14.133/2021).
 */
export class ProjetoRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Cria um novo projeto.
   */
  public async criar(
    tenantId: string,
    usuarioId: string,
    nome: string,
    descricao?: string,
    numeroProcesso?: string,
    objeto?: string
  ): Promise<Projeto> {
    const query = `
      INSERT INTO projetos (tenant_id, usuario_id, nome, descricao, numero_processo, objeto, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'rascunho')
      RETURNING *
    `;
    const row = await this.db.queryOne<any>(query, [
      tenantId,
      usuarioId,
      nome,
      descricao ?? null,
      numeroProcesso ?? null,
      objeto ?? null
    ]);
    return this.mapRowToProjeto(row);
  }

  /**
   * Lista todos os projetos de um tenant.
   * @param incluirArquivados Se false, exclui projetos cancelados (padrão: true)
   */
  public async listarPorTenant(tenantId: string, incluirArquivados: boolean = true): Promise<Projeto[]> {
    let query = `
      SELECT * FROM projetos
      WHERE tenant_id = $1
    `;

    if (!incluirArquivados) {
      query += ` AND status != 'cancelado'`;
    }

    query += ` ORDER BY criado_em DESC`;

    const rows = await this.db.query<any>(query, [tenantId]);
    return rows.map((row: any) => this.mapRowToProjeto(row));
  }

  /**
   * Busca um projeto por ID.
   */
  public async buscarPorId(id: string): Promise<Projeto | null> {
    const query = 'SELECT * FROM projetos WHERE id = $1';
    const row = await this.db.queryOne<any>(query, [id]);
    if (!row) return null;
    return this.mapRowToProjeto(row);
  }

  /**
   * Atualiza um projeto.
   */
  public async atualizar(
    id: string,
    dados: {
      nome?: string;
      descricao?: string;
      numeroProcesso?: string;
      objeto?: string;
      status?: 'rascunho' | 'em_andamento' | 'finalizado' | 'cancelado';
      dataFinalizacao?: Date;
    }
  ): Promise<Projeto> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dados.nome !== undefined) {
      fields.push(`nome = $${paramIndex++}`);
      values.push(dados.nome);
    }
    if (dados.descricao !== undefined) {
      fields.push(`descricao = $${paramIndex++}`);
      values.push(dados.descricao);
    }
    if (dados.numeroProcesso !== undefined) {
      fields.push(`numero_processo = $${paramIndex++}`);
      values.push(dados.numeroProcesso);
    }
    if (dados.objeto !== undefined) {
      fields.push(`objeto = $${paramIndex++}`);
      values.push(dados.objeto);
    }
    if (dados.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(dados.status);
    }
    if (dados.dataFinalizacao !== undefined) {
      fields.push(`data_finalizacao = $${paramIndex++}`);
      values.push(dados.dataFinalizacao);
    }

    if (fields.length === 0) {
      // Nada para atualizar, retorna o projeto atual
      const projeto = await this.buscarPorId(id);
      if (!projeto) throw new Error('Projeto não encontrado');
      return projeto;
    }

    values.push(id);
    const query = `
      UPDATE projetos
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const row = await this.db.queryOne<any>(query, values);
    return this.mapRowToProjeto(row);
  }

  /**
   * Finaliza um projeto (marca como 'finalizado' e define data_finalizacao).
   * IMPORTANTE: Deve validar que todos os itens têm 3+ fontes antes de chamar este método.
   */
  public async finalizarProjeto(id: string): Promise<Projeto> {
    const query = `
      UPDATE projetos
      SET status = 'finalizado', data_finalizacao = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const row = await this.db.queryOne<any>(query, [id]);
    return this.mapRowToProjeto(row);
  }

  /**
   * Valida se um projeto pode ser finalizado (todos os itens têm 3+ fontes).
   * Usa a função SQL validar_projeto_finalizacao.
   */
  public async validarIntegridade(projetoId: string): Promise<{
    valido: boolean;
    totalItens: number;
    itensPendentes: number;
    mensagem: string;
  }> {
    const query = `SELECT * FROM validar_projeto_finalizacao($1)`;
    const row = await this.db.queryOne<any>(query, [projetoId]);

    return {
      valido: row.valido,
      totalItens: row.total_itens,
      itensPendentes: row.itens_pendentes,
      mensagem: row.mensagem
    };
  }

  /**
   * Deleta um projeto (e todos os itens e fontes em cascata).
   */
  public async deletar(id: string): Promise<void> {
    const query = 'DELETE FROM projetos WHERE id = $1';
    await this.db.query(query, [id]);
  }

  /**
   * Mapeia uma linha do banco para um objeto Projeto.
   */
  private mapRowToProjeto(row: any): Projeto {
    return new Projeto({
      id: row.id,
      tenantId: row.tenant_id,
      usuarioId: row.usuario_id,
      nome: row.nome,
      descricao: row.descricao,
      numeroProcesso: row.numero_processo,
      objeto: row.objeto,
      status: row.status,
      dataFinalizacao: row.data_finalizacao,
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em
    });
  }
}
