"use strict";

/* ============================================================
   dados.js — tabela de preços de referência
   Valores em dólar. LLM: por 1 milhão de tokens.
   STT: por minuto de áudio. TTS: por mil caracteres.

   Cada modelo de linguagem carrega dois identificadores usados
   pela sincronização automática (js/api.js):
     or → id na lista pública da OpenRouter
     md → "provedor/modelo" no catálogo do models.dev
   Modelo com os dois campos nulos nunca é sobrescrito pela API.
   ============================================================ */

const PRECOS = {
  llm: [
    {id:"gpt-5-mini",     nome:"OpenAI GPT-5 mini",      or:"openai/gpt-5-mini",       md:"openai/gpt-5-mini",       in:0.25, cache:0.025, out:2.00},
    {id:"gpt-5-nano",     nome:"OpenAI GPT-5 nano",      or:"openai/gpt-5-nano",       md:"openai/gpt-5-nano",       in:0.05, cache:0.005, out:0.40},
    {id:"gpt-4.1",        nome:"OpenAI GPT-4.1",         or:"openai/gpt-4.1",          md:"openai/gpt-4.1",          in:2.00, cache:0.50,  out:8.00},
    {id:"gpt-4.1-mini",   nome:"OpenAI GPT-4.1 mini",    or:"openai/gpt-4.1-mini",     md:"openai/gpt-4.1-mini",     in:0.40, cache:0.10,  out:1.60},
    {id:"gpt-4.1-nano",   nome:"OpenAI GPT-4.1 nano",    or:"openai/gpt-4.1-nano",     md:"openai/gpt-4.1-nano",     in:0.10, cache:0.025, out:0.40},
    {id:"gpt-4o-mini",    nome:"OpenAI GPT-4o mini",     or:"openai/gpt-4o-mini",      md:"openai/gpt-4o-mini",      in:0.15, cache:0.075, out:0.60},
    {id:"haiku-4.5",      nome:"Anthropic Claude Haiku 4.5", or:"anthropic/claude-haiku-4.5", md:"anthropic/claude-haiku-4-5", in:1.00, cache:0.10, out:5.00},
    {id:"gemini-flash",   nome:"Google Gemini 2.5 Flash",     or:"google/gemini-2.5-flash",      md:"google/gemini-2.5-flash",      in:0.30, cache:0.03,  out:2.50},
    {id:"gemini-flash-lt",nome:"Google Gemini 2.5 Flash Lite",or:"google/gemini-2.5-flash-lite", md:"google/gemini-2.5-flash-lite", in:0.10, cache:0.01,  out:0.40},
    {id:"deepseek-chat",  nome:"DeepSeek Chat",          or:"deepseek/deepseek-chat",  md:"deepseek/deepseek-chat",  in:0.27, cache:0.07,  out:1.10},
    {id:"custom-llm",     nome:"Personalizado",          or:null,                      md:null,                      in:1.00, cache:0.25,  out:3.00}
  ],
  stt: [
    {id:"nova3-stream", nome:"Deepgram Nova-3 streaming",   min:0.0077},
    {id:"nova3-file",   nome:"Deepgram Nova-3 pré-gravado", min:0.0043},
    {id:"nova2-stream", nome:"Deepgram Nova-2 streaming",   min:0.0059},
    {id:"nova2-file",   nome:"Deepgram Nova-2 pré-gravado", min:0.0043},
    {id:"whisper",      nome:"OpenAI Whisper",              min:0.0060},
    {id:"custom-stt",   nome:"Personalizado",               min:0.0050}
  ],
  tts: [
    {id:"v3",         nome:"ElevenLabs v3",                k:0.10},
    {id:"v3conv",     nome:"ElevenLabs v3 Conversacional", k:0.05},
    {id:"v2ml",       nome:"ElevenLabs v2 Multilíngue",    k:0.10},
    {id:"flash",      nome:"ElevenLabs Flash / Turbo",     k:0.05},
    {id:"custom-tts", nome:"Personalizado",                k:0.05}
  ]
};

/* franquia de caracteres inclusa em cada plano da ElevenLabs.
   A coluna usada depende da tarifa do modelo escolhido. */
const PLANOS = [
  {nome:"Free",     "0.10":10000,    "0.05":20000},
  {nome:"Starter",  "0.10":60000,    "0.05":120000},
  {nome:"Creator",  "0.10":220000,   "0.05":440000},
  {nome:"Pro",      "0.10":990000,   "0.05":1980000},
  {nome:"Scale",    "0.10":2990000,  "0.05":5980000},
  {nome:"Business", "0.10":9900000,  "0.05":19800000}
];

/* origem de cada número mostrado: "padrao", "api:<fonte>" ou "manual".
   Preenchido por api.js e app.js, lido só para exibir o selo. */
const ORIGEM = {llm:{}, stt:{}, tts:{}, cambio:"padrao"};

/* seleção inicial dos combos */
const PADRAO_SELECAO = {
  v_llm:"gpt-4.1-mini", t_llm:"gpt-4.1-mini",
  v_stt:"nova3-stream", t_stt:"nova2-file",
  v_tts:"flash",        t_tts:"flash"
};
