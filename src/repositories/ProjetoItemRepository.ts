import { Database } from '../infra/db';
import { ProjetoItem } from '../domain/ProjetoItem';

/**
 * Repository para itens de projeto (projeto_itens).
 */
export class ProjetoItemRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Cria um novo item em um projeto.
   */
  public async criar(
    projetoId: string,
    nome: string,
    quantidade: number,
    unidadeMedida: string,
    descricao?: string,
    ordem?: number,
    observacoes?: string
  ): Promise<ProjetoItem> {
    const query = `
      INSERT INTO projeto_itens (projeto_id, nome, descricao, quantidade, unidade_medida, ordem, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const row = await this.db.queryOne<any>(query, [
      projetoId,
      nome,
      descricao ?? null,
      quantidade,
      unidadeMedida,
      ordem ?? null,
      observacoes ?? null
    ]);
    return this.mapRowToProjetoItem(row);
  }

  /**
   * Lista todos os itens de um projeto.
   */
  public async listarPorProjeto(projetoId: string): Promise<ProjetoItem[]> {
    const query = `
      SELECT * FROM projeto_itens
      WHERE projeto_id = $1
      ORDER BY ordem ASC NULLS LAST, criado_em ASC
    `;
    const rows = await this.db.query<any>(query, [projetoId]);
    return rows.map((row: any) => this.mapRowToProjetoItem(row));
  }

  /**
   * Busca um item por ID.
   */
  public async buscarPorId(id: string): Promise<ProjetoItem | null> {
    const query = 'SELECT * FROM projeto_itens WHERE id = $1';
    const row = await this.db.queryOne<any>(query, [id]);
    if (!row) return null;
    return this.mapRowToProjetoItem(row);
  }

  /**
   * Atualiza um item.
   */
  public async atualizar(
    id: string,
    dados: {
      nome?: string;
      descricao?: string;
      quantidade?: number;
      unidadeMedida?: string;
      ordem?: number;
      observacoes?: string;
    }
  ): Promise<ProjetoItem> {
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
    if (dados.quantidade !== undefined) {
      fields.push(`quantidade = $${paramIndex++}`);
      values.push(dados.quantidade);
    }
    if (dados.unidadeMedida !== undefined) {
      fields.push(`unidade_medida = $${paramIndex++}`);
      values.push(dados.unidadeMedida);
    }
    if (dados.ordem !== undefined) {
      fields.push(`ordem = $${paramIndex++}`);
      values.push(dados.ordem);
    }
    if (dados.observacoes !== undefined) {
      fields.push(`observacoes = $${paramIndex++}`);
      values.push(dados.observacoes);
    }

    if (fields.length === 0) {
      const item = await this.buscarPorId(id);
      if (!item) throw new Error('Item não encontrado');
      return item;
    }

    values.push(id);
    const query = `
      UPDATE projeto_itens
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const row = await this.db.queryOne<any>(query, values);
    return this.mapRowToProjetoItem(row);
  }

  /**
   * Recalcula a mediana de um item usando a função SQL calcular_mediana_item.
   * Atualiza o campo mediana_calculada na tabela.
   */
  public async recalcularMediana(itemId: string): Promise<number | null> {
    const query = `
      UPDATE projeto_itens
      SET mediana_calculada = calcular_mediana_item($1)
      WHERE id = $1
      RETURNING mediana_calculada
    `;
    const row = await this.db.queryOne<any>(query, [itemId]);
    return row?.mediana_calculada ?? null;
  }

  /**
   * Busca itens com fontes insuficientes (<3) para um projeto.
   * Usa a função SQL get_itens_pendentes.
   */
  public async getItensComFontesInsuficientes(projetoId: string): Promise<Array<{
    itemId: string;
    nome: string;
    quantidadeFontesAtual: number;
    fontesFaltantes: number;
  }>> {
    const query = `SELECT * FROM get_itens_pendentes($1)`;
    const rows = await this.db.query<any>(query, [projetoId]);

    return rows.map((row: any) => ({
      itemId: row.item_id,
      nome: row.nome,
      quantidadeFontesAtual: row.quantidade_fontes_atual,
      fontesFaltantes: row.fontes_faltantes
    }));
  }

  /**
   * Deleta um item (e todas as fontes em cascata).
   */
  public async deletar(id: string): Promise<void> {
    const query = 'DELETE FROM projeto_itens WHERE id = $1';
    await this.db.query(query, [id]);
  }

  /**
   * Mapeia uma linha do banco para um objeto ProjetoItem.
   */
  private mapRowToProjetoItem(row: any): ProjetoItem {
    return new ProjetoItem({
      id: row.id,
      projetoId: row.projeto_id,
      nome: row.nome,
      descricao: row.descricao,
      quantidade: parseFloat(row.quantidade),
      unidadeMedida: row.unidade_medida,
      ordem: row.ordem,
      medianaCalculada: row.mediana_calculada ? parseFloat(row.mediana_calculada) : undefined,
      quantidadeFontes: row.quantidade_fontes,
      observacoes: row.observacoes,
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em
    });
  }
}
