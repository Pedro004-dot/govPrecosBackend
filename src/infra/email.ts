import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Serviço de envio de emails via Gmail (Nodemailer)
 *
 * Configuração:
 * 1. Ative "Verificação em duas etapas" na conta Google
 * 2. Crie uma "Senha de app" em: https://myaccount.google.com/apppasswords
 * 3. Use essa senha no GMAIL_APP_PASSWORD
 */
export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;
  private fromName: string;
  private appName: string;
  private appUrl: string;
  private enabled: boolean;

  private constructor() {
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    this.enabled = !!(gmailUser && gmailAppPassword);

    if (!this.enabled) {
      console.warn('[EmailService] GMAIL_USER ou GMAIL_APP_PASSWORD não configurado - emails desabilitados');
    } else {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });
    }

    this.fromEmail = gmailUser || 'noreply@govprecos.com.br';
    this.fromName = process.env.EMAIL_FROM_NAME || 'GovPreços';
    this.appName = process.env.APP_NAME || 'GovPreços';
    this.appUrl = process.env.APP_URL || 'http://localhost:5173';
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Verifica se o serviço de email está habilitado
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Envia email de recuperação de senha
   */
  public async sendPasswordResetEmail(
    email: string,
    nome: string,
    token: string
  ): Promise<void> {
    if (!this.enabled || !this.transporter) {
      console.log(`[EmailService] Email desabilitado - não enviando reset para ${email}`);
      return;
    }

    const resetUrl = `${this.appUrl}/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: email,
        subject: `Recuperação de senha - ${this.appName}`,
        html: this.getPasswordResetTemplate(nome, resetUrl),
      });
      console.log(`[EmailService] Email de reset enviado para ${email}`);
    } catch (error: any) {
      console.error('[EmailService.sendPasswordResetEmail] Erro:', error.message);
      throw new Error(`Erro ao enviar email: ${error.message}`);
    }
  }

  /**
   * Envia email de boas-vindas para novos usuários
   */
  public async sendWelcomeEmail(
    email: string,
    nome: string,
    senhaTemporaria?: string
  ): Promise<void> {
    if (!this.enabled || !this.transporter) {
      console.log(`[EmailService] Email desabilitado - não enviando welcome para ${email}`);
      return;
    }

    const loginUrl = `${this.appUrl}/login`;

    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: email,
        subject: `Bem-vindo ao ${this.appName}!`,
        html: this.getWelcomeTemplate(nome, loginUrl, senhaTemporaria),
      });
      console.log(`[EmailService] Email de boas-vindas enviado para ${email}`);
    } catch (error: any) {
      console.error('[EmailService.sendWelcomeEmail] Erro:', error.message);
      throw new Error(`Erro ao enviar email: ${error.message}`);
    }
  }

  /**
   * Template de email para recuperação de senha
   */
  private getPasswordResetTemplate(nome: string, resetUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; background-color: #f4f4f8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px 30px; background-color: #1a1a2e; text-align: center;">
        <h1 style="color: #f5a623; margin: 0; font-size: 28px;">${this.appName}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #1a1a2e; margin-top: 0;">Olá, ${nome}!</h2>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
        <p>Clique no botão abaixo para criar uma nova senha:</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 30px 0;">
              <a href="${resetUrl}" style="display: inline-block; padding: 16px 32px; background-color: #f5a623; color: #1a1a2e; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 16px;">Redefinir Senha</a>
            </td>
          </tr>
        </table>
        <p style="color: #666; font-size: 14px;">Este link expira em <strong>1 hora</strong>.</p>
        <p style="color: #666; font-size: 14px;">Se você não solicitou a redefinição de senha, ignore este email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
        <p style="color: #999; font-size: 12px; word-break: break-all;">${resetUrl}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; background-color: #f4f4f8; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} ${this.appName}. Todos os direitos reservados.</p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Template de email de boas-vindas
   */
  private getWelcomeTemplate(
    nome: string,
    loginUrl: string,
    senhaTemporaria?: string
  ): string {
    const senhaSection = senhaTemporaria
      ? `
        <p><strong>Sua senha temporária é:</strong></p>
        <p style="background-color: #f4f4f8; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 18px; text-align: center;">${senhaTemporaria}</p>
        <p style="color: #e74c3c; font-size: 14px;"><strong>Importante:</strong> Por segurança, altere sua senha após o primeiro acesso.</p>
      `
      : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao ${this.appName}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a2e; margin: 0; padding: 0; background-color: #f4f4f8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="padding: 40px 30px; background-color: #1a1a2e; text-align: center;">
        <h1 style="color: #f5a623; margin: 0; font-size: 28px;">${this.appName}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 30px;">
        <h2 style="color: #1a1a2e; margin-top: 0;">Bem-vindo, ${nome}!</h2>
        <p>Sua conta foi criada com sucesso no ${this.appName}.</p>
        ${senhaSection}
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 30px 0;">
              <a href="${loginUrl}" style="display: inline-block; padding: 16px 32px; background-color: #f5a623; color: #1a1a2e; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 16px;">Acessar o Sistema</a>
            </td>
          </tr>
        </table>
        <p>Se tiver dúvidas, entre em contato com o administrador da sua prefeitura.</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 30px; background-color: #f4f4f8; text-align: center;">
        <p style="color: #999; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} ${this.appName}. Todos os direitos reservados.</p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}
