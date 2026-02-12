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
