"use strict";

/* ============================================================
   app.js — interface, cálculo e ligação com o módulo de preços.
   Depende de dados.js (PRECOS, PLANOS, ORIGEM) e api.js (API).
   ============================================================ */

const $ = id => document.getElementById(id);
const n = id => { const v = parseFloat($(id).value); return isFinite(v) ? v : 0; };

/* ----------------- moeda ----------------- */
function cambio(){ const c = n("cambio"); return c > 0 ? c : 1; }
function moeda(){ return $("moeda").value; }

/** recebe valor em BRL, devolve string na moeda escolhida */
function fmt(brl, casas){
  const usd = moeda() === "USD";
  const v = usd ? brl / cambio() : brl;
  const abs = Math.abs(v);
  const d = casas !== undefined ? casas : (abs === 0 ? 2 : abs < 0.1 ? 4 : abs < 10 ? 3 : abs < 1000 ? 2 : 0);
  return new Intl.NumberFormat("pt-BR", {style:"currency", currency: usd ? "USD" : "BRL", minimumFractionDigits:d, maximumFractionDigits:d}).format(v);
}
const int = v => new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(v);

/* ----------------- selects ----------------- */
function popular(){
  const guarda = ["v_llm","t_llm","v_stt","t_stt","v_tts","t_tts"]
    .map(s => ({id:s, val: $(s).value}));

  const monta = (sel, lista, rotulo) => {
    $(sel).innerHTML = lista.map(o => `<option value="${o.id}">${rotulo(o)}</option>`).join("");
  };
  const rLlm = o => `${o.nome} — ${o.in.toFixed(2)} / ${o.out.toFixed(2)} por 1M`;
  const rStt = o => `${o.nome} — US$ ${o.min.toFixed(4)}/min`;
  const rTts = o => `${o.nome} — US$ ${o.k.toFixed(3)}/1k`;
  ["v_llm","t_llm"].forEach(s => monta(s, PRECOS.llm, rLlm));
  ["v_stt","t_stt"].forEach(s => monta(s, PRECOS.stt, rStt));
  ["v_tts","t_tts"].forEach(s => monta(s, PRECOS.tts, rTts));

  guarda.forEach(g => { if(g.val) $(g.id).value = g.val; });
}
function acha(lista, id){ return lista.find(o => o.id === id) || lista[0]; }

/* ----------------- cálculo ----------------- */
function calcVoz(chamadasDia){
  const c    = cambio();
  const cd   = chamadasDia !== undefined ? chamadasDia : n("v_chamadas");
  const dias = Math.max(1, n("dias"));
  const dur  = n("v_dur");
  const t    = n("v_turnos");
  const llm  = acha(PRECOS.llm, $("v_llm").value);
  const stt  = acha(PRECOS.stt, $("v_stt").value);
  const tts  = acha(PRECOS.tts, $("v_tts").value);

  const pctCache = Math.min(100, Math.max(0, n("v_cache"))) / 100;
  const tin = n("v_tin"), tout = n("v_tout");
  const inFresco = tin * (1 - pctCache), inCache = tin * pctCache;

  const usdLlm = t * ((inFresco*llm.in + inCache*llm.cache + tout*llm.out) / 1e6);
  const usdStt = dur * n("v_fatorstt") * stt.min;
  const chars  = t * tout * n("v_cpt");
  const usdTts = (chars / 1000) * tts.k;

  const llmBrl = usdLlm * c, sttBrl = usdStt * c, ttsBrl = usdTts * c;
  const sipBrl = dur * n("v_sip");
  const chamadasMes = cd * dias;
  const infraUnit = chamadasMes > 0 ? n("v_infra") / chamadasMes : 0;

  const unit = llmBrl + sttBrl + ttsBrl + sipBrl + infraUnit;
  return {
    unit, mes: unit * chamadasMes, qtdMes: chamadasMes, chars, minutos: dur, taxaTts: tts.k,
    itens: [
      {rot:"Modelo de linguagem", cor:"var(--llm)",   v:llmBrl, det:`${t} respostas · ${int(t*tin)} tokens de entrada`},
      {rot:"Transcrição",         cor:"var(--stt)",   v:sttBrl, det:`${dur.toFixed(1)} min × US$ ${stt.min.toFixed(4)}`},
      {rot:"Voz sintetizada",     cor:"var(--tts)",   v:ttsBrl, det:`${int(chars)} caracteres × US$ ${tts.k.toFixed(2)} por mil`},
      {rot:"Tronco SIP",          cor:"#9C6B4E",      v:sipBrl, det:`${dur.toFixed(1)} min de telefonia`},
      {rot:"Infraestrutura",      cor:"var(--infra)", v:infraUnit, det:`rateio de ${fmt(n("v_infra"),2)} por mês`}
    ]
  };
}

