
export class Cnpj {
  private readonly value: string;

  constructor(cnpj: string) {
    const cleaned = this.clean(cnpj);
    if (!this.isValid(cleaned)) {
      throw new Error(`CNPJ inválido: ${cnpj}`);
    }
    this.value = cleaned;
  }

  /**
   * Remove formatação do CNPJ (pontos, barras, hífens)
   */
  private clean(cnpj: string): string {
    return cnpj.replace(/[^\d]/g, '');
  }

  /**
   * Valida CNPJ usando algoritmo de validação
   */
  private isValid(cnpj: string): boolean {
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false; // Todos os dígitos iguais

    let length = cnpj.length - 2;
    let numbers = cnpj.substring(0, length);
    const digits = cnpj.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    length = length + 1;
    numbers = cnpj.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result === parseInt(digits.charAt(1));
  }

  /**
   * Retorna CNPJ sem formatação (apenas números)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Retorna CNPJ formatado (XX.XXX.XXX/XXXX-XX)
   */
  getFormatted(): string {
    return this.value.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5'
    );
  }

  /**
   * Compara dois CNPJs
   */
  equals(other: Cnpj): boolean {
    return this.value === other.value;
  }
}
