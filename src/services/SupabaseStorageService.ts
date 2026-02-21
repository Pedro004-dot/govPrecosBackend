import { SupabaseService } from '../infra/supabase';

/**
 * Serviço para operações de Storage do Supabase
 */
export class SupabaseStorageService {
  private readonly bucketName = 'relatorios';
  private readonly supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = SupabaseService.getInstance();
  }

  /**
   * Faz upload de um relatório para o Supabase Storage
   * @param projetoId ID do projeto
   * @param tenantId ID do tenant
   * @param buffer Buffer do arquivo (PDF ou XLSX)
   * @param tipo Tipo do relatório ('completo', 'resumido', 'xlsx')
   * @returns URL pública do arquivo
   */
  public async uploadRelatorio(
    projetoId: string,
    tenantId: string,
    buffer: Buffer,
    tipo: string
  ): Promise<string> {
    try {
      const adminClient = this.supabaseService.getAdminClient();
      
      // Gerar nome do arquivo com timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const extensao = tipo === 'xlsx' ? 'xlsx' : 'pdf';
      const nomeArquivo = `${timestamp}-${tipo}.${extensao}`;
      
      // Caminho no storage: relatorios/{tenantId}/{projetoId}/{nomeArquivo}
      const caminho = `${tenantId}/${projetoId}/${nomeArquivo}`;

      // Fazer upload usando service role (bypassa RLS)
      const { data, error } = await adminClient.storage
        .from(this.bucketName)
        .upload(caminho, buffer, {
          contentType: tipo === 'xlsx' 
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/pdf',
          upsert: true, // Permitir sobrescrever para atualizar PDF com QR code
        });

      if (error) {
        throw new Error(`Erro ao fazer upload: ${error.message}`);
      }

      if (!data?.path) {
        throw new Error('Upload realizado mas caminho não retornado');
      }

      // Obter URL pública
      const publicUrl = this.getPublicUrl(this.bucketName, data.path);
      return publicUrl;
    } catch (error) {
      console.error('[SupabaseStorageService] Erro no upload:', error);
      throw error;
    }
  }

  /**
   * Constrói a URL pública de um arquivo no storage
   * @param bucket Nome do bucket
   * @param path Caminho do arquivo no bucket
   * @returns URL pública do arquivo
   */
  public getPublicUrl(bucket: string, path: string): string {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL não configurado');
    }

    // Formato: https://{project_id}.supabase.co/storage/v1/object/public/{bucket}/{path}
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  }
}
