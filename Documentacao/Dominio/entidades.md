# Entidades de domínio

## Licitacao

**Arquivo:** `src/domain/Licitacao.ts`

Representa o cabeçalho de uma licitação coletada do PNCP.

**Campos principais:** id, numeroControlePNCP, cnpjOrgao, razaoSocialOrgao, poderId, esferaId, anoCompra, sequencialCompra, numeroCompra, processo, objetoCompra, modalidadeId, modalidadeNome, situacaoCompraId, situacaoCompraNome, valorTotalEstimado, valorTotalHomologado, dataPublicacaoPncp, dataInclusao, dataAtualizacao, unidadeOrgao (codigoUnidade, nomeUnidade, ufSigla, municipioNome, codigoIbge), amparoLegal, linkProcessoEletronico, linkSistemaOrigem, informacaoComplementar, srp, criadoEm, atualizadoEm.

**Uso:** Preenchida pelo GovernoApiGateway a partir das APIs 1 e 2; persistida pelo LicitacaoRepository (upsert por numero_controle_pncp). O codigoIbge da licitação é usado no filtro geográfico (ItemService) para obter lat/long na tabela municipios.

---

## ItemLicitacao

**Arquivo:** `src/domain/ItemLicitacao.ts`

Representa um item de uma licitação (PNCP).

**Campos principais:** id, licitacaoId, numeroItem, descricao, materialOuServico, materialOuServicoNome, valorUnitarioEstimado, valorTotal, quantidade, unidadeMedida, situacaoCompraItem, situacaoCompraItemNome, criterioJulgamentoId, criterioJulgamentoNome, itemCategoriaId, itemCategoriaNome, ncmNbsCodigo, ncmNbsDescricao, catalogoCodigoItem, informacaoComplementar, orcamentoSigiloso, temResultado, dataInclusao, dataAtualizacao, criadoEm, atualizadoEm.

**Uso:** Preenchida pelo GovernoApiGateway (API 3) e pelo ItemLicitacaoRepository (mapeamento de linhas); usada na busca por descrição (searchByDescricaoWithLicitacao), na listagem de itens de uma pesquisa e no cálculo estatístico (valorUnitarioEstimado ou valorTotal).

---

## PesquisaPreco

**Arquivo:** `src/domain/PesquisaPreco.ts`

Representa uma pesquisa de preços criada por um usuário (tenant).

**Campos:** id, tenantId, usuarioId, nome, descricao, status (rascunho | finalizada | cancelada), criadoEm, atualizadoEm.

**Uso:** Criada e listada pelo PesquisaPrecoRepository; usada pelo PesquisaController, ConsolidacaoController e RelatorioService. O status permite evoluir para “finalizada” após consolidação (opcional, ainda não persistido na consolidação).

---

## Cnpj

**Arquivo:** `src/domain/Cnpj.ts`

Value object para validação e formatação de CNPJ.

**Uso:** Pode ser usado para normalizar CNPJ do órgão ao persistir licitações ou em validações de entrada. No fluxo atual, o gateway e o repositório trabalham com string de 14 dígitos; o Cnpj pode ser usado onde for necessária validação ou máscara.

---

# ⚡ NOVO SISTEMA: Entidades de Compliance (Lei 14.133/2021)

## Projeto

**Arquivo:** `src/domain/Projeto.ts`

Representa um projeto de pesquisa de preços conforme Lei 14.133/2021. Substitui o modelo antigo de `PesquisaPreco` com estrutura hierárquica **Projeto → Itens → Fontes**.

**Campos:** id, tenantId, usuarioId, nome, descricao, numeroProcesso, objeto, status ('rascunho' | 'em_andamento' | 'finalizado' | 'cancelado'), dataFinalizacao, criadoEm, atualizadoEm.

**Métodos de negócio:**
- `podeSerFinalizado()` — Verifica se projeto pode ser finalizado (status 'rascunho' ou 'em_andamento').
- `isFinalizado()` — Verifica se projeto está finalizado.
- `isAtivo()` — Verifica se projeto está ativo (não cancelado ou finalizado).

**Uso:** Criado pelo ProjetoRepository; usado pelo ProjetoController para validação de finalização. O status 'finalizado' bloqueia edições e deleções. A estrutura hierárquica permite calcular o valor total do projeto como a **soma das medianas de cada item**, em vez de uma média/mediana global.

---

## ProjetoItem

**Arquivo:** `src/domain/ProjetoItem.ts`

