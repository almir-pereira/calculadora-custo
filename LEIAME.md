# Calculadora de custo — agentes de IA

Estimativa de custo por chamada de voz e por conversa de texto, somando modelo de
linguagem, transcrição, voz sintetizada, telefonia e infraestrutura.

## Arquivos

```
index.html                 marcação da página
css/estilo.css             toda a apresentação
js/dados.js                tabela de preços de referência, planos e seleção inicial
js/api.js                  integração com as fontes de preço e cache no navegador
js/app.js                  cálculo, desenho da fatura e eventos da interface
dados/precos-audio.json    tarifas de transcrição e de voz, mantidas por você
_backup/                   versão anterior, em arquivo único
```

## Como abrir

Abrir o `index.html` com dois cliques funciona, mas o navegador bloqueia a leitura de
arquivos locais: as tarifas de áudio ficam nos valores embutidos em `js/dados.js`.
Para a página completa, sirva a pasta por HTTP:

```
python -m http.server 8000
```

e acesse `http://127.0.0.1:8000`.

## De onde vêm os preços

| Bloco | Fonte | Atualização |
|---|---|---|
| Modelos de linguagem | `openrouter.ai/api/v1/models`, com `models.dev/api.json` de reserva | automática |
| Cotação do dólar | `economia.awesomeapi.com.br`, com `open.er-api.com` de reserva | automática |
| Transcrição (Deepgram, Whisper) | `dados/precos-audio.json` | manual |
| Voz sintetizada (ElevenLabs) | `dados/precos-audio.json` | manual |

Nenhuma das APIs pede chave de acesso. Deepgram e ElevenLabs não publicam endpoint de
preços — por isso o arquivo local: confira em `deepgram.com/pricing` e
`elevenlabs.io/pricing` e edite os números lá, ou digite direto nos campos da aba Preços.

A sincronização roda sozinha ao abrir a página quando o cache passa de 12 horas, e
também pelo botão **Atualizar preços e câmbio** no topo ou por **Buscar preços atuais**
na aba Preços. O resultado fica em `localStorage`, na chave `calc-tokens:cache:v1`.

Valor digitado à mão ganha o selo *editado*, é guardado junto do cache e vale até a
próxima sincronização, que o sobrescreve. Os itens "Personalizado" nunca são tocados
pelas APIs.

## Acrescentar um modelo

Em `js/dados.js`, inclua um item em `PRECOS.llm` com:

- `id` — chave interna, usada também em `dados/precos-audio.json`;
- `or` — id na OpenRouter (`openai/gpt-4.1`), ou `null` para não sincronizar;
- `md` — `provedor/modelo` no models.dev (`openai/gpt-4.1`), ou `null`;
- `in`, `cache`, `out` — dólar por 1 milhão de tokens, usados até a primeira sincronização.

Para transcrição e voz basta um item em `PRECOS.stt` / `PRECOS.tts` e a chave
correspondente em `dados/precos-audio.json`.

## Ressalvas do cálculo

Preço de IA muda com frequência, e plano anual, comprometimento de volume e crédito
promocional mudam o valor real. Três detalhes costumam derrubar a estimativa na prática:
cobrança mínima por requisição de voz, tempo de silêncio contado na conexão de streaming,
e o histórico da conversa crescendo a cada turno — o campo de tokens de entrada é uma
média, então vale medir a real depois de uma semana em produção.
