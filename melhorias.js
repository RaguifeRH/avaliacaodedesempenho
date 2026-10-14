/* ============================================================
   MELHORIAS DO CICLO
   orçamento, bloqueios de mérito, evolução vs ciclo anterior,
   qualidade das respostas, prazo e cobrança, importação de ocorrências
   ============================================================ */
"use strict";

const MIN_ANON = 3; // mínimo de respostas para exibir a média de liderados ou de pares

function addMeses(iso, n) { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); }
function diasAte(iso) { if (!iso) return null; return Math.round((new Date(iso + "T23:59:59") - new Date()) / 86400000); }

/* ---------- bloqueio de mérito (política GP020) ---------- */
function bloqueioMerito(r, c = S.ciclo) {
  const m = [];
  if (r.faixaGeral === "Abaixo") m.push("Abaixo do esperado");
  const lim = addMeses(c.periodoFim, -6);
  if (r.dataCargo && r.dataCargo > lim) m.push(`No cargo desde ${fmtData(r.dataCargo)} (menos de 6 meses)`);
  if (r.ultimoReajuste && r.ultimoReajuste > lim) m.push(`Reajuste em ${fmtData(r.ultimoReajuste)} (menos de 6 meses)`);
  return m;
}
/* data em que o mérito aprovado passa a valer: julho (ciclo de junho) ou janeiro seguinte */
function vigenciaMerito(c) { const [a, s] = c.id.split("-"); return s === "06" ? `${a}-07-01` : `${+a + 1}-01-01`; }

/* ---------- evolução na 9-Box ---------- */
const ORD = { Abaixo: 0, "Em linha": 1, Acima: 2 };
function scoreBox(nome) { const b = BOX_LISTA.find((x) => norm(x.nome) === norm(nome)); return b ? ORD[b.tec] + ORD[b.comp] : null; }
function nomeBoxPadrao(nome) { const b = BOX_LISTA.find((x) => norm(x.nome) === norm(nome)); return b ? b.nome : null; }
function movimento(ant, atual) {
  if (!ant || !ant.box) return null;
  const a = scoreBox(ant.box), b = scoreBox(atual);
  if (a == null || b == null) return null;
  if (norm(ant.box) === norm("Ponto de Atenção") && norm(atual) === norm("Ponto de Atenção")) return "reincidente";
  return b > a ? "subiu" : b < a ? "caiu" : "manteve";
}
const MOV = { subiu: ["p-ok", "↑ Evoluiu"], manteve: ["p-neutral", "= Manteve"], caiu: ["p-bad", "↓ Caiu"], reincidente: ["p-bad", "Ponto de Atenção 2º ciclo"] };
const movDe = (r) => movimento(r.anterior, r.boxCal || r.boxCalc);
const movHTML = (r) => (r.anterior ? `<span class="pill ${MOV[movDe(r)]?.[0] || "p-neutral"}" title="${esc(r.anterior.rotulo)}: ${esc(r.anterior.box)}">${MOV[movDe(r)]?.[1] || "—"}</span><span class="sub">${esc(r.anterior.rotulo)}: ${esc(r.anterior.box)}</span>` : '<span class="sub">Sem histórico</span>');

/* fonte de comparação: ciclo do sistema ou histórico importado mais recente antes do atual */
async function fonteAnterior(cicloId) {
  const ciclos = (await DB.list("ciclos")).filter((x) => x.id < cicloId && ["comite", "encerrado"].includes(x.etapa));
  const hist = (await DB.list("historico")).filter((h) => h.id < cicloId);
  const cand = [...ciclos.map((x) => ({ id: x.id, rotulo: x.rotulo, tipo: "sistema" })), ...hist.map((h) => ({ id: h.id, rotulo: h.rotulo, tipo: "historico", itens: h.itens }))].sort((a, b) => b.id.localeCompare(a.id));
  const f = cand[0]; if (!f) return null;
  const porMat = {}, porNome = {};
  if (f.tipo === "sistema") (await DB.list("resultados", [["ciclo", "==", f.id]])).forEach((r) => { const v = { box: r.boxCal || r.boxCalc, media: r.mediaGeral, rotulo: f.rotulo }; porMat[r.matricula] = v; porNome[norm(r.nome)] = v; });
  else Object.values(f.itens || {}).forEach((i) => { const v = { box: i.box, media: i.media ?? null, rotulo: f.rotulo }; if (i.matricula) porMat[i.matricula] = v; porNome[norm(i.nome)] = v; });
  return { rotulo: f.rotulo, achar: (mat, nome) => porMat[mat] || porNome[norm(nome)] || null };
}

