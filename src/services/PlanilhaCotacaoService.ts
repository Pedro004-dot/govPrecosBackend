import * as XLSX from 'xlsx';
import { ItemLicitacaoRepository } from '../repositories/ItemLicitacaoRepository';

const MAX_LINHAS = 200;
const MATCHES_POR_LINHA = 10;

export interface MatchSugerido {
  id: string;
  descricao: string;
  valorUnitarioEstimado?: number;
  valorTotal?: number;
  quantidade?: number;
  unidadeMedida?: string;
}

export interface LinhaPlanilha {
  linha: number;
  descricaoOriginal: string;
  quantidade?: number;
  unidade?: string;
  matches: MatchSugerido[];
}

export interface ResultadoUploadPlanilha {
  linhas: LinhaPlanilha[];
}

function normalizarChave(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300/g, '')
    .trim();
}

function encontrarColunaDescricao(keys: string[]): string {
  const desc = keys.find(
    (k) =>
      normalizarChave(k).includes('desc') ||
      normalizarChave(k).includes('item') ||
      normalizarChave(k).includes('produto') ||
      normalizarChave(k).includes('especificacao')
  );
  return desc ?? keys[0];
}

function encontrarColunaQuantidade(keys: string[]): string | null {
  return (
    keys.find(
      (k) =>
        normalizarChave(k).includes('quantidade') ||
        normalizarChave(k).includes('qtd') ||
        normalizarChave(k) === 'qtde'
    ) ?? null
  );
}

function encontrarColunaUnidade(keys: string[]): string | null {
  return (
    keys.find(
      (k) =>
        normalizarChave(k).includes('unidade') ||
        normalizarChave(k).includes('um') ||
        normalizarChave(k).includes('medida')
    ) ?? null
  );
}

/**
 * Serviço que processa planilha Excel e sugere itens do histórico para cada linha.
 */
export class PlanilhaCotacaoService {
  constructor(private readonly itemRepository: ItemLicitacaoRepository) {}

  /**
   * Gera um modelo de planilha Excel para importação de itens.
   * Retorna um Buffer do arquivo Excel com colunas pré-definidas e exemplos.
   */
  public gerarModelo(): Buffer {
    // Criar workbook
    const workbook = XLSX.utils.book_new();

    // Dados do modelo com exemplos
    const dados = [
      // Cabeçalhos
      ['Descrição do Item', 'Quantidade', 'Unidade de Medida'],
      // Exemplos
      ['Caneta esferográfica azul', '100', 'UN'],
      ['Papel A4 sulfite branco', '50', 'RESMA'],
      ['Grampeador de mesa médio', '10', 'UN'],
      ['Clipes de papel nº 2', '20', 'CX'],
      ['Caderno espiral 96 folhas', '30', 'UN'],
    ];

    // Criar planilha a partir dos dados
    const worksheet = XLSX.utils.aoa_to_sheet(dados);

    // Definir larguras das colunas
    worksheet['!cols'] = [
      { wch: 50 }, // Descrição do Item
      { wch: 15 }, // Quantidade
      { wch: 20 }, // Unidade de Medida
    ];

    // Adicionar planilha ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Itens');

    // Adicionar segunda aba com instruções
    const instrucoes = [
      ['INSTRUÇÕES PARA IMPORTAÇÃO DE ITENS'],
      [''],
      ['1. Preencha a aba "Itens" com seus dados'],
      ['2. Colunas obrigatórias:'],
      ['   - Descrição do Item: Nome/especificação do produto ou serviço'],
      [''],
      ['3. Colunas opcionais (mas recomendadas):'],
      ['   - Quantidade: Quantidade numérica (exemplo: 10, 50, 100)'],
      ['   - Unidade de Medida: UN, CX, RESMA, KG, L, M, etc.'],
      [''],
      ['4. Detecção automática de colunas:'],
      ['   O sistema detecta automaticamente as colunas mesmo com nomes diferentes:'],
      ['   - Descrição: aceita "Descrição", "Item", "Produto", "Especificação"'],
      ['   - Quantidade: aceita "Quantidade", "Qtd", "Qtde"'],
      ['   - Unidade: aceita "Unidade", "UM", "Unidade de Medida"'],
      [''],
      ['5. Limites:'],
      ['   - Máximo 200 linhas por arquivo'],
      ['   - Tamanho máximo do arquivo: 5MB'],
      ['   - Formatos aceitos: .xlsx, .xls'],
      [''],
      ['6. Após importar:'],
      ['   - O sistema buscará itens similares no histórico do PNCP'],
      ['   - Você poderá revisar e aceitar as sugestões'],
      ['   - Ou criar novos itens se necessário'],
      [''],
      ['7. Dicas:'],
      ['   - Seja específico na descrição (marca, modelo, características)'],
      ['   - Use descrições consistentes para facilitar a busca'],
      ['   - Revise os dados antes de enviar'],
    ];

    const worksheetInstrucoes = XLSX.utils.aoa_to_sheet(instrucoes);
    worksheetInstrucoes['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(workbook, worksheetInstrucoes, 'Instruções');

    // Gerar buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buffer);
  }

  /**
   * Processa o buffer do Excel e retorna linhas com sugestões de matches (busca por descrição).
   */
  public async processar(buffer: Buffer): Promise<ResultadoUploadPlanilha> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { linhas: [] };
    }
    const sheet = workbook.Sheets[firstSheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (raw.length === 0) return { linhas: [] };

    const keys = Object.keys(raw[0] ?? {});
    const colDesc = encontrarColunaDescricao(keys);
    const colQtd = encontrarColunaQuantidade(keys);
    const colUn = encontrarColunaUnidade(keys);

    const linhas: LinhaPlanilha[] = [];
    const limite = Math.min(raw.length, MAX_LINHAS);

    for (let i = 0; i < limite; i++) {
      const row = raw[i] ?? {};
      const descricao = String(row[colDesc] ?? '').trim();
      if (!descricao) continue;

      const quantidade =
        colQtd != null && row[colQtd] != null
          ? Number(row[colQtd])
          : undefined;
      const unidade =
        colUn != null && row[colUn] != null ? String(row[colUn]).trim() : undefined;

      const rows = await this.itemRepository.searchByDescricaoWithLicitacao(
        descricao,
        MATCHES_POR_LINHA,
        0
      );
      const matches: MatchSugerido[] = rows.map((r) => ({
        id: r.item.id!,
        descricao: r.item.descricao,
        valorUnitarioEstimado: r.item.valorUnitarioEstimado,
        valorTotal: r.item.valorTotal,
        quantidade: r.item.quantidade,
        unidadeMedida: r.item.unidadeMedida,
      }));

      linhas.push({
        linha: i + 1,
        descricaoOriginal: descricao,
        ...(quantidade !== undefined && !Number.isNaN(quantidade) && { quantidade }),
        ...(unidade && { unidade }),
        matches,
      });
    }

    return { linhas };
  }
}
