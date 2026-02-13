-- Migração 002: Reestruturação para Lei 14.133/2021
-- Projeto: GovPrecos
-- Banco: PostgreSQL (Supabase)
-- Descrição: Adiciona nova estrutura Projeto → Itens → Fontes para compliance com Lei 14.133/2021

-- ============================================
-- 1. ARCHIVE OLD SYSTEM
-- ============================================
-- Add archived flag to old pesquisas_preco table
ALTER TABLE pesquisas_preco ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Mark existing quotes as archived
UPDATE pesquisas_preco SET archived = true WHERE archived IS NULL OR archived = false;

-- Add index for filtering archived records
CREATE INDEX IF NOT EXISTS idx_pesquisas_archived ON pesquisas_preco(archived) WHERE archived = false;

COMMENT ON COLUMN pesquisas_preco.archived IS 'Marca cotações antigas (pré-Lei 14.133/2021) como arquivadas. Apenas visualização.';

-- ============================================
-- 2. PROJETOS (Top-level procurement projects)
-- ============================================
CREATE TABLE IF NOT EXISTS projetos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    numero_processo VARCHAR(100), -- e.g., "Processo 123/2026"
    objeto TEXT, -- Purpose of procurement
    status VARCHAR(20) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_andamento', 'finalizado', 'cancelado')),
    data_finalizacao TIMESTAMP WITH TIME ZONE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projetos_tenant ON projetos(tenant_id);
CREATE INDEX idx_projetos_usuario ON projetos(usuario_id);
CREATE INDEX idx_projetos_status ON projetos(status);
CREATE INDEX idx_projetos_criado_em ON projetos(criado_em DESC);

COMMENT ON TABLE projetos IS 'Projetos de pesquisa de preços conforme Lei 14.133/2021 (substitui pesquisas_preco antigas)';
COMMENT ON COLUMN projetos.numero_processo IS 'Número do processo administrativo (ex: 123/2026)';
COMMENT ON COLUMN projetos.objeto IS 'Descrição do objeto da contratação';
COMMENT ON COLUMN projetos.status IS 'rascunho: em edição | em_andamento: aguardando fontes | finalizado: completo com 3+ fontes por item | cancelado: cancelado';

-- Trigger for updated_at (reuses function from migration 001)
CREATE TRIGGER update_projetos_updated_at BEFORE UPDATE ON projetos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. PROJETO_ITENS (User-defined items within project)
-- ============================================
CREATE TABLE IF NOT EXISTS projeto_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    nome VARCHAR(300) NOT NULL, -- User-defined item name
    descricao TEXT, -- Additional details
    quantidade DECIMAL(15,4) NOT NULL CHECK (quantidade > 0),
    unidade_medida VARCHAR(20) NOT NULL, -- UN, CX, KG, M2, etc.
    ordem INTEGER, -- Display order within project
    mediana_calculada DECIMAL(15,4), -- Calculated from non-ignored sources
    quantidade_fontes INTEGER DEFAULT 0, -- Count of linked sources (maintained by trigger)
    observacoes TEXT, -- User notes
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projeto_itens_projeto ON projeto_itens(projeto_id);
CREATE INDEX idx_projeto_itens_fontes_count ON projeto_itens(quantidade_fontes);
CREATE INDEX idx_projeto_itens_ordem ON projeto_itens(projeto_id, ordem);

COMMENT ON TABLE projeto_itens IS 'Itens definidos manualmente pelo usuário (ex: Lápis nº 2 Preto, 500 UN)';
COMMENT ON COLUMN projeto_itens.nome IS 'Nome do item definido pelo usuário';
COMMENT ON COLUMN projeto_itens.mediana_calculada IS 'Mediana calculada a partir das fontes não-ignoradas (atualizada via função SQL)';
COMMENT ON COLUMN projeto_itens.quantidade_fontes IS 'Total de fontes vinculadas (atualizado automaticamente via trigger). Mínimo 3 para finalizar.';

-- Trigger for updated_at
CREATE TRIGGER update_projeto_itens_updated_at BEFORE UPDATE ON projeto_itens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. ITEM_FONTES (PNCP sources linked to each item)
-- ============================================
CREATE TABLE IF NOT EXISTS item_fontes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_item_id UUID NOT NULL REFERENCES projeto_itens(id) ON DELETE CASCADE,
    item_licitacao_id UUID NOT NULL REFERENCES itens_licitacao(id) ON DELETE CASCADE,
    valor_unitario DECIMAL(15,4) NOT NULL, -- Price from PNCP source (extracted from item_licitacao)
    ignorado_calculo BOOLEAN DEFAULT false, -- User can mark as outlier
    justificativa_exclusao TEXT, -- Why excluded from calculation
    data_licitacao TIMESTAMP WITH TIME ZONE, -- Denormalized from licitacoes for recency check
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(projeto_item_id, item_licitacao_id) -- Prevent duplicate sources for same item
);