function calcTexto(conversasDia){
  const c    = cambio();
  const cv   = conversasDia !== undefined ? conversasDia : n("t_conversas");
  const dias = Math.max(1, n("dias"));
  const m    = n("t_msgs");
  const llm  = acha(PRECOS.llm, $("t_llm").value);
  const stt  = acha(PRECOS.stt, $("t_stt").value);
  const tts  = acha(PRECOS.tts, $("t_tts").value);

  const pctCache = Math.min(100, Math.max(0, n("t_cache"))) / 100;
  const tin = n("t_tin"), tout = n("t_tout");
  const inFresco = tin * (1 - pctCache), inCache = tin * pctCache;

  const usdLlm = m * ((inFresco*llm.in + inCache*llm.cache + tout*llm.out) / 1e6);
  const minAudio = m * (n("t_pctaudio")/100) * n("t_duraudio");
  const usdStt = minAudio * stt.min;
  const chars  = m * (n("t_pctvoz")/100) * tout * n("t_cpt");
  const usdTts = (chars / 1000) * tts.k;

  const llmBrl = usdLlm * c, sttBrl = usdStt * c, ttsBrl = usdTts * c;
  const plat = n("t_plataforma");
  const conversasMes = cv * dias;
  const infraUnit = conversasMes > 0 ? n("t_infra") / conversasMes : 0;

  const unit = llmBrl + sttBrl + ttsBrl + plat + infraUnit;
  return {
    unit, mes: unit * conversasMes, qtdMes: conversasMes, chars, minutos: minAudio, taxaTts: tts.k,
    itens: [
      {rot:"Modelo de linguagem",  cor:"var(--llm)",   v:llmBrl, det:`${m} respostas · ${int(m*tin)} tokens de entrada`},
      {rot:"Transcrição de áudios",cor:"var(--stt)",   v:sttBrl, det:`${minAudio.toFixed(2)} min por conversa`},
      {rot:"Voz sintetizada",      cor:"var(--tts)",   v:ttsBrl, det:`${int(chars)} caracteres × US$ ${tts.k.toFixed(2)} por mil`},
      {rot:"Plataforma de mensagem",cor:"#9C6B4E",     v:plat,   det:"janela de conversa"},
      {rot:"Infraestrutura",       cor:"var(--infra)", v:infraUnit, det:`rateio de ${fmt(n("t_infra"),2)} por mês`}
    ]
  };
}

/* ----------------- desenho ----------------- */
function pintar(r, ids, rotuloQtd){
  const visiveis = r.itens.filter(i => i.v > 0);
  $(ids.barra).innerHTML = visiveis.map(i =>
    `<i style="width:${r.unit>0 ? (i.v/r.unit*100) : 0}%;background:${i.cor}" title="${i.rot}"></i>`).join("");

  $(ids.itens).innerHTML = r.itens.map(i => `
    <tr>
      <td><span class="chip" style="background:${i.cor}"></span>${i.rot}<span class="detalhe">${i.det}</span></td>
      <td>${fmt(i.v)}</td>
    </tr>`).join("") + `
    <tr class="total"><td>Custo total</td><td>${fmt(r.unit)}</td></tr>`;

  $(ids.unit).textContent = fmt(r.unit);
  $(ids.mes).textContent  = fmt(r.mes, 2);
  $(ids.ref).textContent  = `${int(r.qtdMes)} ${rotuloQtd} por mês`;

  const mk = 1 + n(ids.markup)/100;
  $(ids.preco).textContent   = fmt(r.unit * mk);
  $(ids.receita).textContent = fmt(r.mes * mk, 2);

  const totalChars = r.chars * r.qtdMes;
  const el = $(ids.plano);
  if(totalChars <= 0){
    el.textContent = "Sem geração de voz nesta configuração.";
  }else{
    const col = r.taxaTts <= 0.05 ? "0.05" : "0.10";
    const p = PLANOS.find(x => x[col] >= totalChars);
    el.textContent = p
      ? `${int(totalChars)} caracteres por mês — dentro da franquia do plano ${p.nome} (${int(p[col])}).`
      : `${int(totalChars)} caracteres por mês — acima da franquia do Business. Nesse volume a conversa é de contrato por volume com a ElevenLabs.`;
  }
}