function lerHistorico9Box(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  for (const nome of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, defval: "", raw: true });
    const hi = rows.findIndex((r) => r.some((x) => norm(x) === "NOME") && r.some((x) => /9.?BOX/.test(norm(x))));
    if (hi < 0) continue;
    const H = rows[hi].map(norm);
    const iN = H.indexOf("NOME");
    const iB = [H.findIndex((h) => /9.?BOX CALIBRAD/.test(h)), H.findIndex((h) => /9.?BOX/.test(h))].find((i) => i >= 0);
    const iM = H.findIndex((h) => /MEDIA GERAL|NOTA GERAL/.test(h));
    const iMat = H.findIndex((h) => /^(MATRICULA|CHAPA)/.test(h));
    const itens = {};
    rows.slice(hi + 1).forEach((r) => {
      const n = String(r[iN] || "").trim(); const box = nomeBoxPadrao(r[iB]);
      if (!n || !box) return;
      const mat = iMat >= 0 ? padMat(r[iMat]) : "";
      const media = iM >= 0 && r[iM] !== "" ? round2(+String(r[iM]).replace(",", ".")) : null;
      itens[(mat || norm(n)).replace(/[.\/#$\[\]]/g, "_")] = { nome: n.toUpperCase(), matricula: mat || null, box, media: isNaN(media) ? null : media };
    });
    if (Object.keys(itens).length) return { aba: nome, itens };
  }
  throw new Error("Não encontrei colunas Nome e 9-Box em nenhuma aba da planilha.");
}

/* painel na tela Ciclo */
async function painelHistorico() {
  const hist = (await DB.list("historico")).sort((a, b) => b.id.localeCompare(a.id));
  const ano = new Date().getFullYear();
  return `<div class="panel"><h2>Histórico de 9-Box</h2><p class="desc">Para comparar a evolução com ciclos anteriores ao sistema, importe a planilha de calibração daquele ciclo (colunas Nome e 9-Box calibrada). Ciclos feitos no sistema entram na comparação automaticamente. Sem matrícula na planilha, a ligação é feita pelo nome completo.</p>
    ${hist.length ? `<table style="margin-bottom:14px"><tbody>${hist.map((h) => `<tr><td><b>${esc(h.rotulo)}</b></td><td>${Object.keys(h.itens || {}).length} pessoas · ${esc(h.arquivo || "")}</td><td class="num"><button class="btn btn-mini btn-danger" data-hdel="${h.id}">Excluir</button></td></tr>`).join("")}</tbody></table>` : ""}
    <div class="form-grid"><div class="fld"><label>Semestre</label><select id="h-sem"><option value="06">Junho</option><option value="12">Dezembro</option></select></div>
      <div class="fld"><label>Ano</label><input id="h-ano" type="number" value="${ano}"></div>
      <div class="fld" style="grid-column:span 2"><label>Planilha de calibração</label><input type="file" id="h-arq" accept=".xlsx,.xls"></div></div>
    <div id="h-res"></div></div>`;
}
function ligarHistorico() {
  $$("[data-hdel]").forEach((b) => (b.onclick = async () => { if (await confirmar("Excluir histórico", "Este ciclo deixará de ser usado na comparação.", "Excluir", true)) { await DB.del("historico", b.dataset.hdel); ir("ciclos"); } }));
  const arq = $("#h-arq"); if (!arq) return;
  arq.onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; const box = $("#h-res");
    try {
      const r = lerHistorico9Box(await f.arrayBuffer());
      const funcs = await carregarFuncs(); const nomes = new Set(Object.values(funcs).map((x) => norm(x.nome)));
      const itens = Object.values(r.itens); const lig = itens.filter((i) => (i.matricula && funcs[i.matricula]) || nomes.has(norm(i.nome))).length;
      const sem = $("#h-sem").value, ano = $("#h-ano").value; const id = `${ano}-${sem}`, rotulo = `${sem === "06" ? "Jun" : "Dez"}/${ano}`;
      box.innerHTML = `<div class="note"><b>${itens.length}</b> pessoas lidas na aba "${esc(r.aba)}"; <b>${lig}</b> ligadas a funcionários da base atual. Será gravado como <b>${rotulo}</b>.</div><div class="btn-row"><button class="btn btn-primary" id="h-ok">Importar histórico</button></div>`;
      $("#h-ok").onclick = (ev) => comBotao(ev.currentTarget, async () => {
        if (S.ciclo && id >= S.ciclo.id) return toast("O histórico precisa ser de um ciclo anterior ao atual.", true);
        await DB.set("historico", id, { rotulo, itens: r.itens, arquivo: f.name, importadoEm: agoraISO(), por: S.me.matricula });
        await auditar("importar_historico", id); toast(`Histórico ${rotulo} importado. Recalcule as notas para atualizar a comparação.`); ir("ciclos");
      });
    } catch (er) { box.innerHTML = `<div class="note bad">${esc(erroAmigavel(er))}</div>`; }
  };
}