CREATE INDEX idx_item_fontes_projeto_item ON item_fontes(projeto_item_id);
CREATE INDEX idx_item_fontes_licitacao ON item_fontes(item_licitacao_id);
CREATE INDEX idx_item_fontes_ignorado ON item_fontes(ignorado_calculo);
CREATE INDEX idx_item_fontes_data ON item_fontes(data_licitacao DESC);

COMMENT ON TABLE item_fontes IS 'Fontes PNCP vinculadas a cada item (mínimo 3 por item conforme Lei 14.133/2021)';
COMMENT ON COLUMN item_fontes.valor_unitario IS 'Valor unitário extraído do item_licitacao (valor_unitario_estimado ou valor_total)';
COMMENT ON COLUMN item_fontes.ignorado_calculo IS 'TRUE se o usuário marcou como outlier e excluiu do cálculo da mediana';
COMMENT ON COLUMN item_fontes.justificativa_exclusao IS 'Justificativa obrigatória quando fonte é ignorada (ex: "Outlier - fornecedor especializado")';
COMMENT ON COLUMN item_fontes.data_licitacao IS 'Data de publicação da licitação (denormalizada para alertas de recência >12 meses)';

-- Trigger for updated_at
CREATE TRIGGER update_item_fontes_updated_at BEFORE UPDATE ON item_fontes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. PROJETO_VALIDACOES (Compliance validation results)
-- ============================================
CREATE TABLE IF NOT EXISTS projeto_validacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- 'minimum_sources', 'recency_check', 'outlier_review'
    nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('erro', 'aviso', 'info')),
    mensagem TEXT NOT NULL,
    dados_contexto JSONB, -- Additional metadata (item_id, fonte_id, etc.)
    resolvido BOOLEAN DEFAULT false,
    justificativa_override TEXT, -- Why user overrode validation (admin only)
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projeto_validacoes_projeto ON projeto_validacoes(projeto_id);
CREATE INDEX idx_projeto_validacoes_nivel ON projeto_validacoes(nivel);
CREATE INDEX idx_projeto_validacoes_resolvido ON projeto_validacoes(resolvido);
CREATE INDEX idx_projeto_validacoes_tipo ON projeto_validacoes(tipo);

COMMENT ON TABLE projeto_validacoes IS 'Log de validações de compliance (mínimo 3 fontes, recência, outliers)';
COMMENT ON COLUMN projeto_validacoes.tipo IS 'Tipo de validação: minimum_sources, recency_check, outlier_review';
COMMENT ON COLUMN projeto_validacoes.nivel IS 'erro: bloqueia finalização | aviso: alerta apenas | info: informativo';
COMMENT ON COLUMN projeto_validacoes.justificativa_override IS 'Justificativa quando admin sobrescreve uma validação de erro';

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function: Automatically update projeto_itens.quantidade_fontes when fonte added/removed
CREATE OR REPLACE FUNCTION update_item_fontes_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update count for the affected item
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE projeto_itens
        SET quantidade_fontes = (
            SELECT COUNT(*)
            FROM item_fontes
            WHERE projeto_item_id = NEW.projeto_item_id
        )
        WHERE id = NEW.projeto_item_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE projeto_itens
        SET quantidade_fontes = (
            SELECT COUNT(*)
            FROM item_fontes
            WHERE projeto_item_id = OLD.projeto_item_id
        )
        WHERE id = OLD.projeto_item_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_item_fontes_count() IS 'Trigger function: atualiza automaticamente o contador de fontes no projeto_itens';

-- Triggers to maintain fonte count
CREATE TRIGGER trigger_update_fontes_count_insert
AFTER INSERT ON item_fontes
FOR EACH ROW EXECUTE FUNCTION update_item_fontes_count();

CREATE TRIGGER trigger_update_fontes_count_delete
AFTER DELETE ON item_fontes
FOR EACH ROW EXECUTE FUNCTION update_item_fontes_count();

-- Function: Calculate median for an item (excluding ignored sources)
CREATE OR REPLACE FUNCTION calcular_mediana_item(p_projeto_item_id UUID)
RETURNS DECIMAL(15,4) AS $$
DECLARE
    v_mediana DECIMAL(15,4);
    v_count INTEGER;
BEGIN
    -- Get count of valid (non-ignored) sources
    SELECT COUNT(*) INTO v_count
    FROM item_fontes
    WHERE projeto_item_id = p_projeto_item_id
      AND ignorado_calculo = false;

    -- Return NULL if no valid sources
    IF v_count = 0 THEN
        RETURN NULL;
    END IF;

    -- Calculate median using percentile_cont (PostgreSQL 9.4+)
    SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY valor_unitario) INTO v_mediana
    FROM item_fontes
    WHERE projeto_item_id = p_projeto_item_id
      AND ignorado_calculo = false;

    RETURN v_mediana;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calcular_mediana_item(UUID) IS 'Calcula a mediana dos preços de fontes não-ignoradas para um item. Retorna NULL se não houver fontes válidas.';

