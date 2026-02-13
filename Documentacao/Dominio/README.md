# Domínio

Entidades e value objects do núcleo de negócio do backend.

## Conteúdo

| Arquivo | Descrição |
|---------|-----------|
| [entidades.md](./entidades.md) | Descrição de cada entidade e value object: Licitacao, ItemLicitacao, PesquisaPreco, Cnpj — campos, responsabilidade e uso nos repositórios. |

## Localização no código

Todas as entidades e value objects ficam em **`src/domain/`**:

- `Licitacao.ts`
- `ItemLicitacao.ts`
- `PesquisaPreco.ts`
- `Cnpj.ts`

Os repositórios mapeiam linhas do banco (snake_case) para essas entidades (camelCase).
