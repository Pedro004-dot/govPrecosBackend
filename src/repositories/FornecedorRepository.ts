import { Database } from '../infra/db';
import { Fornecedor } from '../domain/Fornecedor';

/**
 * Repository para acesso aos dados de fornecedores.
 */
export class FornecedorRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Busca um fornecedor por ID.
   */
  public async buscarPorId(id: string): Promise<Fornecedor | null> {
    const query = 'SELECT * FROM fornecedores WHERE id = $1';
    const row = await this.db.queryOne<any>(query, [id]);
    if (!row) return null;
    return this.mapRowToFornecedor(row);
  }

  /**
   * Busca um fornecedor por CNPJ e tenant.
   * @param cnpj CNPJ do fornecedor (com ou sem formatação)
   * @param tenantId ID do tenant
   */
  public async buscarPorCnpj(cnpj: string, tenantId: string): Promise<Fornecedor | null> {
    const cnpjLimpo = Fornecedor.limparCnpj(cnpj);
    const query = `
      SELECT * FROM fornecedores
      WHERE REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', '') = $1
        AND tenant_id = $2
    `;
    const row = await this.db.queryOne<any>(query, [cnpjLimpo, tenantId]);
    if (!row) return null;
    return this.mapRowToFornecedor(row);
  }

  /**
   * Lista todos os fornecedores de um tenant.
   */
  public async listarPorTenant(tenantId: string): Promise<Fornecedor[]> {
    const query = `
      SELECT * FROM fornecedores
      WHERE tenant_id = $1
      ORDER BY razao_social ASC
    `;
    const rows = await this.db.query<any>(query, [tenantId]);
    return rows.map((row: any) => this.mapRowToFornecedor(row));
  }

  /**
   * Cria um novo fornecedor.
   */
  public async criar(dados: {
    tenantId: string;
    cnpj: string;
    tipoPessoa: 'PJ' | 'PF';
    razaoSocial: string;
    nomeFantasia?: string;
    porte?: string;
    naturezaJuridica?: string;
    situacao?: string;
    dataAbertura?: Date;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    email?: string;
    telefone?: string;
    atividadePrincipal?: { code: string; text: string };
    atividadesSecundarias?: Array<{ code: string; text: string }>;
    dadosCompletos: boolean;
  }): Promise<Fornecedor> {
    const query = `
      INSERT INTO fornecedores (
        tenant_id, cnpj, tipo_pessoa, razao_social, nome_fantasia,
        porte, natureza_juridica, situacao, data_abertura,
        logradouro, numero, complemento, bairro, municipio, uf, cep,
        email, telefone, atividade_principal, atividades_secundarias,
        dados_completos, ultima_atualizacao_receita
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22
      )
      RETURNING *
    `;

    const row = await this.db.queryOne<any>(query, [
      dados.tenantId,
      dados.cnpj,
      dados.tipoPessoa,
      dados.razaoSocial,
      dados.nomeFantasia ?? null,
      dados.porte ?? null,
      dados.naturezaJuridica ?? null,
      dados.situacao ?? null,
      dados.dataAbertura ?? null,
      dados.logradouro ?? null,
      dados.numero ?? null,
      dados.complemento ?? null,
      dados.bairro ?? null,
      dados.municipio ?? null,
      dados.uf ?? null,
      dados.cep ?? null,
      dados.email ?? null,
      dados.telefone ?? null,
      dados.atividadePrincipal ? JSON.stringify(dados.atividadePrincipal) : null,
      dados.atividadesSecundarias ? JSON.stringify(dados.atividadesSecundarias) : null,
      dados.dadosCompletos,
      dados.dadosCompletos ? new Date() : null,
    ]);

    if (!row) {
      throw new Error('Falha ao criar fornecedor');
    }

    return this.mapRowToFornecedor(row);
  }

  /**
   * Atualiza os dados de um fornecedor (geralmente para completar com dados da ReceitaWS).
   */
  public async atualizar(
    id: string,
    dados: {
      nomeFantasia?: string;
      porte?: string;
      naturezaJuridica?: string;
      situacao?: string;
      dataAbertura?: Date;
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      municipio?: string;
      uf?: string;
      cep?: string;
      email?: string;
      telefone?: string;
      atividadePrincipal?: { code: string; text: string };
      atividadesSecundarias?: Array<{ code: string; text: string }>;
      dadosCompletos?: boolean;
    }
  ): Promise<Fornecedor> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (dados.nomeFantasia !== undefined) {
      fields.push(`nome_fantasia = $${paramIndex++}`);
      values.push(dados.nomeFantasia);
    }
    if (dados.porte !== undefined) {
      fields.push(`porte = $${paramIndex++}`);
      values.push(dados.porte);
    }
    if (dados.naturezaJuridica !== undefined) {
      fields.push(`natureza_juridica = $${paramIndex++}`);
      values.push(dados.naturezaJuridica);
    }
    if (dados.situacao !== undefined) {
      fields.push(`situacao = $${paramIndex++}`);
      values.push(dados.situacao);
    }
    if (dados.dataAbertura !== undefined) {
      fields.push(`data_abertura = $${paramIndex++}`);
      values.push(dados.dataAbertura);
    }
    if (dados.logradouro !== undefined) {
      fields.push(`logradouro = $${paramIndex++}`);
      values.push(dados.logradouro);
    }
    if (dados.numero !== undefined) {
      fields.push(`numero = $${paramIndex++}`);
      values.push(dados.numero);
    }
    if (dados.complemento !== undefined) {
      fields.push(`complemento = $${paramIndex++}`);
      values.push(dados.complemento);
    }
    if (dados.bairro !== undefined) {
      fields.push(`bairro = $${paramIndex++}`);
      values.push(dados.bairro);
    }
    if (dados.municipio !== undefined) {
      fields.push(`municipio = $${paramIndex++}`);
      values.push(dados.municipio);
    }
    if (dados.uf !== undefined) {
      fields.push(`uf = $${paramIndex++}`);
      values.push(dados.uf);
    }
    if (dados.cep !== undefined) {
      fields.push(`cep = $${paramIndex++}`);
      values.push(dados.cep);
    }
    if (dados.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(dados.email);
    }
    if (dados.telefone !== undefined) {
      fields.push(`telefone = $${paramIndex++}`);
      values.push(dados.telefone);
    }
    if (dados.atividadePrincipal !== undefined) {
      fields.push(`atividade_principal = $${paramIndex++}`);
      values.push(JSON.stringify(dados.atividadePrincipal));
    }
    if (dados.atividadesSecundarias !== undefined) {
      fields.push(`atividades_secundarias = $${paramIndex++}`);
      values.push(JSON.stringify(dados.atividadesSecundarias));
    }
    if (dados.dadosCompletos !== undefined) {
      fields.push(`dados_completos = $${paramIndex++}`);
      values.push(dados.dadosCompletos);
      fields.push(`ultima_atualizacao_receita = $${paramIndex++}`);
      values.push(dados.dadosCompletos ? new Date() : null);
    }

    if (fields.length === 0) {
      const fornecedor = await this.buscarPorId(id);
      if (!fornecedor) throw new Error('Fornecedor não encontrado');
      return fornecedor;
    }

    values.push(id);
    const query = `
      UPDATE fornecedores
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const row = await this.db.queryOne<any>(query, values);
    if (!row) {
      throw new Error('Fornecedor não encontrado');
    }

    return this.mapRowToFornecedor(row);
  }

  /**
   * Vincula um fornecedor a um item de licitação.
   */
  public async vincularAoItemLicitacao(
    itemLicitacaoId: string,
    fornecedorId: string
  ): Promise<void> {
    const query = `
      UPDATE itens_licitacao
      SET fornecedor_id = $1
      WHERE id = $2
    `;
    await this.db.query(query, [fornecedorId, itemLicitacaoId]);
  }

  /**
   * Busca fornecedor vinculado a um item de licitação.
   */
  public async buscarPorItemLicitacao(itemLicitacaoId: string): Promise<Fornecedor | null> {
    const query = `
      SELECT f.*
      FROM fornecedores f
      INNER JOIN itens_licitacao il ON il.fornecedor_id = f.id
      WHERE il.id = $1
    `;
    const row = await this.db.queryOne<any>(query, [itemLicitacaoId]);
    if (!row) return null;
    return this.mapRowToFornecedor(row);
  }

  /**
   * Deleta um fornecedor.
   */
  public async deletar(id: string): Promise<void> {
    const query = 'DELETE FROM fornecedores WHERE id = $1';
    await this.db.query(query, [id]);
  }

  /**
   * Mapeia uma linha do banco para um objeto Fornecedor.
   */
  private mapRowToFornecedor(row: any): Fornecedor {
    return new Fornecedor({
      id: row.id,
      tenantId: row.tenant_id,
      cnpj: row.cnpj,
      tipoPessoa: row.tipo_pessoa,
      razaoSocial: row.razao_social,
      nomeFantasia: row.nome_fantasia,
      porte: row.porte,
      naturezaJuridica: row.natureza_juridica,
      situacao: row.situacao,
      dataAbertura: row.data_abertura,
      logradouro: row.logradouro,
      numero: row.numero,
      complemento: row.complemento,
      bairro: row.bairro,
      municipio: row.municipio,
      uf: row.uf,
      cep: row.cep,
      email: row.email,
      telefone: row.telefone,
      atividadePrincipal: row.atividade_principal,
      atividadesSecundarias: row.atividades_secundarias,
      dadosCompletos: row.dados_completos,
      ultimaAtualizacaoReceita: row.ultima_atualizacao_receita,
      criadoEm: row.criado_em,
      atualizadoEm: row.atualizado_em,
    });
  }
}
