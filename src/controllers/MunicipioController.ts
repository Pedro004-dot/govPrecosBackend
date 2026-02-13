import { Request, Response } from 'express';
import { MunicipioRepository } from '../repositories/MunicipioRepository';

export class MunicipioController {
  private municipioRepository: MunicipioRepository;

  constructor(municipioRepository: MunicipioRepository) {
    this.municipioRepository = municipioRepository;
  }

  /**
   * GET /api/municipios/ufs
   * Lista todas as UFs disponíveis.
   */
  public async listarUFs(_req: Request, res: Response): Promise<void> {
    try {
      const ufs = await this.municipioRepository.listarUFs();
      res.json({
        success: true,
        ufs,
      });
    } catch (error) {
      console.error('Erro ao listar UFs:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao listar UFs',
      });
    }
  }

  /**
   * GET /api/municipios/por-uf/:uf
   * Lista municípios de uma UF específica.
   */
  public async listarPorUF(req: Request, res: Response): Promise<void> {
    const codigoUf = req.params.uf;

    if (!codigoUf) {
      res.status(400).json({
        success: false,
        message: 'Parâmetro uf é obrigatório',
      });
      return;
    }

    try {
      const municipios = await this.municipioRepository.listarPorUF(codigoUf);
      res.json({
        success: true,
        municipios,
      });
    } catch (error) {
      console.error('Erro ao listar municípios:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao listar municípios',
      });
    }
  }
}