/* painel de evolução no Painel e 9-Box */
function painelEvolucao(lista) {
  const com = lista.filter((r) => r.anterior && movDe(r));
  if (!com.length) return `<div class="panel"><h2>Evolução</h2><p class="desc" style="border:0;margin:0;padding:0">Sem ciclo anterior para comparar. Importe o histórico de 9-Box em <button class="btn-link" onclick="ir('ciclos')">Ciclo</button> ou aguarde o próximo ciclo.</p></div>`;
  const n = (m) => com.filter((r) => movDe(r) === m).length;
  const rot = com[0].anterior.rotulo;
  const reinc = com.filter((r) => movDe(r) === "reincidente");
  const cairamPA = com.filter((r) => movDe(r) === "caiu" && norm(r.boxCal || r.boxCalc) === norm("Ponto de Atenção"));
  const nomes = (l) => l.map((r) => `<tr class="click" data-dos="${r.id}"><td><b>${esc(titulo(r.nome))}</b><span class="sub">${esc(r.cargo)} · ${esc(r.depto)}</span></td><td>${esc(r.anterior.box)} → ${esc(r.boxCal || r.boxCalc)}</td></tr>`).join("");
  return `<div class="panel"><h2>Evolução em relação a ${esc(rot)}</h2><p class="desc">${com.length} pessoas com histórico; ${lista.length - com.length} sem 9-Box no ciclo anterior.</p>
    <div class="kpis">${kpi("Evoluíram", n("subiu"), `${pct(n("subiu"), com.length)}%`)}${kpi("Mantiveram", n("manteve"), `${pct(n("manteve"), com.length)}%`)}${kpi("Caíram", n("caiu"), `${pct(n("caiu"), com.length)}%`)}${kpi("Ponto de Atenção pelo 2º ciclo", reinc.length)}</div>
    ${reinc.length || cairamPA.length ? `<div class="grid2">${reinc.length ? `<div><div class="grp-title" style="margin-top:0">Ponto de Atenção pelo 2º ciclo</div><table><tbody>${nomes(reinc)}</tbody></table></div>` : ""}${cairamPA.length ? `<div><div class="grp-title" style="margin-top:0">Caíram para Ponto de Atenção</div><table><tbody>${nomes(cairamPA)}</tbody></table></div>` : ""}</div>` : ""}</div>`;
}