function kv(rot, val){ return `<div class="linha-kv"><span>${rot}</span><span class="num">${val}</span></div>`; }

function comparativo(v, t){
  const mkV = 1 + n("v_markup")/100, mkT = 1 + n("t_markup")/100;
  $("c_voz").innerHTML =
    kv("Custo por chamada", fmt(v.unit)) +
    kv("Chamadas por mês", int(v.qtdMes)) +
    kv("Custo mensal", fmt(v.mes,2)) +
    kv("Custo por minuto falado", fmt(v.minutos>0 ? v.unit/v.minutos : 0)) +
    kv("Preço sugerido por chamada", fmt(v.unit*mkV)) +
    kv("Margem mensal", fmt(v.mes*mkV - v.mes, 2));

  $("c_texto").innerHTML =
    kv("Custo por conversa", fmt(t.unit)) +
    kv("Conversas por mês", int(t.qtdMes)) +
    kv("Custo mensal", fmt(t.mes,2)) +
    kv("Custo por resposta", fmt(n("t_msgs")>0 ? t.unit/n("t_msgs") : 0)) +
    kv("Preço sugerido por conversa", fmt(t.unit*mkT)) +
    kv("Margem mensal", fmt(t.mes*mkT - t.mes, 2));

  $("c_total").textContent = fmt(v.mes + t.mes, 2);

  const baseV = n("v_chamadas"), baseT = n("t_conversas");
  const cenarios = [
    {nome:"Metade do volume", f:0.5},
    {nome:"Volume atual",     f:1, aqui:true},
    {nome:"Dobro",            f:2},
    {nome:"Cinco vezes",      f:5},
    {nome:"Dez vezes",        f:10}
  ];
  $("c_sens").innerHTML = cenarios.map(c => {
    const cv = Math.round(baseV*c.f), ct = Math.round(baseT*c.f);
    const rv = calcVoz(cv), rt = calcTexto(ct);
    return `<tr class="${c.aqui?"destaque-linha":""}">
      <td>${c.nome}</td><td>${int(cv)}</td><td>${int(ct)}</td>
      <td>${fmt(rv.mes+rt.mes,2)}</td><td>${fmt(rv.unit)}</td><td>${fmt(rt.unit)}</td></tr>`;
  }).join("");
}

function atualizar(){
  const v = calcVoz(), t = calcTexto();
  pintar(v, {barra:"v_barra",itens:"v_itens",unit:"v_unit",mes:"v_mes",ref:"v_ref",markup:"v_markup",preco:"v_preco",receita:"v_receita",plano:"v_plano"}, "chamadas");
  pintar(t, {barra:"t_barra",itens:"t_itens",unit:"t_unit",mes:"t_mes",ref:"t_ref",markup:"t_markup",preco:"t_preco",receita:"t_receita",plano:"t_plano"}, "conversas");
  comparativo(v, t);
}

/* ----------------- tabela editável de preços ----------------- */
function selo(origem){
  if(!origem || origem === "padrao") return "";
  if(origem === "manual") return `<span class="selo manual">editado</span>`;
  return `<span class="selo viva">${origem.replace("api:","")}</span>`;
}

