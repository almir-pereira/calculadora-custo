"use strict";

/* ============================================================
   api.js — busca preços atualizados em fontes públicas.

   Fontes usadas, todas sem chave de acesso:
     • OpenRouter  /api/v1/models   → preço de entrada, cache e saída
                                      dos modelos de linguagem (US$/token).
     • models.dev  /api.json        → mesma informação, catálogo alternativo
                                      (US$ por 1M de tokens). Vale de reserva
                                      e cobre modelo que a OpenRouter não lista.
     • AwesomeAPI  USD-BRL          → cotação do dólar comercial.
     • open.er-api.com              → cotação de reserva.
     • dados/precos-audio.json      → arquivo local, mantido à mão, com as
                                      tarifas de transcrição e de voz.
                                      Deepgram e ElevenLabs não publicam
                                      endpoint de preços, então esse é o
                                      único jeito honesto de automatizar.

   Tudo fica em cache no navegador (localStorage) por 12 horas para não
   bater nas APIs a cada carregamento da página.
   ============================================================ */

const API = (() => {

  const FONTES = {
    openrouter: "https://openrouter.ai/api/v1/models",
    modelsdev:  "https://models.dev/api.json",
    cambio1:    "https://economia.awesomeapi.com.br/json/last/USD-BRL",
    cambio2:    "https://open.er-api.com/v6/latest/USD",
    audio:      "dados/precos-audio.json"
  };

  const CHAVE = "calc-tokens:cache:v1";
  const VALIDADE = 12 * 60 * 60 * 1000;   // 12 horas
  const TIMEOUT = 12000;                  // 12 segundos por requisição

  /* -------- utilidades -------- */

  async function pegar(url){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT);
    try{
      const res = await fetch(url, {signal: ctrl.signal, cache: "no-store"});
      if(!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    }finally{
      clearTimeout(t);
    }
  }

  const num = v => { const x = parseFloat(v); return isFinite(x) && x >= 0 ? x : null; };
  const arred = v => +v.toFixed(6);

  /* -------- modelos de linguagem -------- */

  /** OpenRouter devolve US$ por token; convertemos para US$ por 1M. */
  async function llmOpenRouter(){
    const dados = await pegar(FONTES.openrouter);
    const mapa = new Map();
    (dados.data || []).forEach(m => mapa.set(m.id, m.pricing || {}));
    const saida = {};
    PRECOS.llm.forEach(m => {
      if(!m.or) return;
      const p = mapa.get(m.or);
      if(!p) return;
      const ent = num(p.prompt), sai = num(p.completion), cch = num(p.input_cache_read);
      if(ent === null && sai === null) return;
      saida[m.id] = {
        in:    ent !== null ? arred(ent * 1e6) : null,
        out:   sai !== null ? arred(sai * 1e6) : null,
        cache: cch !== null ? arred(cch * 1e6) : null
      };
    });
    return saida;
  }

  /** models.dev já devolve US$ por 1M de tokens. */
  async function llmModelsDev(){
    const dados = await pegar(FONTES.modelsdev);
    const saida = {};
    PRECOS.llm.forEach(m => {
      if(!m.md) return;
      const partes = m.md.split("/");
      const prov = partes[0], id = partes[1];
      const modelo = ((dados[prov] || {}).models || {})[id];
      const c = modelo && modelo.cost;
      if(!c) return;
      const ent = num(c.input), sai = num(c.output), cch = num(c.cache_read);
      if(ent === null && sai === null) return;
      saida[m.id] = {in: ent, out: sai, cache: cch};
    });
    return saida;
  }

  /** Aplica o que veio da API sobre a tabela, sem zerar campo ausente. */
  function aplicarLlm(valores, fonte){
    let n = 0;
    PRECOS.llm.forEach(m => {
      const v = valores[m.id];
      if(!v) return;
      if(v.in    !== null && v.in    !== undefined) m.in    = v.in;
      if(v.out   !== null && v.out   !== undefined) m.out   = v.out;
      if(v.cache !== null && v.cache !== undefined) m.cache = v.cache;
      ORIGEM.llm[m.id] = "api:" + fonte;
      n++;
    });
    return n;
  }

  /**
   * Tenta a OpenRouter e completa o que faltou com o models.dev.
   * Devolve {total, detalhes:[...], erros:[...]}.
   */
  async function atualizarLlm(){
    const erros = [], detalhes = [];
    const cobertos = new Set();
    let total = 0;

    try{
      const v = await llmOpenRouter();
      const n = aplicarLlm(v, "openrouter");
      Object.keys(v).forEach(id => cobertos.add(id));
      total += n;
      if(n) detalhes.push(n + " pela OpenRouter");
    }catch(e){ erros.push("OpenRouter: " + e.message); }

    const faltando = PRECOS.llm.filter(m => m.md && !cobertos.has(m.id));
    if(faltando.length){
      try{
        const v = await llmModelsDev();
        const restante = {};
        faltando.forEach(m => { if(v[m.id]) restante[m.id] = v[m.id]; });
        const n = aplicarLlm(restante, "models.dev");
        total += n;
        if(n) detalhes.push(n + " pelo models.dev");
      }catch(e){ erros.push("models.dev: " + e.message); }
    }

    return {total, detalhes, erros};
  }

  /* -------- câmbio -------- */

  async function atualizarCambio(){
    try{
      const d = await pegar(FONTES.cambio1);
      const v = num(d.USDBRL && d.USDBRL.bid);
      if(v) return {valor: +v.toFixed(4), fonte: "AwesomeAPI", quando: d.USDBRL.create_date || ""};
    }catch(e){ /* cai para a fonte de reserva */ }

    const d = await pegar(FONTES.cambio2);
    const v = num(d.rates && d.rates.BRL);
    if(!v) throw new Error("cotação ausente na resposta");
    return {valor: +v.toFixed(4), fonte: "exchangerate-api", quando: d.time_last_update_utc || ""};
  }

  /* -------- transcrição e voz (arquivo local) -------- */

  /**
   * Lê dados/precos-audio.json. Estrutura esperada:
   *   { "atualizado_em":"2026-09-10", "stt":{"nova3-stream":0.0077}, "tts":{"flash":0.05} }
   * Abrindo a página por file:// o navegador bloqueia essa leitura;
   * nesse caso a função falha e quem chama trata como "indisponível",
   * não como erro de preço.
   */
  async function atualizarAudio(){
    const d = await pegar(FONTES.audio);
    let n = 0;
    ["stt","tts"].forEach(grupo => {
      const campo = grupo === "stt" ? "min" : "k";
      const tabela = d[grupo] || {};
      PRECOS[grupo].forEach(m => {
        const v = num(tabela[m.id]);
        if(v === null) return;
        m[campo] = v;
        ORIGEM[grupo][m.id] = "api:arquivo local";
        n++;
      });
    });
    return {total: n, quando: d.atualizado_em || ""};
  }

  /* -------- cache no navegador -------- */

  function salvarCache(extra){
    try{
      const anterior = lerCache() || {};
      const pacote = Object.assign({
        quando: Date.now(),
        cambio: anterior.cambio || null,
        llm: PRECOS.llm.map(m => ({id:m.id, in:m.in, cache:m.cache, out:m.out})),
        stt: PRECOS.stt.map(m => ({id:m.id, min:m.min})),
        tts: PRECOS.tts.map(m => ({id:m.id, k:m.k})),
        origem: ORIGEM
      }, extra || {});
      localStorage.setItem(CHAVE, JSON.stringify(pacote));
    }catch(e){ /* modo privado ou storage cheio: seguimos sem cache */ }
  }

  function lerCache(){
    try{
      const bruto = localStorage.getItem(CHAVE);
      if(!bruto) return null;
      const p = JSON.parse(bruto);
      return p && p.quando ? p : null;
    }catch(e){ return null; }
  }

  function aplicarCache(p){
    const casar = (lista, itens, campos) => {
      (itens || []).forEach(x => {
        const alvo = lista.find(m => m.id === x.id);
        if(alvo) campos.forEach(c => { if(typeof x[c] === "number") alvo[c] = x[c]; });
      });
    };
    casar(PRECOS.llm, p.llm, ["in","cache","out"]);
    casar(PRECOS.stt, p.stt, ["min"]);
    casar(PRECOS.tts, p.tts, ["k"]);
    if(p.origem){
      ORIGEM.llm = p.origem.llm || {};
      ORIGEM.stt = p.origem.stt || {};
      ORIGEM.tts = p.origem.tts || {};
      ORIGEM.cambio = p.origem.cambio || "padrao";
    }
    return p;
  }

  function limparCache(){
    try{ localStorage.removeItem(CHAVE); }catch(e){}
  }

  const vencido = p => !p || (Date.now() - p.quando) > VALIDADE;

  /* -------- orquestração -------- */

  /**
   * Busca tudo de uma vez.
   * onEtapa(texto) é chamado a cada passo para dar retorno na tela.
   */
  async function sincronizar(onEtapa){
    const aviso = t => { if(onEtapa) onEtapa(t); };
    const resumo = {llm:0, audio:0, cambio:null, erros:[], detalhes:[]};

    aviso("Consultando preços dos modelos…");
    const r = await atualizarLlm();
    resumo.llm = r.total;
    resumo.detalhes = r.detalhes;
    resumo.erros = r.erros;

    aviso("Consultando a cotação do dólar…");
    try{
      resumo.cambio = await atualizarCambio();
      ORIGEM.cambio = "api:" + resumo.cambio.fonte;
    }catch(e){ resumo.erros.push("Câmbio: " + e.message); }

    aviso("Lendo tarifas de áudio…");
    try{
      const a = await atualizarAudio();
      resumo.audio = a.total;
      resumo.audioQuando = a.quando;
    }catch(e){
      resumo.audioIndisponivel = e.message;
    }

    // Só grava cache se alguma fonte respondeu. Guardar um fracasso faria a
    // página esperar 12 horas para tentar de novo.
    resumo.houveResultado = !!(resumo.llm || resumo.audio || resumo.cambio);
    if(resumo.houveResultado) salvarCache({cambio: resumo.cambio || null});
    return resumo;
  }

  return {
    FONTES, VALIDADE, sincronizar,
    atualizarLlm, atualizarCambio, atualizarAudio,
    lerCache, aplicarCache, salvarCache, limparCache, vencido
  };
})();