/* ---------- avaliadores fora da curva ---------- */
function avaliadoresForaDaCurva(avs) {
  const env = avs.filter((a) => a.status === "enviada" && a.papel === "lider");
  const media = (a) => avg(Object.values(a.notas || {}).filter((v) => typeof v === "number"));
  const todas = env.map(media).filter((v) => v != null);
  const geral = avg(todas);
  const por = {};
  env.forEach((a) => { const m = media(a); if (m == null) return; (por[a.avaliador] = por[a.avaliador] || { mat: a.avaliador, nome: a.avaliadorNome, ms: [] }).ms.push(m); });
  return { geral, lista: Object.values(por).filter((x) => x.ms.length >= 3).map((x) => {
    const m = avg(x.ms); const acima = x.ms.filter((v) => faixa(v) === "Acima").length, abaixo = x.ms.filter((v) => faixa(v) === "Abaixo").length;
    const dp = Math.sqrt(avg(x.ms.map((v) => (v - m) ** 2)));
    const motivos = [];
    if (m - geral >= 0.5) motivos.push(`Média ${fmtN(m)}, bem acima da empresa`);
    if (geral - m >= 0.5) motivos.push(`Média ${fmtN(m)}, bem abaixo da empresa`);
    if (acima / x.ms.length >= 0.8) motivos.push(`${pct(acima, x.ms.length)}% da equipe como Acima`);
    if (abaixo / x.ms.length >= 0.8) motivos.push(`${pct(abaixo, x.ms.length)}% da equipe como Abaixo`);
    if (x.ms.length >= 4 && dp < 0.15) motivos.push("Notas praticamente iguais para todos");
    return { ...x, n: x.ms.length, media: m, acima, abaixo, motivos };
  }).filter((x) => x.motivos.length).sort((a, b) => Math.abs(b.media - geral) - Math.abs(a.media - geral)) };
}
function painelForaDaCurva(avs) {
  const { geral, lista } = avaliadoresForaDaCurva(avs);
  if (geral == null) return "";
  return `<div class="panel"><h2>Avaliadores fora da curva</h2><p class="desc">Líderes com 3 ou mais avaliações enviadas cuja régua se afasta da empresa (média geral das avaliações de líder: <b>${fmtN(geral)}</b>). Vale uma conversa antes da calibração.</p>
    ${lista.length ? `<div class="table-wrap" style="max-height:360px"><table><thead><tr><th>Avaliador</th><th class="num">Avaliados</th><th class="num">Média dada</th><th>Por quê</th></tr></thead><tbody>${lista.map((x) => `<tr><td><b>${esc(titulo(x.nome))}</b><span class="sub">${x.mat}</span></td><td class="num">${x.n}</td><td class="num">${fmtN(x.media)}</td><td style="white-space:normal">${x.motivos.map((m) => `<span class="pill p-warn" style="margin:2px 4px 2px 0">${esc(m)}</span>`).join("")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="note" style="margin:0">Nenhum avaliador fora da curva até agora.</p>'}</div>`;
}

/* ---------- prazo e cobrança ---------- */
function prazoTxt(c) {
  if (!c || !c.prazo) return "";
  const d = diasAte(c.prazo);
  return d < 0 ? `Prazo encerrado em ${fmtData(c.prazo)}` : d === 0 ? `O prazo termina hoje (${fmtData(c.prazo)})` : `Prazo: ${fmtData(c.prazo)} · faltam ${d} dia${d > 1 ? "s" : ""}`;
}
const MSG_PADRAO = "Olá, {nome}! Você ainda tem {pendentes} avaliação(ões) de desempenho para responder no ciclo {ciclo}. {prazo}Acesse {link} e entre com seu CPF (só números) no usuário e na senha; líderes e gestores usam matrícula e senha. Obrigado!";
function linkSistema() { return location.href.split("#")[0].split("?")[0]; }
function montarMsg(modelo, x, c) {
  return modelo.replace(/\{nome\}/g, titulo(x.nome).split(" ")[0]).replace(/\{pendentes\}/g, x.total - x.env).replace(/\{ciclo\}/g, c.rotulo)
    .replace(/\{prazo\}/g, c.prazo ? `O prazo é ${fmtData(c.prazo)}. ` : "").replace(/\{link\}/g, linkSistema());
}
async function copiar(txt, el) {
  try { await navigator.clipboard.writeText(txt); toast("Mensagem copiada."); }
  catch (e) { if (el) { el.focus(); el.select(); } toast("Selecione o texto e copie (Ctrl+C).", true); }
}
function modalMensagem(titulo_, txt) {
  const m = modal(`<h3>${esc(titulo_)}</h3><textarea id="msg-t" rows="7">${esc(txt)}</textarea>
    <div class="btn-row"><button class="btn btn-primary" id="msg-c">Copiar</button><a class="btn btn-leaf" id="msg-w" target="_blank" rel="noopener" href="#">Abrir no WhatsApp</a><button class="btn btn-ghost" onclick="fecharModal()">Fechar</button></div>
    <p class="hint">O WhatsApp abre com a mensagem pronta; escolha o contato ou o grupo.</p>`);
  const upd = () => ($("#msg-w", m).href = "https://wa.me/?text=" + encodeURIComponent($("#msg-t", m).value));
  $("#msg-t", m).oninput = upd; upd();
  $("#msg-c", m).onclick = () => copiar($("#msg-t", m).value, $("#msg-t", m));
}
function painelCobranca(porAv, c) {
  const pend = Object.values(porAv).filter((x) => x.env < x.total);
  return `<div class="panel"><h2>Cobrança</h2><p class="desc">${c.prazo ? esc(prazoTxt(c)) + "." : "Defina o prazo de respostas na tela Ciclo."} ${pend.length} avaliadores com pendência. Edite o modelo; <code>{nome}</code>, <code>{pendentes}</code>, <code>{ciclo}</code>, <code>{prazo}</code> e <code>{link}</code> são trocados automaticamente.</p>
    <div class="fld"><label>Modelo da mensagem</label><textarea id="cb-mod" rows="3">${esc(localGet("cb-modelo") || MSG_PADRAO)}</textarea></div>
    <div class="btn-row"><button class="btn btn-ghost" id="cb-grupo" ${pend.length ? "" : "disabled"}>Mensagem para o grupo de líderes</button><span class="hint">No quadro "Por avaliador", use o botão Mensagem de cada pessoa.</span></div></div>`;
}
function localGet(k) { try { return localStorage.getItem("aval_" + k); } catch (e) { return null; } }
function localSet(k, v) { try { localStorage.setItem("aval_" + k, v); } catch (e) { /* ignora */ } }

/* ---------- importação de ocorrências ---------- */
let pdfjsPronto = null;
function carregarPdfJs() {
  if (!pdfjsPronto) pdfjsPronto = new Promise((ok, err) => {
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; ok(); };
    s.onerror = () => err(new Error("Não foi possível carregar o leitor de PDF."));
    document.head.appendChild(s);
  });
  return pdfjsPronto;
}
async function textoDoPdf(buf) {
  await carregarPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise; let txt = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const ct = await (await pdf.getPage(p)).getTextContent(); let lastY = null;
    ct.items.forEach((it) => { if (lastY !== null && Math.abs(it.transform[5] - lastY) > 2) txt += "\n"; else if (lastY !== null) txt += " "; txt += it.str; lastY = it.transform[5]; });
    txt += "\n";
  }
  return txt;
}
const RX_DATA = /(\d{2})\/(\d{2})\/(\d{4})/;
const dataDe = (s) => { const m = String(s).match(RX_DATA); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
/* relatório de texto (PDF): blocos por colaborador "código - NOME" e linhas de ocorrência */
function ocorrenciasDoTexto(txt, modo) {
  const out = []; let cur = null, ultData = null;
  const rCol = /^\s*(\d{3,7})\s*-\s*([A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ][A-ZÁÉÍÓÚÀÂÊÔÃÕÇÜ' ]{3,}?)\s*(?:\(|$)/;
  txt.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
    const m = l.match(rCol);
    if (m) { cur = { cod: m[1], nome: m[2].trim() }; ultData = null; return; }
    const d = dataDe(l); if (d) ultData = d;
    if (!cur) return;
    let tipo = null;
    if (modo === "faltas") { if (/FALTA\s+INTEGRAL/i.test(l)) tipo = "falta"; }
    else if (/suspens/i.test(l)) tipo = "suspensao";
    else if (/advert[eê]n/i.test(l)) tipo = "advertencia";
    if (tipo) out.push({ cod: cur.cod, nome: cur.nome, tipo, data: d || ultData, origem: l.slice(0, 80) });
  });
  return out;
}
function ocorrenciasDaPlanilha(buf, modo) {
  const wb = XLSX.read(buf, { type: "array" }); const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
  const hi = rows.findIndex((r) => r.some((x) => /^(MATRICULA|CHAPA|NOME|COLABORADOR|FUNCIONARIO)/.test(norm(x))) && r.some((x) => /DATA/.test(norm(x))));
  if (hi < 0) throw new Error("A planilha precisa ter colunas de matrícula ou nome e de data.");
  const H = rows[hi].map(norm); const f = (re) => H.findIndex((h) => re.test(h));
  const iM = f(/^(MATRICULA|CHAPA)/), iN = f(/^(NOME|COLABORADOR|FUNCIONARIO)/), iD = f(/DATA/), iT = f(/TIPO|OCORRENCIA|ANOTACAO|TITULO|MOTIVO|EVENTO/);
  const out = [];
  rows.slice(hi + 1).forEach((r) => {
    const nome = iN >= 0 ? String(r[iN]).trim() : ""; const cod = iM >= 0 ? String(r[iM]).trim() : "";
    if (!nome && !cod) return;
    const t = norm(iT >= 0 ? r[iT] : "");
    const tipo = /SUSPENS/.test(t) ? "suspensao" : /ADVERT/.test(t) ? "advertencia" : /AFAST/.test(t) ? "afastamento" : /FALTA/.test(t) ? "falta" : modo === "faltas" ? "falta" : "advertencia";
    if (modo === "faltas" && t && !/FALTA/.test(t)) return;
    out.push({ cod, nome, tipo, data: parseData(r[iD]), origem: t.slice(0, 60) });
  });
  return out;
}
function ligarFuncionario(o, funcs) {
  const porNome = {}; Object.values(funcs).forEach((f) => (porNome[norm(f.nome)] = f));
  if (o.cod && o.cod.replace(/\D/g, "").length >= 6) { const f = funcs[padMat(o.cod)]; if (f) return f; }
  return porNome[norm(o.nome)] || null;
}
function painelImportOcorrencias() {
  return `<div class="panel"><h2>Importar do relatório da folha</h2><p class="desc">Envie o relatório em PDF ou Excel. O sistema lê cada ocorrência, liga ao funcionário pela matrícula ou pelo nome e mostra uma prévia: confira as datas antes de importar. Ocorrências já lançadas não são duplicadas.</p>
    <div class="form-grid"><div class="fld"><label>Tipo de relatório</label><select id="oi-modo"><option value="anotacoes">Anotações (advertências e suspensões)</option><option value="faltas">Ocorrências (faltas integrais)</option></select></div>
      <div class="fld" style="grid-column:span 2"><label>Arquivo</label><input type="file" id="oi-arq" accept=".pdf,.xlsx,.xls"></div></div>
    <div id="oi-res"></div></div>`;
}
function ligarImportOcorrencias(ocsExist) {
  $("#oi-arq").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return; const box = $("#oi-res"); const modo = $("#oi-modo").value;
    box.innerHTML = `<p class="hint"><span class="spin"></span> Lendo ${esc(file.name)}…</p>`;
    try {
      const buf = await file.arrayBuffer();
      const lidas = /\.pdf$/i.test(file.name) ? ocorrenciasDoTexto(await textoDoPdf(buf), modo) : ocorrenciasDaPlanilha(buf, modo);
      if (!lidas.length) throw new Error("Nenhuma ocorrência encontrada no arquivo. Confira se escolheu o tipo de relatório certo.");
      const funcs = await carregarFuncs();
      const chave = (m, t, d) => `${m}|${t}|${d}`;
      const ja = new Set(ocsExist.map((o) => chave(o.matricula, o.tipo, o.data)));
      const vistos = new Set();
      const itens = lidas.map((o) => { const f = ligarFuncionario(o, funcs); return { ...o, mat: f ? f.matricula : null, nomeBase: f ? f.nome : null }; }).filter((o) => { const k = chave(o.mat || o.nome, o.tipo, o.data); if (vistos.has(k)) return false; vistos.add(k); return true; });
      const st = (o) => (!o.mat ? ["p-bad", "Funcionário não encontrado"] : ja.has(chave(o.mat, o.tipo, o.data)) ? ["p-neutral", "Já lançada"] : !o.data ? ["p-warn", "Informe a data"] : ["p-ok", "Nova"]);
      box.innerHTML = `<div class="note">${itens.length} ocorrências lidas: ${itens.filter((o) => st(o)[1] === "Nova").length} novas, ${itens.filter((o) => !o.mat).length} sem funcionário, ${itens.filter((o) => o.mat && !o.data).length} sem data.</div>
        <div class="table-wrap" style="max-height:380px"><table><thead><tr><th></th><th>No relatório</th><th>Funcionário</th><th>Tipo</th><th>Data</th><th>Situação</th></tr></thead><tbody>
        ${itens.map((o, i) => { const s = st(o); const pode = o.mat && s[1] !== "Já lançada"; return `<tr><td><input type="checkbox" data-i="${i}" ${pode && o.data ? "checked" : ""} ${pode ? "" : "disabled"}></td><td>${esc(o.cod)} ${esc(o.nome)}</td><td>${o.mat ? `<b>${esc(titulo(o.nomeBase))}</b><span class="sub">${o.mat}</span>` : "—"}</td><td>${TIPOS_OC[o.tipo]}</td><td><input type="date" data-d="${i}" value="${o.data || ""}" ${pode ? "" : "disabled"} style="width:150px"></td><td><span class="pill ${s[0]}">${s[1]}</span></td></tr>`; }).join("")}</tbody></table></div>
        <div class="btn-row"><button class="btn btn-primary" id="oi-ok">Importar selecionadas</button><button class="btn btn-ghost" id="oi-x">Cancelar</button></div>`;
      $("#oi-x").onclick = () => { box.innerHTML = ""; e.target.value = ""; };
      $("#oi-ok").onclick = (ev) => comBotao(ev.currentTarget, async () => {
        const sel = $$("#oi-res input[data-i]:checked").map((c) => { const o = itens[+c.dataset.i]; return { ...o, data: $(`#oi-res input[data-d="${c.dataset.i}"]`).value }; });
        if (sel.some((o) => !o.data)) return toast("Há ocorrências selecionadas sem data.", true);
        const novas = sel.filter((o) => !ja.has(chave(o.mat, o.tipo, o.data)));
        if (!novas.length) return toast("Nada novo para importar.", true);
        await DB.batch(novas.map((o) => ({ col: "ocorrencias", id: "imp" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), data: { matricula: o.mat, tipo: o.tipo, data: o.data, dataFim: null, obs: `Importado de ${file.name}`, por: S.me.matricula, em: agoraISO() } })));
        await auditar("importar_ocorrencias", `${novas.length} de ${file.name}`); toast(`${novas.length} ocorrências importadas.`); ir("ocorrencias");
      });
    } catch (er) { box.innerHTML = `<div class="note bad">${esc(erroAmigavel(er))}</div>`; }
  };
}