function montarTabelas(){
  $("tab-llm").innerHTML = PRECOS.llm.map((m,i) => `
    <tr>
      <td>${m.nome}${selo(ORIGEM.llm[m.id])}</td>
      <td class="n"><input type="number" step="0.01"  min="0" data-p="llm" data-i="${i}" data-c="in"    value="${m.in}"></td>
      <td class="n"><input type="number" step="0.005" min="0" data-p="llm" data-i="${i}" data-c="cache" value="${m.cache}"></td>
      <td class="n"><input type="number" step="0.01"  min="0" data-p="llm" data-i="${i}" data-c="out"   value="${m.out}"></td>
    </tr>`).join("");

  $("tab-stt").innerHTML = PRECOS.stt.map((m,i) => `
    <tr><td>${m.nome}${selo(ORIGEM.stt[m.id])}</td>
    <td class="n"><input type="number" step="0.0001" min="0" data-p="stt" data-i="${i}" data-c="min" value="${m.min}"></td></tr>`).join("");

  $("tab-tts").innerHTML = PRECOS.tts.map((m,i) => `
    <tr><td>${m.nome}${selo(ORIGEM.tts[m.id])}</td>
    <td class="n"><input type="number" step="0.001" min="0" data-p="tts" data-i="${i}" data-c="k" value="${m.k}"></td></tr>`).join("");

  $("tab-planos").innerHTML = PLANOS.map(p => `
    <tr><td>${p.nome}</td><td class="n num">${int(p["0.10"])}</td><td class="n num">${int(p["0.05"])}</td></tr>`).join("");

  document.querySelectorAll("[data-p]").forEach(inp => {
    inp.addEventListener("input", e => {
      const d = e.target.dataset;
      const val = parseFloat(e.target.value);
      PRECOS[d.p][+d.i][d.c] = isFinite(val) ? val : 0;
      ORIGEM[d.p][PRECOS[d.p][+d.i].id] = "manual";
      // guarda a edição sem mexer na data da última sincronização, senão
      // digitar um preço adiaria em 12 horas a próxima busca automática.
      const c = API.lerCache();
      API.salvarCache(c ? {quando: c.quando} : {quando: 0});
      // troca o selo só desta linha; refazer a tabela inteira tiraria o foco
      // do campo que está sendo digitado.
      const cel = e.target.closest("tr").firstElementChild;
      const atual = cel.querySelector(".selo");
      if(atual) atual.remove();
      cel.insertAdjacentHTML("beforeend", selo("manual"));
      popular();
      atualizar();
    });
  });
}

/* ----------------- sincronização com as APIs ----------------- */
function carimbo(quando){
  const d = new Date(quando);
  return d.toLocaleString("pt-BR", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"});
}

function mostrarStatus(texto, tipo, ocupado){
  ["st-precos","st-topo"].forEach(id => {
    const el = $(id);
    if(!el) return;
    el.className = "status" + (tipo ? " " + tipo : "") + (ocupado ? " pisca" : "");
    el.textContent = texto;
  });
}

function resumoSincronia(r){
  const partes = [];
  if(r.llm)    partes.push(`${r.llm} modelos de linguagem (${r.detalhes.join(", ")})`);
  if(r.audio)  partes.push(`${r.audio} tarifas de áudio do arquivo local`);
  if(r.cambio) partes.push(`dólar a R$ ${r.cambio.valor.toFixed(2).replace(".", ",")} pela ${r.cambio.fonte}`);

  if(!partes.length){
    return {texto:"Nenhuma fonte respondeu. " + (r.erros.join(" · ") || "Preencha os preços à mão."), tipo:"erro"};
  }
  let texto = "Atualizado em " + carimbo(Date.now()) + ": " + partes.join("; ") + ".";
  if(r.audioIndisponivel){
    texto += " Transcrição e voz continuam com os valores da tabela — o arquivo dados/precos-audio.json só é lido quando a página roda em um servidor.";
  }
  if(r.erros.length) texto += " Falhou: " + r.erros.join(" · ") + ".";
  return {texto, tipo: r.erros.length ? "" : "ok"};
}

let sincronizando = false;

async function sincronizar(aplicarCambio){
  if(sincronizando) return;
  sincronizando = true;
  mostrarStatus("Consultando…", "", true);
  try{
    const r = await API.sincronizar(t => mostrarStatus(t, "", true));
    if(r.cambio && aplicarCambio !== false){
      $("cambio").value = r.cambio.valor.toFixed(2);
    }
    montarTabelas();
    popular();
    atualizar();
    const res = resumoSincronia(r);
    mostrarStatus(res.texto, res.tipo, false);
    if(r.houveResultado) marcarRodape(Date.now());
  }catch(err){
    mostrarStatus("Não deu para consultar daqui (" + err.message + "). Preencha os preços à mão na tabela acima.", "erro", false);
  }finally{
    sincronizando = false;
  }
}

function marcarRodape(quando){
  const el = $("rodape-quando");
  if(el) el.textContent = quando ? "Preços sincronizados em " + carimbo(quando) : "Preços de referência embutidos no arquivo — nunca sincronizados.";
}

/* ----------------- abas ----------------- */
document.querySelectorAll(".aba").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".aba").forEach(x => x.setAttribute("aria-selected","false"));
    document.querySelectorAll(".painel").forEach(p => p.classList.remove("ativo"));
    b.setAttribute("aria-selected","true");
    $(b.dataset.alvo).classList.add("ativo");
  });
});

