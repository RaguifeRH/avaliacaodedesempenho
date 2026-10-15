/* ============================================================
   AVALIAÇÃO DE DESEMPENHO RAGUIFE — núcleo
   utilitários, regras de negócio, login, menu e Início
   ============================================================ */
"use strict";

/* ---------------- utilitários ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const round2 = (v) => Math.round(v * 100) / 100;
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const fmtN = (v) => (v == null || isNaN(v) ? "—" : v.toFixed(2).replace(".", ","));
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const hojeISO = () => new Date().toISOString().slice(0, 10);
const agoraISO = () => new Date().toISOString();
const fmtData = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
const padMat = (m) => { const d = String(m ?? "").replace(/\D/g, ""); return d ? d.padStart(7, "0") : ""; };
const titulo = (s) => String(s || "").toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());
const iniciais = (n) => String(n || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
function parseData(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400000)); return isNaN(d) ? null : d.toISOString().slice(0, 10); }
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function senhaAleatoria() {
  const c = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = ""; const r = new Uint32Array(8); crypto.getRandomValues(r);
  r.forEach((x) => (s += c[x % c.length]));
  return s;
}
const emailDe = (mat, v) => `m${mat}.v${v || 0}@${window.DOMINIO_LOGIN}`;
/* acesso por CPF (operacionais que só avaliam o líder): usuário e senha = CPF, fixo */
const emailCPF = (mat, v) => `m${mat}.cpf.v${v || 0}@${window.DOMINIO_LOGIN}`;
const soDig = (v) => String(v ?? "").replace(/\D/g, "");
/* administradores entram com e-mail real (ex.: e-mail do setor de RH) e não fazem parte da base de funcionários */
const ehEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? "").trim());
const padCPF = (v) => { const d = soDig(v); return d && d.length <= 11 ? d.padStart(11, "0") : d; };
function cpfValido(v) {
  const c = soDig(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}
const fmtCPF = (v) => { const c = soDig(v); return c.length === 11 ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : c; };

function toast(msg, err) {
  const t = $("#toast"); t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = ""), err ? 5200 : 3000);
}
function modal(html, wide) {
  const m = $("#modal"); m.className = "modal" + (wide ? " wide" : ""); m.innerHTML = html;
  $("#modal-bg").classList.add("open");
  return m;
}
function fecharModal() { $("#modal-bg").classList.remove("open"); $("#modal").innerHTML = ""; }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharModal(); });
function confirmar(tit, texto, okTxt = "Confirmar", perigo) {
  return new Promise((res) => {
    const m = modal(`<h3>${esc(tit)}</h3><div style="font-size:13.5px;line-height:1.6">${texto}</div>
      <div class="btn-row"><button class="btn ${perigo ? "btn-danger" : "btn-primary"}" id="cf-ok">${esc(okTxt)}</button><button class="btn btn-ghost" id="cf-no">Cancelar</button></div>`);
    $("#cf-ok", m).onclick = () => { fecharModal(); res(true); };
    $("#cf-no", m).onclick = () => { fecharModal(); res(false); };
  });
}
function erroAmigavel(e) {
  const c = (e && (e.code || e.message)) || String(e);
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return "Usuário ou senha incorretos.";
  if (/too-many-requests/.test(c)) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  if (/weak-password/.test(c)) return "Senha fraca: use ao menos 6 caracteres.";
  if (/requires-recent-login/.test(c)) return "Por segurança, saia e entre de novo antes de alterar a senha.";
  if (/permission|insufficient/.test(c)) return "Você não tem permissão para esta ação.";
  if (/network|unavailable|offline/.test(c)) return "Sem conexão com o servidor. Verifique a internet.";
  if (/email-already-in-use/.test(c)) return "Este e-mail já tem uma conta no Firebase. Apague-a em Authentication → Usuários e tente de novo.";
  if (/invalid-email/.test(c)) return "E-mail inválido.";
  if (/demo\/sem-email/.test(c)) return "No modo demonstração não há envio de e-mail.";
  return typeof c === "string" ? c : "Erro inesperado.";
}
function baixarXLSX(linhas, nomeAba, arquivo) {
  if (!linhas.length) return toast("Nada para exportar.", true);
  const ws = XLSX.utils.json_to_sheet(linhas);
  ws["!cols"] = Object.keys(linhas[0]).map((k) => ({ wch: Math.min(60, Math.max(10, k.length + 2, ...linhas.slice(0, 200).map((r) => String(r[k] ?? "").length + 1))) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, nomeAba.slice(0, 31));
  XLSX.writeFile(wb, arquivo);
}
async function comBotao(btn, fn) {
  const txt = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span> ${txt}`;
  try { return await fn(); } catch (e) { console.error(e); toast(erroAmigavel(e), true); } finally { btn.disabled = false; btn.innerHTML = txt; }
}

/* ---------------- regras de negócio ---------------- */
const NIVEIS = {
  operacional: { t: "Operacional", pill: "p-neutral", publico: "ci" },
  lideranca: { t: "Liderança", pill: "p-info", publico: "lideranca" },
  gestor: { t: "Gestor", pill: "p-verde", publico: "pares" },
  diretoria: { t: "Diretoria", pill: "p-warn", publico: null },
};
const PUBLICOS = { ci: "Colaborador Individual", lideranca: "Liderança", pares: "Pares (Gestores)" };
const PAPEIS = { lider: "Líder direto", liderado: "Liderado", par: "Par" };
const PERFIS = { rh: "RH", n2: "N2", diretoria: "Diretoria" };
const ETAPAS = [
  { id: "preparacao", t: "Preparação", d: "Base, ocorrências, elegibilidade e avaliadores" },
  { id: "avaliacao", t: "Avaliação", d: "Avaliadores respondem no sistema" },
  { id: "calibracao", t: "Calibração", d: "N2 revisa a 9-Box e recomenda mérito" },
  { id: "comite", t: "Comitê", d: "Decisões de mérito e cartas" },
  { id: "encerrado", t: "Encerrado", d: "Resultado disponível para consulta" },
];
const STATUS_OK = ["ATIVO", "FERIAS"];
/* fora da avaliação: cargo de diretor ou perfil Diretoria */
const ehDiretoria = (f) => !!f && (f.nivel === "diretoria" || (f.perfis || []).includes("diretoria"));

function nivelPorCargo(cargo) {
  const c = norm(cargo);
  if (/DIRETOR/.test(c)) return "diretoria";
  if (/SUPERVISOR|COORDENADOR|GERENTE/.test(c)) return "gestor";
  if (/\bLIDER\b|ENCARREGAD/.test(c)) return "lideranca";
  return "operacional";
}
/* Faixas — política GP020: Abaixo até 3,00 · Em linha 3,01 a 4,00 · Acima acima de 4,00 */
function faixa(v) {
  if (v == null) return null;
  v = round2(v);
  if (v <= 3) return "Abaixo";
  if (v <= 4) return "Em linha";
  return "Acima";
}
const FAIXA_PILL = { Abaixo: "p-bad", "Em linha": "p-info", Acima: "p-ok" };
const FAIXA_COR = { Abaixo: "#b3372f", "Em linha": "#1d4e89", Acima: "#1f7a45" };
/* 9-Box: [faixa técnica][faixa comportamental] */
const BOX = {
  Acima: { Acima: "Orgulho Raguife", "Em linha": "Técnico de Ouro", Abaixo: "Comportamento em Desenvolvimento" },
  "Em linha": { Acima: "Comportamento de Ouro", "Em linha": "Colaborador Raguife", Abaixo: "Oportunidade Comportamental" },
  Abaixo: { Acima: "Técnico em Desenvolvimento", "Em linha": "Oportunidade Técnica", Abaixo: "Ponto de Atenção" },
};
const BOX_LISTA = [];
["Acima", "Em linha", "Abaixo"].forEach((t) => ["Acima", "Em linha", "Abaixo"].forEach((c) => BOX_LISTA.push({ nome: BOX[t][c], tec: t, comp: c })));
const BOX_COR = {
  "Orgulho Raguife": "#134F22", "Técnico de Ouro": "#2C5F2E", "Comportamento de Ouro": "#1A6B4A", "Colaborador Raguife": "#1B6B2E",
  "Comportamento em Desenvolvimento": "#9a6a08", "Técnico em Desenvolvimento": "#6A1B9A", "Oportunidade Comportamental": "#B45309",
  "Oportunidade Técnica": "#7E22CE", "Ponto de Atenção": "#991B1B",
};

/* ---------------- estado e caches ---------------- */
const S = { me: null, cfg: null, ciclo: null, page: "inicio", boot: false };
const C = {};
async function carregarFuncs(forcar) {
  if (!C.func || forcar) { const l = await DB.list("funcionarios"); C.func = {}; l.forEach((f) => (C.func[f.id] = f)); }
  return C.func;
}
async function carregarDeptos(forcar) {
  if (!C.deptos || forcar) { const l = await DB.list("deptos"); C.deptos = {}; l.forEach((d) => (C.deptos[d.nome] = d)); }
  return C.deptos;
}
async function carregarQuest(forcar) {
  if (!C.quest || forcar) {
    const l = await DB.list("questionarios"); C.quest = {};
    l.forEach((q) => (C.quest[q.id] = q.competencias || []));
    Object.keys(PUBLICOS).forEach((p) => { if (!C.quest[p]) C.quest[p] = window.MATRIZ_2026[p]; });
  }
  return C.quest;
}
function invalidar(...k) { k.forEach((x) => delete C[x]); }
const nomeDe = (mat) => (C.func && C.func[mat] ? titulo(C.func[mat].nome) : mat || "—");
const ativoNaBase = (f) => f.naBase !== false && STATUS_OK.includes(norm(f.status));
/* avaliador direto: exceção da pessoa → regra do departamento por nível */
function avaliadorDireto(f) {
  let a = f.avaliadorDireto;
  if (!a) {
    const d = (C.deptos || {})[f.depto] || {};
    a = { operacional: d.avalOperacional, lideranca: d.avalLideranca, gestor: d.avalGestor }[f.nivel];
  }
  return a && a !== f.matricula ? a : null;
}
const temPerfil = (p) => (S.me?.perfis || []).includes(p);
const ehRH = () => temPerfil("rh");
async function auditar(acao, detalhe) {
  try { await DB.add("auditoria", { acao, detalhe: detalhe || "", por: S.me?.matricula || "", em: agoraISO() }); } catch (e) { /* não bloqueia */ }
}
async function recarregarCiclo() {
  S.cfg = await DB.get("config", "geral");
  S.ciclo = S.cfg && S.cfg.cicloAtivo ? await DB.get("ciclos", S.cfg.cicloAtivo) : null;
}

/* ---------------- ícones ---------------- */
const IC = {
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
  cycle: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  tree: '<rect x="9" y="2" width="6" height="5"/><rect x="2" y="17" width="6" height="5"/><rect x="16" y="17" width="6" height="5"/><path d="M12 7v5M5 17v-5h14v5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
  grid: '<rect x="3" y="3" width="5" height="5"/><rect x="10" y="3" width="5" height="5"/><rect x="17" y="3" width="4" height="5"/><rect x="3" y="10" width="5" height="5"/><rect x="10" y="10" width="5" height="5"/><rect x="17" y="10" width="4" height="5"/><rect x="3" y="17" width="5" height="4"/><rect x="10" y="17" width="5" height="4"/><rect x="17" y="17" width="4" height="4"/>',
  scale: '<path d="M12 3v18M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z"/>',
  mail: '<rect x="3" y="5" width="18" height="14"/><path d="M3 6l9 7 9-7"/>',
  money: '<rect x="2" y="6" width="20" height="12"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>',
  pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k] || ""}</svg>`;
function logoSVG(size) {
  return `<svg width="${size}" height="${size * 0.78}" viewBox="0 0 100 78" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="4" y="4" width="92" height="70" rx="12" fill="none" stroke="#8CB43E" stroke-width="7"/>
    <circle cx="30" cy="27" r="6.5" fill="#8CB43E"/><circle cx="50" cy="23" r="6.5" fill="#8CB43E"/><circle cx="70" cy="27" r="6.5" fill="#8CB43E"/>
    <path d="M27 40 v9 a11.5 11.5 0 0 0 23 0 v-9" fill="none" stroke="#8CB43E" stroke-width="9" stroke-linecap="round"/>
    <path d="M50 40 v9 a11.5 11.5 0 0 0 23 0 v-9" fill="none" stroke="#8CB43E" stroke-width="9" stroke-linecap="round"/></svg>`;
}

/* ---------------- menu ---------------- */
const NAV = [
  { grp: "Geral", itens: [
    { id: "inicio", t: "Início", ic: "home", ver: () => true },
    { id: "minhas", t: "Minhas avaliações", ic: "check", ver: () => true },
  ] },
  { grp: "Preparação · RH", itens: [
    { id: "ciclos", t: "Ciclo", ic: "cycle", ver: ehRH },
    { id: "funcionarios", t: "Funcionários", ic: "users", ver: ehRH },
    { id: "ocorrencias", t: "Ocorrências", ic: "alert", ver: ehRH },
    { id: "elegibilidade", t: "Elegibilidade", ic: "filter", ver: ehRH },
    { id: "avaliadores", t: "Avaliadores", ic: "tree", ver: ehRH },
    { id: "questionarios", t: "Questionários", ic: "list", ver: ehRH },
    { id: "tabela", t: "Tabela salarial", ic: "money", ver: ehRH },
    { id: "acessos", t: "Acessos e senhas", ic: "key", ver: ehRH },
    { id: "admins", t: "Administradores", ic: "shield", ver: ehRH },
    { id: "acompanhamento", t: "Acompanhamento", ic: "pulse", ver: ehRH },
  ] },
  { grp: "Resultados", itens: [
    { id: "resultados", t: "Painel e 9-Box", ic: "chart", ver: () => ehRH() || temPerfil("n2") || temPerfil("diretoria") },
    { id: "calibracao", t: "Calibração", ic: "grid", ver: () => ehRH() || temPerfil("n2") },
    { id: "comite", t: "Comitê", ic: "scale", ver: () => ehRH() || temPerfil("diretoria") },
    { id: "cartas", t: "Cartas de feedback", ic: "mail", ver: ehRH },
  ] },
];
const PAGES = {};

function renderShell() {
  const perfisTxt = (S.me.perfis || []).map((p) => PERFIS[p]).filter(Boolean).join(" · ") || "Avaliador";
  $("#root").innerHTML = `<div class="layout">
    <aside class="side">
      <div class="brand">${logoSVG(34)}<div><span class="wordmark">raguife</span><span class="app-sub">Avaliação de Desempenho</span></div></div>
      <div class="navs">${NAV.map((g) => {
        const its = g.itens.filter((i) => i.ver());
        if (!its.length) return "";
        return `<div class="grp"><div class="navlbl">${g.grp}</div>${its.map((i) => `<button class="navbtn" data-p="${i.id}"><span class="ic">${icon(i.ic)}</span>${i.t}<span class="cnt hidden" id="cnt-${i.id}"></span></button>`).join("")}</div>`;
      }).join("")}</div>
      <div class="who">
        <div class="who-id"><div class="who-av">${esc(iniciais(titulo(S.me.nome)))}</div><div class="who-tx"><b>${esc(titulo(S.me.nome))}</b><span>${esc(S.me.matricula)} · ${esc(perfisTxt)}</span></div></div>
        <div class="who-btns">${S.me.tipoAcesso === "cpf" ? "" : '<button class="btn-top" id="bt-senha">Alterar senha</button>'}<button class="btn-top" id="bt-sair">Sair</button></div>
      </div>
    </aside>
    <main id="main"></main>
  </div>`;
  $$(".navbtn").forEach((b) => (b.onclick = () => ir(b.dataset.p)));
  $("#bt-sair").onclick = () => AUTH.logout();
  if ($("#bt-senha")) $("#bt-senha").onclick = () => telaTrocaSenha(true);
  atualizarContadorMinhas();
  ir(S.page && PAGES[S.page] ? S.page : "inicio");
}
async function ir(p, params) {
  const item = NAV.flatMap((g) => g.itens).find((i) => i.id === p);
  if (!item || !item.ver()) p = "inicio";
  S.page = p; S.params = params || {};
  $$(".navbtn").forEach((b) => b.classList.toggle("active", b.dataset.p === p));
  const main = $("#main");
  main.innerHTML = `<div class="loading"><span class="spin"></span> Carregando…</div>`;
  window.scrollTo(0, 0);
  try { await PAGES[p](main, S.params); } catch (e) { console.error(e); main.innerHTML = `<div class="page"><div class="note bad">Não foi possível abrir esta tela: ${esc(erroAmigavel(e))}</div></div>`; }
}
async function atualizarContadorMinhas() {
  if (!S.ciclo || S.ciclo.etapa !== "avaliacao") return;
  try {
    const l = await DB.list("avaliacoes", [["avaliador", "==", S.me.matricula], ["ciclo", "==", S.ciclo.id]]);
    const n = l.filter((a) => a.status !== "enviada").length;
    const el = $("#cnt-minhas"); if (el) { el.textContent = n; el.classList.toggle("hidden", !n); }
  } catch (e) { /* ignora */ }
}
const cabecalho = (eyebrow, tit, desc) => `<div class="page-head"><div class="eyebrow-mod">${esc(eyebrow)}</div><h1 class="page-title">${tit}</h1>${desc ? `<p class="page-desc">${desc}</p>` : ""}</div>`;
const semCiclo = () => `<div class="panel"><h2>Nenhum ciclo aberto</h2><p class="desc" style="border:0;margin:0;padding:0">${ehRH() ? `Abra um ciclo em <button class="btn-link" onclick="ir('ciclos')">Ciclo</button> para começar.` : "O RH ainda não abriu o ciclo de avaliação."}</p></div>`;
function kpi(rot, val, meta, barPct) {
  return `<div class="kpi"><div class="eyebrow">${rot}</div><div class="val">${val}</div>${meta ? `<div class="meta">${meta}</div>` : ""}${barPct != null ? `<div class="bar"><span style="width:${Math.min(100, barPct)}%"></span></div>` : ""}</div>`;
}
function stepperHTML(etapa) {
  const i = ETAPAS.findIndex((e) => e.id === etapa);
  return `<div class="stepper">${ETAPAS.map((e, k) => `<div class="step ${k < i ? "done" : k === i ? "cur" : ""}"><div class="n">${k + 1}</div><div class="t">${e.t}</div><div class="d">${e.d}</div></div>`).join("")}</div>`;
}

/* ---------------- Início ---------------- */
PAGES.inicio = async (el) => {
  const c = S.ciclo;
  const nome = titulo(S.me.nome).split(" ")[0];
  let minhas = [];
  if (c) minhas = await DB.list("avaliacoes", [["avaliador", "==", S.me.matricula], ["ciclo", "==", c.id]]);
  const pend = minhas.filter((a) => a.status !== "enviada").length;
  const etapa = c ? ETAPAS.find((e) => e.id === c.etapa) : null;
  let html = `<div class="page">
    <div class="hero"><div class="eyebrow-mod">${c ? "Ciclo " + esc(c.rotulo) : "Avaliação de Desempenho"}</div>
      <h1 class="page-title">Olá, <em>${esc(nome)}</em></h1>
      <p class="page-desc">${c ? `Etapa atual: <b style="color:#fff">${etapa.t}</b> — ${etapa.d}.${c.etapa === "avaliacao" && c.prazo ? ` <b style="color:#fff">${esc(prazoTxt(c))}.</b>` : ""}` : "Nenhum ciclo de avaliação aberto no momento."}</p></div>`;
  if (c) html += stepperHTML(c.etapa) + "<br>";
  if (c && minhas.length) {
    html += `<div class="panel"><h2>Suas avaliações</h2><p class="desc">${c.etapa === "avaliacao" ? (pend ? `Você tem <b>${pend}</b> de ${minhas.length} avaliações para concluir.` : "Você concluiu todas as suas avaliações. Obrigado!") : "O período de respostas não está aberto."}</p>
      <button class="btn btn-primary" onclick="ir('minhas')">${pend && c.etapa === "avaliacao" ? "Responder agora" : "Ver minhas avaliações"}</button></div>`;
  } else if (c) {
    html += `<div class="panel"><h2>Suas avaliações</h2><p class="desc" style="border:0;padding:0;margin:0">Você não tem avaliações para responder neste ciclo.</p></div>`;
  }
  if (ehRH()) {
    html += `<div class="panel"><h2>Atalhos do RH</h2><p class="desc">Siga a ordem do ciclo.</p><div class="btn-row" style="margin:0">
      ${["ciclos", "funcionarios", "ocorrencias", "elegibilidade", "avaliadores", "acessos", "acompanhamento", "resultados"].map((p) => `<button class="btn btn-ghost btn-mini" onclick="ir('${p}')">${NAV.flatMap((g) => g.itens).find((i) => i.id === p).t}</button>`).join("")}</div></div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
};

/* ---------------- login, primeiro acesso, setup ---------------- */
function telaAuth(conteudo) {
  $("#root").innerHTML = `<div class="auth-wrap">
    <div class="auth-art">
      <div class="auth-brand">${logoSVG(46)}<div><span class="wordmark">raguife</span><span class="app-sub">Gestão de Pessoas</span></div></div>
      <div><h1 class="auth-title">Avaliação de<br><em>Desempenho</em></h1><p>Ciclos semestrais de junho e dezembro. Avalie sua equipe, seus pares e sua liderança com base na Matriz de Competências Raguife.</p></div>
      <p style="font-size:11.5px;color:#8fb39a;margin:0">Política GP020 · Remuneração e Desempenho</p>
    </div>
    <div class="auth-form"><div class="auth-box">${conteudo}</div></div></div>`;
}
function telaLogin(msg) {
  telaAuth(`<div class="eyebrow-mod">Acesso</div><h2>Entrar</h2>
    <form id="f-login" autocomplete="on">
      <div class="fld"><label for="l-mat">Matrícula, CPF ou e-mail</label><input id="l-mat" autocomplete="username" required placeholder="Matrícula (0200802) ou CPF, só números"></div>
      <div class="fld"><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" required></div>
      <button class="btn btn-primary" style="width:100%" type="submit">Entrar</button>
      <div class="auth-msg" id="l-msg">${esc(msg || "")}</div>
    </form>
    <p class="auth-help"><b>Operacionais:</b> digite o seu CPF, só números, no usuário e na senha.<br><b>Líderes e gestores:</b> use a matrícula (chapa) e a senha entregue pelo RH; no primeiro acesso, você cria uma senha nova.<br><b>Administradores:</b> entram com o e-mail. <button type="button" class="btn-link" id="l-esqueci">Esqueci minha senha</button><br>Problemas para entrar? Procure o RH.</p>`);
  $("#l-esqueci").onclick = () => telaRecuperar(ehEmail($("#l-mat").value) ? $("#l-mat").value.trim() : "");
  $("#f-login").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("#f-login button"); const msgEl = $("#l-msg"); msgEl.textContent = "";
    await comBotao(btn, async () => {
      const bruto = $("#l-mat").value.trim();
      if (bruto.includes("@")) {
        if (!ehEmail(bruto)) { msgEl.textContent = "E-mail inválido."; return; }
        try { await AUTH.login(bruto.toLowerCase(), $("#l-senha").value); } catch (er) { msgEl.textContent = erroAmigavel(er); }
        return;
      }
      const dig = soDig(bruto);
      const porCPF = dig.length === 11;
      const id = porCPF ? "cpf_" + dig : padMat(dig);
      const l = dig ? await DB.get("logins", id) : null;
      if (!l) { msgEl.textContent = porCPF ? "CPF sem acesso cadastrado. Procure o RH." : "Matrícula sem acesso cadastrado. Procure o RH."; return; }
      try { await AUTH.login(l.email, $("#l-senha").value); } catch (er) { msgEl.textContent = erroAmigavel(er); }
    });
  };
}
/* recuperação de senha: só para administradores (conta com e-mail real) */
function telaRecuperar(emailIni) {
  telaAuth(`<div class="eyebrow-mod">Administradores</div><h2>Recuperar senha</h2>
    <form id="f-rec">
      <div class="fld"><label for="r-email">E-mail do administrador</label><input id="r-email" type="email" autocomplete="username" required value="${esc(emailIni || "")}"></div>
      <button class="btn btn-primary" style="width:100%" type="submit">Enviar link</button>
      <button class="btn btn-ghost" style="width:100%;margin-top:8px" type="button" id="r-voltar">Voltar</button>
      <div class="auth-msg" id="r-msg"></div>
    </form>
    <p class="auth-help">Você receberá um link para criar uma nova senha. Se não chegar em alguns minutos, confira a caixa de spam.<br>Funcionários que entram por matrícula ou CPF devem procurar o RH.</p>`);
  $("#r-voltar").onclick = () => telaLogin();
  $("#f-rec").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#r-email").value.trim().toLowerCase(), msgEl = $("#r-msg");
    if (!ehEmail(email)) { msgEl.textContent = "E-mail inválido."; return; }
    await comBotao($("#f-rec button[type=submit]"), async () => {
      try {
        await AUTH.resetPassword(email);
        msgEl.style.color = "var(--okc)";
        msgEl.textContent = "Se este e-mail for de um administrador, o link foi enviado.";
      } catch (er) { msgEl.style.color = ""; msgEl.textContent = /user-not-found/.test(er.code || "") ? "Se este e-mail for de um administrador, o link foi enviado." : erroAmigavel(er); }
    });
  };
}
function telaTrocaSenha(voluntaria) {
  const html = `<div class="eyebrow-mod">${voluntaria ? "Sua conta" : "Primeiro acesso"}</div><h2>${voluntaria ? "Alterar senha" : "Crie sua senha"}</h2>
    <form id="f-senha">
      <div class="fld"><label>Nova senha</label><input type="password" id="s1" minlength="6" required autocomplete="new-password"></div>
      <div class="fld"><label>Repita a nova senha</label><input type="password" id="s2" minlength="6" required autocomplete="new-password"></div>
      <button class="btn btn-primary" style="width:100%" type="submit">Salvar senha</button>
      ${voluntaria ? `<button class="btn btn-ghost" style="width:100%;margin-top:8px" type="button" id="s-cancel">Cancelar</button>` : ""}
      <div class="auth-msg" id="s-msg"></div>
    </form><p class="auth-help">Use ao menos 6 caracteres. Não compartilhe sua senha: suas avaliações são confidenciais.</p>`;
  if (voluntaria) { const m = modal(`<h3>Alterar senha</h3>` + html.replace(/<div class="eyebrow-mod">.*?<\/h2>/s, "")); $("#s-cancel", m).onclick = fecharModal; }
  else telaAuth(html);
  $("#f-senha").onsubmit = async (e) => {
    e.preventDefault();
    const a = $("#s1").value, b = $("#s2").value, msgEl = $("#s-msg");
    if (a !== b) { msgEl.textContent = "As senhas não conferem."; return; }
    if (a.length < 6) { msgEl.textContent = "Use ao menos 6 caracteres."; return; }
    await comBotao($("#f-senha button[type=submit]"), async () => {
      try {
        await AUTH.changePassword(a);
        if (S.me.trocarSenha) { await DB.update("usuarios", S.me.uid, { trocarSenha: false }); S.me.trocarSenha = false; }
        if (voluntaria) { fecharModal(); toast("Senha alterada."); } else { await entrarNoApp(); }
      } catch (er) { msgEl.textContent = erroAmigavel(er); }
    });
  };
}
function telaSetup() {
  telaAuth(`<div class="eyebrow-mod">Primeira configuração</div><h2>Criar acesso do RH</h2>
    <p class="auth-help" style="margin:-6px 0 14px">Este sistema ainda não tem usuários. Cadastre o primeiro administrador. Use o <b>e-mail do setor de RH</b> para uma conta que não entra na avaliação, ou uma matrícula. Os demais acessos são gerados depois, dentro do sistema.</p>
    <form id="f-setup">
      <div class="fld"><label>E-mail do setor ou matrícula</label><input id="u-mat" required placeholder="rh@empresa.com.br"></div>
      <div class="fld"><label>Nome completo</label><input id="u-nome" required></div>
      <div class="fld"><label>Senha</label><input id="u-s1" type="password" minlength="6" required></div>
      <div class="fld"><label>Repita a senha</label><input id="u-s2" type="password" minlength="6" required></div>
      <button class="btn btn-primary" style="width:100%" type="submit">Criar e entrar</button>
      <div class="auth-msg" id="u-msg"></div>
    </form>`);
  $("#f-setup").onsubmit = async (e) => {
    e.preventDefault();
    const bruto = $("#u-mat").value.trim(), nome = $("#u-nome").value.trim().toUpperCase(), s1 = $("#u-s1").value;
    const porEmail = bruto.includes("@");
    const mat = porEmail ? bruto.toLowerCase() : padMat(bruto);
    if (porEmail && !ehEmail(bruto)) return ($("#u-msg").textContent = "E-mail inválido.");
    if (!mat) return ($("#u-msg").textContent = "Informe o e-mail ou a matrícula.");
    if (s1 !== $("#u-s2").value) return ($("#u-msg").textContent = "As senhas não conferem.");
    await comBotao($("#f-setup button"), async () => {
      S.boot = true;
      try {
        if (porEmail) {
          const uid = await AUTH.createSelf(mat, s1);
          await DB.batch([
            { col: "usuarios", id: uid, data: { matricula: mat, email: mat, nome, perfis: ["rh"], tipoAcesso: "email", trocarSenha: false, criadoEm: agoraISO() } },
            { col: "config", id: "geral", data: { criadoEm: agoraISO(), cicloAtivo: null } },
          ]);
          await DB.batch(Object.keys(PUBLICOS).map((p) => ({ col: "questionarios", id: p, data: { publico: p, competencias: window.MATRIZ_2026[p], atualizadoEm: agoraISO() } })));
          S.boot = false;
          return await aoMudarSessao({ uid });
        }
        const email = emailDe(mat, 0);
        const uid = await AUTH.createSelf(email, s1);
        await DB.batch([
          { col: "usuarios", id: uid, data: { matricula: mat, nome, perfis: ["rh"], trocarSenha: false, versao: 0, criadoEm: agoraISO() } },
          { col: "logins", id: mat, data: { email, uid } },
          { col: "config", id: "geral", data: { criadoEm: agoraISO(), cicloAtivo: null } },
        ]);
        await DB.batch([
          ...Object.keys(PUBLICOS).map((p) => ({ col: "questionarios", id: p, data: { publico: p, competencias: window.MATRIZ_2026[p], atualizadoEm: agoraISO() } })),
          { col: "funcionarios", id: mat, data: { matricula: mat, nome, perfis: ["rh"], nivel: "gestor", naBase: false, origem: "manual" } },
        ]);
        S.boot = false;
        await aoMudarSessao({ uid });
      } catch (er) { S.boot = false; $("#u-msg").textContent = erroAmigavel(er); }
    });
  };
}
async function entrarNoApp() {
  await recarregarCiclo();
  renderShell();
}
async function aoMudarSessao(u) {
  if (S.boot) return;
  Object.keys(C).forEach((k) => delete C[k]);
  if (!u) {
    S.me = null;
    const cfg = await DB.get("config", "geral").catch(() => null);
    const aviso = S.avisoLogin; S.avisoLogin = null;
    return cfg ? telaLogin(aviso) : telaSetup();
  }
  const me = await DB.get("usuarios", u.uid).catch(() => null);
  if (!me || me.removido) { const av = "Este acesso foi desativado ou reiniciado. Procure o RH."; S.avisoLogin = av; await AUTH.logout(); return telaLogin(av); }
  S.me = { ...me, uid: u.uid };
  if (me.trocarSenha) return telaTrocaSenha(false);
  await entrarNoApp();
}

window.addEventListener("load", async () => {
  try {
    const modo = await initStore();
    if (modo === "demo") {
      const bar = $("#demo-bar");
      bar.innerHTML = `<b>Modo demonstração.</b> Os dados ficam só neste navegador. Para usar de verdade, configure o Firebase em <code>js/config.js</code>.<button id="bt-reset-demo">Apagar dados de demonstração</button>`;
      bar.classList.remove("hidden");
      $("#bt-reset-demo").onclick = async () => { if (await confirmar("Apagar demonstração", "Todos os dados de teste deste navegador serão apagados.", "Apagar", true)) AUTH.resetDemo(); };
    }
    AUTH.onChange((u) => aoMudarSessao(u).catch((e) => { console.error(e); telaLogin(erroAmigavel(e)); }));
  } catch (e) {
    console.error(e);
    $("#root").innerHTML = `<div class="page" style="padding:30px"><div class="note bad">Falha ao iniciar: ${esc(erroAmigavel(e))}</div></div>`;
  }
});