/* ---------- datas de cargo e reajuste ---------- */
function painelDatas() {
  return `<div class="panel"><h2>Datas de cargo e reajuste</h2><p class="desc">Usadas para bloquear o mérito de quem tem menos de 6 meses no cargo atual ou recebeu reajuste nos últimos 6 meses. Envie uma planilha com a matrícula (Chapa) e as colunas de data no cargo e/ou data do último reajuste, ou ajuste pessoa a pessoa clicando no funcionário. Os aprovados no Comitê recebem a data do reajuste automaticamente ao encerrar o ciclo.</p>
    <input type="file" id="dt-arq" accept=".xlsx,.xls"><div id="dt-res"></div></div>`;
}
function ligarDatas() {
  $("#dt-arq").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return; const box = $("#dt-res");
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }); const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
      const hi = rows.findIndex((r) => r.some((x) => /^(MATRICULA|CHAPA)/.test(norm(x))));
      if (hi < 0) throw new Error("Não encontrei a coluna de matrícula (Chapa).");
      const H = rows[hi].map(norm);
      const iM = H.findIndex((h) => /^(MATRICULA|CHAPA)/.test(h));
      const iC = H.findIndex((h) => /CARGO/.test(h) && /(DATA|DT|DESDE|INICIO|ENTRADA|PROMOCAO)/.test(h));
      const iR = H.findIndex((h) => /(REAJUSTE|AUMENTO|ALTERACAO SALARIAL|ULTIMO AJUSTE|MERITO)/.test(h));
      if (iC < 0 && iR < 0) throw new Error("Não encontrei colunas de data no cargo nem de último reajuste.");
      const funcs = await carregarFuncs(); const ops = []; let fora = 0;
      rows.slice(hi + 1).forEach((r) => {
        const m = padMat(r[iM]); if (!m) return; if (!funcs[m]) { fora++; return; }
        const d = {}; if (iC >= 0 && parseData(r[iC])) d.dataCargo = parseData(r[iC]); if (iR >= 0 && parseData(r[iR])) d.ultimoReajuste = parseData(r[iR]);
        if (Object.keys(d).length) ops.push({ op: "update", col: "funcionarios", id: m, data: d });
      });
      box.innerHTML = `<div class="note">${ops.length} funcionários com datas para atualizar${fora ? `; ${fora} matrículas não estão na base` : ""}. Colunas usadas: ${iC >= 0 ? `"${esc(rows[hi][iC])}"` : ""} ${iR >= 0 ? `"${esc(rows[hi][iR])}"` : ""}</div><div class="btn-row"><button class="btn btn-primary" id="dt-ok">Atualizar datas</button></div>`;
      $("#dt-ok").onclick = (ev) => comBotao(ev.currentTarget, async () => { await DB.batch(ops); await auditar("importar_datas", `${ops.length}`); invalidar("func"); toast("Datas atualizadas. Recalcule as notas do ciclo para refletir na calibração."); ir("funcionarios"); });
    } catch (er) { box.innerHTML = `<div class="note bad">${esc(erroAmigavel(er))}</div>`; }
  };
}
