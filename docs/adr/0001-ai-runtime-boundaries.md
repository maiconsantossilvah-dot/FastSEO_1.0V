# ADR 0001 — Fronteiras do runtime de IA

- **Status:** aceita
- **Data da decisão:** 2026-08-26
- **Próxima revisão:** 2027-02-26
- **Responsável:** proprietário técnico do FastSEO

## Contexto

O antigo `src/services/api.js` concentrava seleção do provedor, fallback,
retry, rotação de chaves BYOK, fila, rate limit, parsing da resposta, métricas
de tokens e chamadas diretas à `PipelineUI`. Essa concentração dificultava
testar cancelamento e falhas sem carregar a interface inteira e tornava uma
mudança de provedor capaz de afetar todo o pipeline.

## Decisão

O runtime foi dividido em quatro responsabilidades explícitas:

1. O pipeline mantém as regras dos agentes e traduz eventos em apresentação.
2. `AiGateway` escolhe o provedor inicial e controla fallback entre provedores.
3. `GeminiProvider` e `MistralProvider` cuidam do protocolo HTTP, parsing,
   retry e rotação entre chaves do mesmo provedor.
4. `RateLimitScheduler` serializa chamadas e controla o intervalo entre os
   inícios reais das requisições de cada provedor.

Uma factory explícita cria dois schedulers e dois providers com o mesmo relógio
e dependências injetadas. Não existe registro global de schedulers. O serviço
`api.js` permanece somente como fachada de compatibilidade para consumidores
existentes.

## Motivação

- Testar fila, retry, fallback e cancelamento isoladamente.
- Manter o mesmo `AbortSignal` em toda a operação.
- Impedir dependências de DOM dentro da camada de rede.
- Validar respostas externas antes que entrem no domínio.
- Preservar chaves BYOK exclusivamente no navegador do usuário.

## Custo aceito

A solução adiciona arquivos e indireção entre pipeline e `fetch`. Esse custo é
aceito porque cada camada possui estado ou comportamento próprio coberto por
testes. A divisão não deve evoluir para um framework interno.

## Limites

- Exatamente Gemini e Mistral.
- Sem container de injeção de dependências.
- Sem event bus global.
- Sem classes-base abstratas.
- Sem registro dinâmico de plugins.
- Sem sincronização de rate limit entre abas ou dispositivos.
- Sem credenciais ou payloads brutos em eventos.

## Alternativas rejeitadas

- **Manter `callAgent` monolítico:** preservaria menos arquivos, mas manteria o
  acoplamento com UI e os testes frágeis.
- **Scheduler genérico distribuído:** resolveria coordenação entre abas, porém
  adicionaria infraestrutura desproporcional ao uso interno atual.
- **Zod por CDN antes do build:** tecnicamente possível, mas adicionaria uma
  dependência de rede em runtime crítico. Os parsers começam com type guards.

## Consequências

- Providers nunca importam `PipelineUI`.
- Retry aguarda fora da fila para não causar head-of-line blocking.
- Rate limit é calculado pelo horário real de início da requisição.
- A migração executável permanece em JavaScript enquanto o frontend é servido
  diretamente pelo GitHub Pages; os contratos TypeScript e JSDoc mantêm a
  fronteira pronta para a futura entrada do Vite.

## Gatilhos de revisão

Esta ADR deve ser revisada e receber um registro de resultado — **manter**,
**simplificar** ou **substituir** — nas seguintes situações:

- antes de considerar um terceiro provedor;
- quando retry, fila ou fallback precisarem mudar novamente;
- em 2027-02-26, mesmo sem mudança funcional;
- se gateway, provider ou scheduler deixarem de possuir comportamento ou testes
  próprios.

O proprietário técnico do FastSEO é responsável por registrar a revisão nesta
seção ou em uma ADR substituta.
