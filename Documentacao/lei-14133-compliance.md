# Compliance com Lei 14.133/2021 - Nova Lei de Licitações

## Sumário
- [Contexto Legal](#contexto-legal)
- [Arquitetura de Compliance](#arquitetura-de-compliance)
- [Regras de Validação](#regras-de-validação)
- [Fluxo de Uso](#fluxo-de-uso)
- [Diferenças vs. Sistema Antigo](#diferenças-vs-sistema-antigo)

---

## Contexto Legal

A **Lei 14.133/2021** (Nova Lei de Licitações e Contratos Administrativos) estabelece requisitos para justificar preços estimados em processos licitatórios. Um dos requisitos fundamentais é a **pesquisa de preços com múltiplas fontes**.

### Requisitos Principais

1. **Mínimo 3 fontes de preços** de diferentes licitações públicas.
2. **Priorização de preços recentes** (até 12 meses).
3. **Uso de mediana** como método estatístico recomendado (mais robusto a outliers que média).
4. **Documentação rastreável** com links para as fontes originais no PNCP.
5. **Justificativa para exclusão** de preços considerados outliers.

### Consequências do Não-Compliance

- Contestação da licitação por órgãos de controle (TCU, CGU, TCE).
- Risco de anulação do processo licitatório.
- Responsabilização do servidor responsável.
- Prejuízo ao erário (se preço estimado estiver muito acima ou abaixo do mercado).

---

## Arquitetura de Compliance

O sistema foi reestruturado para garantir compliance através de **validação automatizada** em cada etapa do processo.

### Modelo Hierárquico: Projeto → Itens → Fontes

```
┌────────────────────────────────────────────────┐
│ PROJETO: Compra de Material Escolar 2026      │
│ Status: rascunho → em_andamento → finalizado  │
│ Total: R$ 12.450,00 (soma das medianas)       │
└────────────────────────────────────────────────┘
         │
         ├─► ITEM 1: Lápis nº 2 Preto (500 UN)
         │   ├─ Fonte 1: Licitação Prefeitura A - R$ 0,75/UN ✓
         │   ├─ Fonte 2: Licitação Prefeitura B - R$ 0,85/UN ✓
         │   ├─ Fonte 3: Licitação Prefeitura C - R$ 0,90/UN ✓
         │   ├─ Fonte 4: Licitação Prefeitura D - R$ 1,95/UN ⚠️ IGNORADO (outlier)
         │   └─ Mediana: R$ 0,85/UN → Subtotal: R$ 425,00
         │
         ├─► ITEM 2: Caderno 96 folhas (200 UN)
         │   ├─ Fonte 1: R$ 12,00/UN ✓
         │   ├─ Fonte 2: R$ 12,50/UN ✓
         │   ├─ Fonte 3: R$ 13,00/UN ✓
         │   └─ Mediana: R$ 12,50/UN → Subtotal: R$ 2.500,00
         │
         └─► ITEM 3: Borracha branca (300 UN) ❌ PENDENTE
             ├─ Fonte 1: R$ 1,50/UN ✓
             └─ ⚠️ FALTA 2 FONTES para cumprir mínimo de 3
```

### Entidades do Banco de Dados

#### 1. `projetos`
- **Propósito**: Container principal para uma pesquisa de preços.
- **Campos chave**: `status` ('rascunho', 'em_andamento', 'finalizado', 'cancelado'), `data_finalizacao`.
- **Validação**: Só pode finalizar se todos os itens tiverem 3+ fontes.

#### 2. `projeto_itens`
- **Propósito**: Itens **definidos pelo usuário** (não são itens PNCP diretamente).
- **Campos chave**: `nome`, `quantidade`, `unidade_medida`, `mediana_calculada`, `quantidade_fontes`.
- **Auto-calculado**: `mediana_calculada` (função SQL), `quantidade_fontes` (trigger SQL).

#### 3. `item_fontes`
- **Propósito**: Vincula itens PNCP como **fontes de preço** para cada item do projeto.
- **Campos chave**: `valor_unitario` (extraído do PNCP), `ignorado_calculo` (outlier flag), `justificativa_exclusao`, `data_licitacao`.
- **Constraint**: `UNIQUE(projeto_item_id, item_licitacao_id)` — impede duplicatas.

#### 4. `projeto_validacoes`
- **Propósito**: Log de validações de compliance (auditoria).
- **Tipos**: 'minimum_sources', 'recency_check', 'outlier_review'.
- **Níveis**: 'erro' (bloqueia), 'aviso' (alerta), 'info' (informativo).

---

## Regras de Validação

### 1. Mínimo 3 Fontes por Item (ERRO - Bloqueia Finalização)

**Implementação:**
- Função SQL: `validar_projeto_finalizacao(projeto_id)` — verifica se todos os itens têm `quantidade_fontes >= 3`.
- Service: `ProjetoValidacaoService.validarMinimo3Fontes()` — retorna lista de itens pendentes.
- Controller: `ProjetoController.finalizar()` — bloqueia se validação falhar (a menos que haja `justificativaOverride`).

**Exemplo de erro:**
```json
{
  "tipo": "minimum_sources",
  "nivel": "erro",
  "mensagem": "Item 'Borracha branca' possui apenas 1 fonte. Faltam 2 para atingir o mínimo de 3 fontes exigido pela Lei 14.133/2021.",
  "itemId": "uuid-do-item",
  "dados": { "quantidadeAtual": 1, "faltantes": 2 }
}
```

**UI:**
- Badge vermelho no item: "1/3 fontes ⚠️"
- Botão "Finalizar Projeto" desabilitado
- Lista de itens pendentes no topo da página

---

### 2. Recência de Fontes (AVISO - Não Bloqueia)

**Regra:** Fontes com mais de **12 meses** de idade geram aviso.

**Implementação:**
- Repository: `ItemFonteRepository.verificarRecencia(projetoId, 12)` — retorna fontes antigas.
- Domain: `ItemFonte.isAntiga(meses)` — verifica idade da fonte.
- Service: `ProjetoValidacaoService.validarRecencia()` — gera avisos.

**Exemplo de aviso:**
```json
{
  "tipo": "recency_check",
  "nivel": "aviso",
  "mensagem": "Item 'Lápis nº 2 Preto' possui fonte com 15 meses de idade. A Lei 14.133/2021 recomenda priorizar preços de até 12 meses.",
  "itemId": "uuid-do-item",
  "fonteId": "uuid-da-fonte",
  "dados": { "idadeMeses": 15, "dataLicitacao": "2024-11-20" }
}
```

**UI:**
- Badge laranja na fonte: "🕒 15 meses"
- Tooltip: "Fonte antiga - considere buscar preços mais recentes"
- Não impede finalização, mas alerta o usuário

---

### 3. Detecção de Outliers (INFO - Usuário Decide)

**Regra:** Método **IQR (Interquartile Range)** detecta outliers automaticamente.

**Cálculo:**
1. Q1 = 25º percentil dos preços
2. Q3 = 75º percentil dos preços
3. IQR = Q3 - Q1
4. **Outlier se:** preço < Q1 - 1.5×IQR **OU** preço > Q3 + 1.5×IQR

**Implementação:**
- Service: `CalculadoraEstatisticaService.outliersPorIQR(precos)` — retorna índices dos outliers.
- Service: `ProjetoValidacaoService.detectarOutliers()` — aplica IQR por item.
- Controller: `ProjetoItemController.marcarFonteIgnorada()` — permite usuário marcar outlier com justificativa.

**Exemplo de info:**
```json
{
  "tipo": "outlier_review",
  "nivel": "info",
  "mensagem": "Item 'Lápis nº 2 Preto': fonte com preço R$ 1,95 identificada como outlier (+130% da mediana). Revise e considere excluir do cálculo.",
  "itemId": "uuid-do-item",
  "fonteId": "uuid-da-fonte",
  "dados": { "valorFonte": 1.95, "mediana": 0.85, "desvioPercentual": "+130.0" }
}
```

**UI:**
- Badge amarelo na fonte: "⚠️ OUTLIER (+130%)"
- Botão: "Ignorar do cálculo"
- Modal obrigatório: "Justificativa (mín. 10 caracteres)"
- Fonte ignorada fica visível com strikethrough + justificativa

---

## Fluxo de Uso

### Passo 1: Criar Projeto

```http
POST /api/projetos
{
  "nome": "Compra de Material Escolar 2026",
  "descricao": "Processo 123/2026",
  "numeroProcesso": "123/2026",
  "tenantId": "uuid-tenant",
  "usuarioId": "uuid-usuario"
}
```

**Resultado:** Projeto criado com `status = 'rascunho'`.

---

### Passo 2: Definir Itens

Usuário define **manualmente** os itens que precisa (não são itens PNCP ainda):

```http
POST /api/projetos/{projetoId}/itens
{
  "nome": "Lápis nº 2 Preto",
  "quantidade": 500,
  "unidadeMedida": "UN",
  "descricao": "Lápis escolar grafite nº 2"
}
```

**Resultado:** Item criado com `quantidade_fontes = 0`, `mediana_calculada = null`.

---

### Passo 3: Buscar e Vincular Fontes PNCP

Usuário busca itens no PNCP e vincula como fontes:

```http
GET /api/itens/buscar?q=lápis+grafite+nº+2
```

Para cada resultado relevante, vincula ao item:

```http
POST /api/projeto-itens/{itemId}/fontes
{
  "itemLicitacaoId": "uuid-do-item-pncp"
}
```

**Resultado:**
- Sistema extrai `valor_unitario` do item PNCP (usa `valorUnitarioEstimado` ou `valorTotal / quantidade`).
- Sistema copia `data_licitacao` da licitação (para recency check).
- Trigger SQL atualiza `quantidade_fontes` automaticamente.
- Função SQL `calcular_mediana_item()` atualiza `mediana_calculada` automaticamente.

**Resposta:**
```json
{
  "success": true,
  "fonte": {
    "id": "uuid-fonte",
    "valorUnitario": 0.75,
    "ignoradoCalculo": false,
    "dataLicitacao": "2025-11-15"
  },
  "medianaAtualizada": 0.80
}
```

---

### Passo 4: Revisar Outliers (Opcional)

Se sistema detectar outlier (ex: R$ 1,95 vs. mediana R$ 0,85):

```http
PUT /api/fontes/{fonteId}/ignorar
{
  "justificativa": "Outlier detectado - fornecedor especializado com preço muito acima da mediana do mercado."
}
```

**Resultado:**
- `ignorado_calculo = true`
- `justificativa_exclusao` salva
- Mediana recalculada automaticamente (excluindo outlier)

---

### Passo 5: Validar Compliance

Antes de finalizar, usuário verifica compliance:

```http
GET /api/projetos/{projetoId}/validar
```

**Resposta:**
```json
{
  "success": true,
  "validacao": {
    "valido": false,
    "erros": [
      {
        "tipo": "minimum_sources",
        "nivel": "erro",
        "mensagem": "Item 'Borracha branca' possui apenas 1 fonte. Faltam 2...",
        "itemId": "uuid-item-3"
      }
    ],
    "avisos": [
      {
        "tipo": "recency_check",
        "nivel": "aviso",
        "mensagem": "Item 'Lápis nº 2 Preto' possui fonte com 15 meses...",
        "itemId": "uuid-item-1",
        "fonteId": "uuid-fonte-antiga"
      }
    ],
    "infos": [
      {
        "tipo": "outlier_review",
        "nivel": "info",
        "mensagem": "Item 'Lápis nº 2 Preto': fonte com preço R$ 1,95...",
        "itemId": "uuid-item-1",
        "fonteId": "uuid-fonte-outlier"
      }
    ]
  }
}
```

---

### Passo 6: Finalizar Projeto

Quando todos os itens tiverem 3+ fontes:

```http
POST /api/projetos/{projetoId}/finalizar
```

**Resultado:**
- Sistema valida novamente (função SQL `validar_projeto_finalizacao`).
- Se válido: `status = 'finalizado'`, `data_finalizacao = NOW()`.
- Se inválido: retorna erro 400 com mensagem detalhada.

**Admin override (se necessário):**
```http
POST /api/projetos/{projetoId}/finalizar
{
  "justificativaOverride": "Mercado restrito - somente 2 fornecedores identificados. Justificativa anexa ao processo."
}
```

---

## Diferenças vs. Sistema Antigo

| Aspecto | Sistema Antigo (`pesquisas_preco`) | Novo Sistema (`projetos`) |
|---------|-------------------------------------|----------------------------|
| **Fluxo** | 1. Buscar itens PNCP<br>2. Selecionar vários<br>3. Calcular estatísticas globais | 1. Criar projeto<br>2. Definir itens manualmente<br>3. Buscar e vincular 3+ fontes por item<br>4. Validar compliance<br>5. Finalizar |
| **Estrutura de dados** | `pesquisa` → `pesquisa_itens` (join) → `itens_licitacao` | `projeto` → `projeto_itens` (entidade própria) → `item_fontes` (join) → `itens_licitacao` |
| **Cálculo de preço** | **Média/mediana global** de todos os itens selecionados | **Mediana individual** por item (função SQL) |
| **Valor total** | Média global × soma quantidades (impreciso) | **Soma das medianas** de cada item (preciso) |
| **Validação** | Nenhuma (usuário pode finalizar com 0 itens) | **Bloqueia finalização** se <3 fontes por item |
| **Outliers** | Apenas detecta (lista índices) | Usuário pode **marcar como ignorado** com justificativa |
| **Recência** | Não valida | **Alerta automático** para fontes >12 meses |
| **Compliance** | Sem garantias legais | **100% compliance** com Lei 14.133/2021 |
| **PDF gerado** | Não implementado | Metodologia + fontes com links PNCP + justificativas |

---

## Benefícios do Novo Sistema

### 1. **Segurança Jurídica**
- Impossível finalizar projeto sem 3+ fontes por item.
- Rastreabilidade completa (cada fonte vinculada ao PNCP original).
- Justificativas obrigatórias para exclusão de outliers.

### 2. **Precisão nos Cálculos**
- Mediana por item (não média global imprecisa).
- Valor total correto: soma das medianas × quantidades.
- Outliers detectados automaticamente (método IQR).

### 3. **Auditabilidade**
- Log de validações em `projeto_validacoes`.
- Histórico de fontes ignoradas com justificativas.
- PDF com metodologia e links para fontes PNCP.

### 4. **Experiência do Usuário**
- Interface guia o usuário pelo fluxo compliance.
- Feedback visual: badges coloridos (verde 3/3 ✓, vermelho 1/3 ⚠️).
- Validação em tempo real (não descobre erros apenas no final).

---

## Próximos Passos

1. **PDF Compliance Report** — Gerar relatório com estrutura:
   - Capa com dados do projeto e organização
   - Metodologia (Lei 14.133/2021, método mediana, IQR)
   - Tabelas por item com todas as fontes e links PNCP
   - Assinatura do servidor responsável

2. **Dashboard de Compliance** — Métricas agregadas:
   - Total de projetos finalizados vs. pendentes
   - Items pendentes (com <3 fontes)
   - Fontes antigas (>12 meses)
   - Outliers aguardando revisão

3. **Notificações** — Alertas automáticos:
   - "Item X precisa de mais 2 fontes"
   - "Fonte antiga detectada - considere atualizar"
   - "Outlier detectado - revisar preço"

4. **Integração PNCP** — Busca avançada:
   - Filtro por modalidade, órgão, região
   - Sugestão inteligente de fontes similares
   - Auto-vinculação de fontes sugeridas (com aprovação)