-- Function: Get items with insufficient sources (<3)
CREATE OR REPLACE FUNCTION get_itens_pendentes(p_projeto_id UUID)
RETURNS TABLE (
    item_id UUID,
    nome VARCHAR(300),
    quantidade_fontes_atual INTEGER,
    fontes_faltantes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.id,
        pi.nome,
        pi.quantidade_fontes,
        GREATEST(0, 3 - pi.quantidade_fontes) as fontes_faltantes
    FROM projeto_itens pi
    WHERE pi.projeto_id = p_projeto_id
      AND pi.quantidade_fontes < 3
    ORDER BY pi.ordem NULLS LAST, pi.criado_em;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_itens_pendentes(UUID) IS 'Retorna itens com menos de 3 fontes para um projeto (útil para dashboard "Itens Pendentes")';

-- Function: Validate project can be finalized (all items have 3+ sources)
CREATE OR REPLACE FUNCTION validar_projeto_finalizacao(p_projeto_id UUID)
RETURNS TABLE (
    valido BOOLEAN,
    total_itens INTEGER,
    itens_pendentes INTEGER,
    mensagem TEXT
) AS $$
DECLARE
    v_total INTEGER;
    v_pendentes INTEGER;
BEGIN
    -- Count total items
    SELECT COUNT(*) INTO v_total
    FROM projeto_itens
    WHERE projeto_id = p_projeto_id;

    -- Count items with <3 sources
    SELECT COUNT(*) INTO v_pendentes
    FROM projeto_itens
    WHERE projeto_id = p_projeto_id
      AND quantidade_fontes < 3;

    -- Return validation result
    RETURN QUERY SELECT
        (v_pendentes = 0) as valido,
        v_total,
        v_pendentes,
        CASE
            WHEN v_pendentes = 0 THEN 'Projeto pronto para finalização. Todos os itens possuem 3 ou mais fontes.'
            WHEN v_pendentes = 1 THEN '1 item precisa de mais fontes para cumprir o mínimo de 3 fontes (Lei 14.133/2021).'
            ELSE v_pendentes || ' itens precisam de mais fontes para cumprir o mínimo de 3 fontes (Lei 14.133/2021).'
        END as mensagem;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validar_projeto_finalizacao(UUID) IS 'Valida se um projeto pode ser finalizado (todos os itens devem ter 3+ fontes)';

-- ============================================
-- 7. VIEWS FOR REPORTING
-- ============================================

-- View: Project summary with totals
CREATE OR REPLACE VIEW vw_projeto_resumo AS
SELECT
    p.id as projeto_id,
    p.nome as projeto_nome,
    p.numero_processo,
    p.status,
    p.tenant_id,
    COUNT(DISTINCT pi.id) as total_itens,
    SUM(pi.quantidade_fontes) as total_fontes,
    COUNT(DISTINCT CASE WHEN pi.quantidade_fontes < 3 THEN pi.id END) as itens_pendentes,
    SUM(pi.mediana_calculada * pi.quantidade) as valor_total_estimado,
    p.criado_em,
    p.data_finalizacao
FROM projetos p
LEFT JOIN projeto_itens pi ON pi.projeto_id = p.id
GROUP BY p.id, p.nome, p.numero_processo, p.status, p.tenant_id, p.criado_em, p.data_finalizacao;

COMMENT ON VIEW vw_projeto_resumo IS 'View agregada: resumo de projetos com contadores de itens, fontes e valor total';

-- ============================================
-- 8. SAMPLE DATA (Optional - for testing)
-- ============================================

-- Uncomment below to insert sample tenant and user for testing

/*
-- Sample tenant
INSERT INTO tenants (cnpj, nome, tipo, ativo)
VALUES ('12345678000190', 'Prefeitura Municipal de Exemplo', 'prefeitura', true)
ON CONFLICT (cnpj) DO NOTHING;

-- Sample user
INSERT INTO usuarios (tenant_id, email, nome, perfil, ativo)
SELECT id, 'admin@exemplo.gov.br', 'Administrador Teste', 'admin', true
FROM tenants WHERE cnpj = '12345678000190'
ON CONFLICT (email) DO NOTHING;
*/

-- ============================================
-- 9. MIGRATION VERIFICATION
-- ============================================

-- Verify new tables exist
DO $$
BEGIN
    ASSERT (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('projetos', 'projeto_itens', 'item_fontes', 'projeto_validacoes')) = 4,
           'Erro: Nem todas as novas tabelas foram criadas';

    ASSERT (SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'pesquisas_preco' AND column_name = 'archived')),
           'Erro: Coluna archived não foi adicionada à tabela pesquisas_preco';

    RAISE NOTICE 'Migração 002 concluída com sucesso!';
    RAISE NOTICE 'Novas tabelas: projetos, projeto_itens, item_fontes, projeto_validacoes';
    RAISE NOTICE 'Funções helper: calcular_mediana_item, get_itens_pendentes, validar_projeto_finalizacao';
    RAISE NOTICE 'View: vw_projeto_resumo';
END $$;