/* ----------------- resumo ----------------- */
$("btn-imprimir").addEventListener("click", () => window.print());

$("btn-copiar").addEventListener("click", async () => {
  const v = calcVoz(), t = calcTexto();
  const linhas = r => r.itens.filter(i=>i.v>0).map(i => `  ${i.rot}: ${fmt(i.v)}`).join("\n");
  const txt =
`ESTIMATIVA DE CUSTO — AGENTES DE IA
Gerado em ${new Date().toLocaleString("pt-BR")} · dólar a R$ ${cambio().toFixed(2)} · ${int(n("dias"))} dias/mês

VOZ — ${int(n("v_chamadas"))} chamadas/dia, ${n("v_dur")} min em média
${linhas(v)}
  Custo por chamada: ${fmt(v.unit)}
  Custo mensal: ${fmt(v.mes,2)}
  Preço sugerido por chamada: ${fmt(v.unit*(1+n("v_markup")/100))}

TEXTO — ${int(n("t_conversas"))} conversas/dia, ${int(n("t_msgs"))} respostas por conversa
${linhas(t)}
  Custo por conversa: ${fmt(t.unit)}
  Custo mensal: ${fmt(t.mes,2)}
  Preço sugerido por conversa: ${fmt(t.unit*(1+n("t_markup")/100))}

CUSTO MENSAL TOTAL: ${fmt(v.mes+t.mes,2)}
Preços de referência, sujeitos a alteração pelos fornecedores.`;
  try{
    await navigator.clipboard.writeText(txt);
    $("st-copia").className = "status ok";
    $("st-copia").textContent = "Resumo copiado.";
  }catch(e){
    $("st-copia").className = "status erro";
    $("st-copia").textContent = "O navegador bloqueou a cópia. Use Imprimir e salve em PDF.";
  }
  setTimeout(() => { $("st-copia").textContent = ""; }, 4000);
});

/* ----------------- start ----------------- */
(function iniciar(){
  const cache = API.lerCache();
  if(cache){
    API.aplicarCache(cache);
    if(cache.cambio && cache.cambio.valor) $("cambio").value = cache.cambio.valor.toFixed(2);
  }

  popular();
  montarTabelas();

  document.querySelectorAll("input, select").forEach(el => {
    if(el.dataset.p) return;
    el.addEventListener("input", atualizar);
    el.addEventListener("change", atualizar);
  });

  Object.keys(PADRAO_SELECAO).forEach(id => { $(id).value = PADRAO_SELECAO[id]; });
  atualizar();
  marcarRodape(cache ? cache.quando : null);

  $("btn-precos").addEventListener("click", () => sincronizar(true));
  const btnTopo = $("btn-sinc");
  if(btnTopo) btnTopo.addEventListener("click", () => sincronizar(true));

  // primeira carga do dia: busca sozinho se o cache venceu.
  if(API.vencido(cache)) sincronizar(true);
})();
