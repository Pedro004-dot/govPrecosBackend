import { Database } from '../infra/db';
import crypto from 'crypto';

export interface PasswordResetToken {
  id: string;
  usuarioId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  criadoEm: Date;
}

/**
 * Repositório para tokens de recuperação de senha
 */
export class PasswordResetRepository {
  constructor(private readonly db: Database) {}

  /**
   * Cria um novo token de recuperação de senha
   * Retorna o token em texto plano (para enviar por email)
   */
  public async criar(usuarioId: string): Promise<string> {
    // Gerar token aleatório
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    // Expirar em 1 hora
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Invalidar tokens anteriores do mesmo usuário
    await this.invalidarTokensAnteriores(usuarioId);

    // Criar novo token
    await this.db.query(
      `INSERT INTO public.password_reset_tokens (usuario_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [usuarioId, tokenHash, expiresAt]
    );

    return token;
  }

  /**
   * Busca token válido pelo hash
   */
  public async buscarPorToken(token: string): Promise<PasswordResetToken | null> {
    const tokenHash = this.hashToken(token);

    const row = await this.db.queryOne<any>(
      `SELECT * FROM public.password_reset_tokens
       WHERE token_hash = $1
       AND expires_at > NOW()
       AND used_at IS NULL`,
      [tokenHash]
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      usuarioId: row.usuario_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      usedAt: row.used_at ? new Date(row.used_at) : null,
      criadoEm: new Date(row.criado_em),
    };
  }

  /**
   * Marca token como usado
   */
  public async marcarComoUsado(id: string): Promise<void> {
    await this.db.query(
      `UPDATE public.password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  /**
   * Invalida todos os tokens anteriores de um usuário
   */
  public async invalidarTokensAnteriores(usuarioId: string): Promise<void> {
    await this.db.query(
      `UPDATE public.password_reset_tokens
       SET used_at = NOW()
       WHERE usuario_id = $1 AND used_at IS NULL`,
      [usuarioId]
    );
  }

  /**
   * Limpa tokens expirados (para manutenção)
   */
  public async limparExpirados(): Promise<number> {
    const rows = await this.db.query(
      `DELETE FROM public.password_reset_tokens
       WHERE expires_at < NOW() OR used_at IS NOT NULL
       RETURNING id`
    );
    return rows.length;
  }

  /**
   * Hash do token usando SHA-256
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
