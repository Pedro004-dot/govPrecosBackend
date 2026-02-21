import { SupabaseService } from '../infra/supabase';

/**
 * Serviço para upload de arquivos no Supabase Storage
 */
export class StorageService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Faz upload de um arquivo para o Supabase Storage
   * @param bucket Nome do bucket
   * @param path Caminho do arquivo no bucket (ex: tenant_id/brasao.png)
   * @param file Buffer do arquivo
   * @param contentType MIME type do arquivo
   * @returns URL pública do arquivo
   */
  public async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string
  ): Promise<string> {
    const client = this.supabaseService.getAdminClient();

    // Upload do arquivo
    const { data, error } = await client.storage
      .from(bucket)
      .upload(path, file, {
        contentType,
        cacheControl: '3600',
        upsert: true, // Sobrescrever se já existir
      });

    if (error) {
      console.error('[StorageService.uploadFile] Erro ao fazer upload:', error);
      throw new Error(`Erro ao fazer upload: ${error.message}`);
    }

    // Obter URL pública
    const { data: publicUrlData } = client.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  }

  /**
   * Remove um arquivo do Supabase Storage
   * @param bucket Nome do bucket
   * @param path Caminho do arquivo no bucket
   */
  public async deleteFile(bucket: string, path: string): Promise<void> {
    const client = this.supabaseService.getAdminClient();

    const { error } = await client.storage.from(bucket).remove([path]);

    if (error) {
      console.error('[StorageService.deleteFile] Erro ao deletar arquivo:', error);
      throw new Error(`Erro ao deletar arquivo: ${error.message}`);
    }
  }

  /**
   * Extrai o caminho do arquivo de uma URL pública do Supabase Storage
   * @param publicUrl URL pública do arquivo
   * @returns Caminho do arquivo (ex: tenant_id/brasao.png)
   */
  public extractPathFromUrl(publicUrl: string): string | null {
    try {
      const url = new URL(publicUrl);
      // Formato: https://...supabase.co/storage/v1/object/public/bucket_name/path
      const parts = url.pathname.split('/');
      const bucketIndex = parts.indexOf('public');
      if (bucketIndex === -1 || bucketIndex + 2 >= parts.length) {
        return null;
      }
      // Retornar tudo após o nome do bucket
      return parts.slice(bucketIndex + 2).join('/');
    } catch {
      return null;
    }
  }
}