Representa um **item definido manualmente pelo usuário** dentro de um projeto. Diferente de `ItemLicitacao` (que vem do PNCP), este é criado pelo usuário e vincula múltiplas fontes PNCP como referências de preço.

**Campos:** id, projetoId, nome, descricao, quantidade, unidadeMedida, ordem, medianaCalculada, quantidadeFontes, observacoes, criadoEm, atualizadoEm.

**Métodos de negócio:**
- `temFontesSuficientes()` — Verifica se item possui mínimo de 3 fontes (Lei 14.133/2021).
- `fontesFaltantes()` — Retorna quantas fontes faltam para atingir o mínimo de 3.
- `temMedianaCalculada()` — Verifica se mediana foi calculada.
- `getValorTotalEstimado()` — Calcula valor total do item (mediana × quantidade).

**Uso:** Criado e atualizado pelo ProjetoItemRepository; usado pelo ProjetoItemController e ProjetoValidacaoService. A `medianaCalculada` é atualizada automaticamente pela função SQL `calcular_mediana_item()` sempre que fontes são adicionadas/removidas/ignoradas. A `quantidadeFontes` é mantida por trigger SQL (`update_item_fontes_count`).

**Importante:** A Lei 14.133/2021 exige **mínimo 3 fontes por item** para justificar o preço estimado. O sistema valida isso antes de finalizar o projeto.

---

## ItemFonte

**Arquivo:** `src/domain/ItemFonte.ts`

Representa uma **fonte PNCP** (item de licitação) vinculada a um item do projeto. Cada fonte contribui para o cálculo da mediana do item.

**Campos:** id, projetoItemId, itemLicitacaoId, valorUnitario, ignoradoCalculo, justificativaExclusao, dataLicitacao, criadoEm, atualizadoEm.

**Métodos de negócio:**
- `isIncluida()` — Verifica se fonte está incluída no cálculo (não ignorada).
- `isIgnorada()` — Verifica se fonte foi marcada como outlier.
- `isAntiga(meses)` — Verifica se fonte tem mais de X meses (padrão: 12 meses).
- `getIdadeMeses()` — Calcula idade da fonte em meses.

**Uso:** Criado pelo ItemFonteRepository ao vincular um `ItemLicitacao` a um `ProjetoItem`. O `valorUnitario` é extraído automaticamente do PNCP (usa `valorUnitarioEstimado` ou `valorTotal / quantidade`). A `dataLicitacao` é denormalizada da tabela `licitacoes` para permitir alertas de recência.

**Compliance:**
1. **Mínimo 3 fontes**: Sistema bloqueia finalização se qualquer item tiver <3 fontes.
2. **Recência**: Lei 14.133/2021 recomenda preços de até 12 meses. Sistema gera **aviso** para fontes antigas.
3. **Outliers**: Sistema detecta outliers via método IQR. Usuário pode marcar fonte como `ignoradoCalculo = true` com justificativa obrigatória.

---

## Diferenças Estruturais: Sistema Antigo vs. Novo

| Entidade Antiga | Entidade Nova | Mudança Principal |
|----------------|---------------|-------------------|
| `PesquisaPreco` | `Projeto` | Status de compliance, validação de finalização |
| `pesquisa_itens` (join table) | `ProjetoItem` + `ItemFonte` | **Separação**: Usuário define itens, depois vincula fontes PNCP |
| `ItemLicitacao` (direto) | `ItemLicitacao` (como fonte) | Agora é **fonte** para cálculo, não item direto |
| Estatísticas globais | Estatísticas **por item** | Cada item tem sua mediana independente |
| Sem validação mínima | **3+ fontes obrigatórias** | Compliance Lei 14.133/2021 |

---

## Hierarquia de Relacionamentos

```
Tenant
  └─ Usuario
  └─ Projeto
      └─ ProjetoItem (definido pelo usuário)
          └─ ItemFonte (referência a ItemLicitacao do PNCP)
              └─ ItemLicitacao (dados do PNCP)
                  └─ Licitacao (órgão, data, etc.)
```

**Fluxo de cálculo:**
1. Usuário cria **Projeto** ("Compra de Material Escolar 2026").
2. Usuário adiciona **ProjetoItem** ("Lápis nº 2 Preto", 500 UN).
3. Usuário busca itens PNCP e vincula **3+ ItemFonte** (ex: 3 licitações de prefeituras).
4. Sistema calcula **mediana** automaticamente (função SQL `calcular_mediana_item`).
5. Valor total do projeto = **soma das medianas** de todos os itens.
6. Sistema valida: todos os itens têm 3+ fontes? Sim → permite finalização. Não → bloqueia.
