/* ============================================================
   TELAS DO RH — ciclo, base, ocorrências, elegibilidade,
   avaliadores, questionários, acessos e acompanhamento
   ============================================================ */
"use strict";

/* ================= CICLO ================= */
function datasDoCiclo(sem, ano) {
  ano = +ano;
  return sem === "06"
    ? { id: `${ano}-06`, rotulo: `Jun/${ano}`, corte: `${ano - 1}-12-31`, periodoIni: `${ano}-01-01`, periodoFim: `${ano}-06-30` }
    : { id: `${ano}-12`, rotulo: `Dez/${ano}`, corte: `${ano}-06-30`, periodoIni: `${ano}-07-01`, periodoFim: `${ano}-12-31` };
}

PAGES.ciclos = async (el) => {
  const c = S.ciclo;
  const todos = (await DB.list("ciclos")).sort((a, b) => b.id.localeCompare(a.id));
  let html = `<div class="page">${cabecalho("Gestão do ciclo", "Ciclo de avaliação", "Abra o ciclo semestral e avance as etapas. Cada etapa libera as telas correspondentes para avaliadores, N2 e Diretoria.")}`;

  if (c) {
    const funcs = await carregarFuncs(); await carregarDeptos();
    const eleg = await DB.get("elegibilidade", c.id);
    const avs = c.etapa !== "preparacao" ? await DB.list("avaliacoes", [["ciclo", "==", c.id]]) : [];
    const nBase = Object.values(funcs).filter((f) => f.naBase !== false).length;
    const nEleg = eleg && eleg.congelada ? Object.values(eleg.lista).filter((x) => x.elegivel).length : 0;
    const semAval = eleg && eleg.congelada ? Object.keys(eleg.lista).filter((m) => eleg.lista[m].elegivel && funcs[m] && !avaliadorDireto(funcs[m])).length : null;
    const enviadas = avs.filter((a) => a.status === "enviada").length;
    const ck = (ok, t, link) => `<li style="margin:6px 0">${ok ? '<span class="pill p-ok">ok</span>' : '<span class="pill p-warn">pendente</span>'} ${t} ${link ? `<button class="btn-link" onclick="ir('${link}')">abrir</button>` : ""}</li>`;
    html += `<div class="panel"><h2>Ciclo ${esc(c.rotulo)}</h2>
      <p class="desc">Admissão até <b>${fmtData(c.corte)}</b> · Ocorrências contadas de <b>${fmtData(c.periodoIni)}</b> a <b>${fmtData(c.periodoFim)}</b></p>
      ${stepperHTML(c.etapa)}`;
    if (c.etapa === "preparacao") {
      html += `<ul style="list-style:none;padding:0;margin:16px 0 0;font-size:13.5px">
        ${ck(nBase > 0, `Base de funcionários importada (${nBase} pessoas)`, "funcionarios")}
        ${ck(true, "Ocorrências lançadas (faltas, advertências e afastamentos)", "ocorrencias")}
        ${ck(eleg && eleg.congelada, eleg && eleg.congelada ? `Lista de elegíveis congelada (${nEleg} elegíveis)` : "Lista de elegíveis congelada", "elegibilidade")}
        ${ck(semAval === 0, semAval == null ? "Avaliadores definidos para todos os elegíveis" : semAval ? `${semAval} elegíveis ainda sem avaliador direto` : "Todos os elegíveis têm avaliador direto", "avaliadores")}
      </ul>
<div class="form-grid" style="margin-top:16px;max-width:520px"><div class="fld"><label>Prazo para respostas</label><input type="date" id="c-prazo" value="${c.prazo || ""}"></div><div class="fld"><label>&nbsp;</label><span class="hint">${esc(prazoTxt(c)) || "Aparece para os avaliadores e na mensagem de cobrança."}</span></div></div>
      <div class="btn-row"><button class="btn btn-primary" id="bt-gerar" ${eleg && eleg.congelada && semAval === 0 ? "" : "disabled"}>Gerar avaliações e abrir respostas</button></div>
      <p class="hint">O sistema cria uma avaliação para cada par avaliador × avaliado: líder direto para todos, liderados para a liderança e todos os outros gestores para os gestores.</p>`;
    } else if (c.etapa === "avaliacao") {
      html += `<div class="kpis" style="margin-top:16px">${kpi("Avaliações enviadas", `${enviadas}/${avs.length}`, `${pct(enviadas, avs.length)}% de adesão`, pct(enviadas, avs.length))}</div><div class="form-grid" style="margin-top:16px;max-width:520px"><div class="fld"><label>Prazo para respostas</label><input type="date" id="c-prazo" value="${c.prazo || ""}"></div><div class="fld"><label>&nbsp;</label><span class="hint">${esc(prazoTxt(c)) || "Aparece para os avaliadores e na mensagem de cobrança."}</span></div></div>
      <div class="btn-row"><button class="btn btn-ghost" onclick="ir('acompanhamento')">Ver acompanhamento</button>
      <button class="btn btn-ghost" id="bt-regerar">Atualizar lista de avaliações</button>
      <button class="btn btn-primary" id="bt-calc">Encerrar respostas e calcular resultados</button></div>
      <p class="hint">"Atualizar lista" cria avaliações que faltam (por exemplo, após trocar um avaliador) e remove as que ainda não foram iniciadas e deixaram de valer. Respostas já enviadas são mantidas.</p>`;
    } else if (c.etapa === "calibracao") {
      const res = await DB.list("resultados", [["ciclo", "==", c.id]]);
      const val = res.filter((r) => r.validadoN2).length;
      html += `<div class="kpis" style="margin-top:16px">${kpi("Calibrações validadas pelo N2", `${val}/${res.length}`, "", pct(val, res.length))}</div>
      <div class="btn-row"><button class="btn btn-ghost" onclick="ir('calibracao')">Abrir calibração</button>
      <button class="btn btn-ghost" id="bt-recalc">Recalcular notas</button>
      <button class="btn btn-primary" id="bt-avancar">Enviar ao Comitê</button></div>
      <p class="hint">Recalcular mantém os reposicionamentos e justificativas já feitos pelo N2.</p>`;
    } else if (c.etapa === "comite") {
      html += `<div class="btn-row"><button class="btn btn-ghost" onclick="ir('comite')">Abrir Comitê</button><button class="btn btn-ghost" onclick="ir('cartas')">Cartas</button>
      <button class="btn btn-primary" id="bt-avancar">Encerrar ciclo</button></div>`;
    } else {
      html += `<p class="note">Ciclo encerrado. Resultados, Comitê e cartas continuam disponíveis para consulta.</p>`;
    }
    if (c.etapa !== "preparacao") html += `<div class="btn-row"><button class="btn btn-mini btn-ghost" id="bt-voltar">Voltar uma etapa</button></div>`;
    html += `</div>`;
  } else {
    html += `<div class="note">Nenhum ciclo aberto. Crie o ciclo abaixo para começar.</div>`;
  }

  if (!c || c.etapa === "encerrado") {
    const ano = new Date().getFullYear(), mes = new Date().getMonth() + 1;
    html += `<div class="panel"><h2>Abrir novo ciclo</h2><p class="desc">As datas são preenchidas pela regra: junho exige admissão até 31/12 do ano anterior; dezembro, até 30/06.</p>
      <div class="form-grid">
        <div class="fld"><label>Semestre</label><select id="n-sem"><option value="06" ${mes <= 6 ? "selected" : ""}>Junho</option><option value="12" ${mes > 6 ? "selected" : ""}>Dezembro</option></select></div>
        <div class="fld"><label>Ano</label><input id="n-ano" type="number" value="${ano}"></div>
        <div class="fld"><label>Admitidos até</label><input id="n-corte" type="date"></div>
        <div class="fld"><label>Ocorrências de</label><input id="n-ini" type="date"></div>
        <div class="fld"><label>até</label><input id="n-fim" type="date"></div>
      </div>
      <div class="btn-row"><button class="btn btn-primary" id="bt-novo">Abrir ciclo</button></div></div>`;
  }
  if (ehRH()) html += await painelHistorico();
  if (todos.length) {
    html += `<div class="panel"><h2>Histórico</h2><div class="table-wrap"><table><thead><tr><th>Ciclo</th><th>Etapa</th><th>Admissão até</th><th>Período</th><th></th></tr></thead><tbody>
      ${todos.map((x) => `<tr><td><b>${esc(x.rotulo)}</b></td><td><span class="pill ${x.etapa === "encerrado" ? "p-neutral" : "p-ok"}">${ETAPAS.find((e) => e.id === x.etapa).t}</span></td><td>${fmtData(x.corte)}</td><td>${fmtData(x.periodoIni)} a ${fmtData(x.periodoFim)}</td>
      <td style="white-space:nowrap">${S.cfg.cicloAtivo === x.id ? '<span class="pill p-verde">ativo</span>' : x.etapa === "encerrado" && (!c || c.etapa === "encerrado") ? `<button class="btn btn-mini btn-ghost" data-ativar="${x.id}">Consultar</button>` : ""}
        ${ehRH() ? ` <button class="btn btn-mini btn-danger" data-excluir="${x.id}">Excluir</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div></div>`;
  }
  el.innerHTML = html + `</div>`;

  /* ações */
  const preencher = () => { const d = datasDoCiclo($("#n-sem").value, $("#n-ano").value); $("#n-corte").value = d.corte; $("#n-ini").value = d.periodoIni; $("#n-fim").value = d.periodoFim; };
  if ($("#n-sem")) { preencher(); $("#n-sem").onchange = preencher; $("#n-ano").oninput = preencher; }
  $("#bt-novo") && ($("#bt-novo").onclick = (e) => comBotao(e.currentTarget, async () => {
    const d = datasDoCiclo($("#n-sem").value, $("#n-ano").value);
    if (await DB.get("ciclos", d.id)) return toast(`O ciclo ${d.rotulo} já existe.`, true);
    Object.assign(d, { corte: $("#n-corte").value, periodoIni: $("#n-ini").value, periodoFim: $("#n-fim").value, etapa: "preparacao", criadoEm: agoraISO(), criadoPor: S.me.matricula });
    await DB.set("ciclos", d.id, d);
    await DB.update("config", "geral", { cicloAtivo: d.id });
    await auditar("abrir_ciclo", d.id);
    await recarregarCiclo(); toast(`Ciclo ${d.rotulo} aberto.`); ir("ciclos");
  }));
  $$("[data-ativar]").forEach((b) => (b.onclick = async () => { await DB.update("config", "geral", { cicloAtivo: b.dataset.ativar }); await recarregarCiclo(); ir("ciclos"); }));
  ligarHistorico();
  $$("[data-excluir]").forEach((b) => (b.onclick = () => excluirCiclo(todos.find((x) => x.id === b.dataset.excluir))));
  $("#c-prazo") && ($("#c-prazo").onchange = async (e) => { await DB.update("ciclos", c.id, { prazo: e.target.value || null }); await recarregarCiclo(); toast("Prazo salvo."); ir("ciclos"); });
  const mudarEtapa = async (nova) => { await DB.update("ciclos", c.id, { etapa: nova, [`etapaEm_${nova}`]: agoraISO() }); await auditar("etapa", `${c.id} → ${nova}`); await recarregarCiclo(); };
  $("#bt-gerar") && ($("#bt-gerar").onclick = (e) => comBotao(e.currentTarget, async () => {
    const r = await gerarAvaliacoes(); if (!r) return;
    await mudarEtapa("avaliacao");
    toast(`${r.criadas} avaliações criadas. Respostas abertas.`); ir("ciclos");
  }));
  $("#bt-regerar") && ($("#bt-regerar").onclick = (e) => comBotao(e.currentTarget, async () => {
    const r = await gerarAvaliacoes(); if (r) { toast(`${r.criadas} criadas, ${r.removidas} removidas.`); ir("ciclos"); }
  }));
  $("#bt-calc") && ($("#bt-calc").onclick = async (e) => {
    const btn = e.currentTarget;
    const avs = await DB.list("avaliacoes", [["ciclo", "==", c.id]]);
    const pend = avs.filter((a) => a.status !== "enviada").length;
    if (!(await confirmar("Encerrar respostas", `${pend ? `<b>${pend} avaliações não foram enviadas</b> e não entrarão no cálculo.<br><br>` : ""}Os avaliadores não poderão mais responder. As notas serão calculadas e a calibração será liberada para os N2.`, "Encerrar e calcular"))) return;
    comBotao(btn, async () => { const n = await calcularResultados(); await mudarEtapa("calibracao"); toast(`Resultados calculados para ${n} pessoas.`); ir("ciclos"); });
  });
  $("#bt-recalc") && ($("#bt-recalc").onclick = (e) => comBotao(e.currentTarget, async () => { const n = await calcularResultados(); toast(`Notas recalculadas (${n}).`); ir("ciclos"); }));
  $("#bt-avancar") && ($("#bt-avancar").onclick = async () => {
    const i = ETAPAS.findIndex((x) => x.id === c.etapa);
    const prox = ETAPAS[i + 1].id;
    if (!(await confirmar("Avançar etapa", `Avançar o ciclo ${esc(c.rotulo)} para <b>${ETAPAS[i + 1].t}</b>?${prox === "encerrado" ? `<br><br>Os aprovados no Comitê terão o último reajuste registrado em <b>${fmtData(vigenciaMerito(c))}</b> (usado no bloqueio de 6 meses dos próximos ciclos).` : ""}`))) return;
    if (prox === "encerrado") {
      const apr = (await DB.list("resultados", [["ciclo", "==", c.id]])).filter((r) => r.decisao === "Aprovado");
      const vig = vigenciaMerito(c);
      await DB.batch(apr.map((r) => ({ op: "update", col: "funcionarios", id: r.matricula, data: { ultimoReajuste: vig, ...(r.projecao && r.projecao.efetivacao ? { dataCargo: vig } : {}) } })));
      invalidar("func");
    }
    await mudarEtapa(prox); ir("ciclos");
  });
  $("#bt-voltar") && ($("#bt-voltar").onclick = async () => {
    const i = ETAPAS.findIndex((x) => x.id === c.etapa);
    if (!(await confirmar("Voltar etapa", `Voltar o ciclo para <b>${ETAPAS[i - 1].t}</b>? ${ETAPAS[i - 1].id === "avaliacao" ? "Os avaliadores poderão responder de novo." : ""}`, "Voltar"))) return;
    await mudarEtapa(ETAPAS[i - 1].id); ir("ciclos");
  });
};

/* -------- exclusão de ciclo (testes ou ciclo aberto por engano) -------- */
async function excluirCiclo(x) {
  if (!x) return;
  const [avs, res] = await Promise.all([DB.list("avaliacoes", [["ciclo", "==", x.id]]), DB.list("resultados", [["ciclo", "==", x.id]])]);
  const m = modal(`<h3>Excluir o ciclo ${esc(x.rotulo)}</h3>
    <p style="margin-top:0">Serão apagados de forma definitiva: o ciclo, a lista de elegibilidade, <b>${avs.length} avaliações</b> (com as respostas) e <b>${res.length} resultados</b> (calibração, Comitê e cartas).</p>
    <p>A base de funcionários, as ocorrências, os avaliadores, os questionários, os acessos e a tabela salarial <b>não</b> são afetados.</p>
    ${x.etapa === "encerrado" ? `<p class="note bad">Este ciclo já foi encerrado. A data do último reajuste gravada nos aprovados não é desfeita; corrija em Funcionários, se for o caso.</p>` : ""}
    <div class="fld"><label>Para confirmar, digite EXCLUIR</label><input id="ex-conf" autocomplete="off"></div>
    <div class="btn-row"><button class="btn btn-danger" id="ex-ok" disabled>Excluir ciclo</button><button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>`);
  $("#ex-conf", m).oninput = (e) => ($("#ex-ok", m).disabled = e.target.value.trim().toUpperCase() !== "EXCLUIR");
  $("#ex-ok", m).onclick = (e) => comBotao(e.currentTarget, async () => {
    await DB.batch([
      ...avs.map((a) => ({ op: "delete", col: "avaliacoes", id: a.id })),
      ...res.map((r) => ({ op: "delete", col: "resultados", id: r.id })),
      { op: "delete", col: "elegibilidade", id: x.id },
      { op: "delete", col: "ciclos", id: x.id },
    ]);
    if (S.cfg && S.cfg.cicloAtivo === x.id) await DB.update("config", "geral", { cicloAtivo: null });
    await auditar("excluir_ciclo", `${x.id}: ${avs.length} avaliações, ${res.length} resultados`);
    await recarregarCiclo(); fecharModal(); toast(`Ciclo ${x.rotulo} excluído.`); ir("ciclos");
  });
}

/* -------- geração das avaliações (avaliador × avaliado) -------- */
async function gerarAvaliacoes() {
  const c = S.ciclo;
  const funcs = await carregarFuncs(true); await carregarDeptos(true); const quest = await carregarQuest(true);
  const eleg = await DB.get("elegibilidade", c.id);
  if (!eleg || !eleg.congelada) { toast("Congele a lista de elegíveis antes.", true); return null; }
  const elegiveis = Object.keys(eleg.lista).filter((m) => eleg.lista[m].elegivel && funcs[m]);
  const ativos = Object.values(funcs).filter((f) => ativoNaBase(f) && !ehDiretoria(f));
  const problemas = []; const pares = {};
  const add = (avaliado, avaliador, papel) => {
    if (!avaliador || avaliador === avaliado.matricula) return;
    const id = `${c.id}_${avaliado.matricula}_${avaliador}`;
    if (pares[id]) return;
    const pub = NIVEIS[avaliado.nivel].publico;
    pares[id] = { ciclo: c.id, avaliado: avaliado.matricula, avaliadoNome: avaliado.nome, avaliadoCargo: avaliado.cargo || "", avaliadoDepto: avaliado.depto || "", avaliadoNivel: avaliado.nivel,
      avaliador, avaliadorNome: funcs[avaliador] ? funcs[avaliador].nome : avaliador, papel, publico: pub, status: "pendente", notas: {}, comentario: "" };
  };
  elegiveis.forEach((m) => {
    const f = funcs[m];
    if (!NIVEIS[f.nivel] || !NIVEIS[f.nivel].publico) return;
    const dir = avaliadorDireto(f);
    if (!dir) { problemas.push(`${f.matricula} ${titulo(f.nome)} — sem avaliador direto`); return; }
    add(f, dir, "lider");
    if (f.nivel === "lideranca") ativos.filter((x) => avaliadorDireto(x) === m).forEach((x) => add(f, x.matricula, "liderado"));
    if (f.nivel === "gestor") ativos.filter((x) => x.nivel === "gestor").forEach((x) => add(f, x.matricula, "par"));
  });
  if (problemas.length) {
    modal(`<h3>Avaliações não geradas</h3><p>Corrija os itens abaixo em <b>Avaliadores</b> e tente de novo:</p><div class="table-wrap" style="max-height:300px"><table><tbody>${problemas.map((p) => `<tr><td>${esc(p)}</td></tr>`).join("")}</tbody></table></div><div class="btn-row"><button class="btn btn-primary" onclick="fecharModal();ir('avaliadores')">Ir para Avaliadores</button></div>`);
    return null;
  }
  const existentes = await DB.list("avaliacoes", [["ciclo", "==", c.id]]);
  const exIds = new Set(existentes.map((a) => a.id));
  const ops = [];
  Object.entries(pares).forEach(([id, d]) => { if (!exIds.has(id)) ops.push({ col: "avaliacoes", id, data: { ...d, criadaEm: agoraISO() } }); });
  let removidas = 0;
  existentes.forEach((a) => { if (!pares[a.id] && a.status === "pendente") { ops.push({ op: "delete", col: "avaliacoes", id: a.id }); removidas++; } });
  /* fotografia do questionário usado no cálculo (eixo de cada competência) */
  const snap = {}; Object.keys(PUBLICOS).forEach((p) => (snap[p] = quest[p].map((q) => ({ id: q.id, nome: q.nome, eixo: q.eixo }))));
  ops.push({ op: "update", col: "ciclos", id: c.id, data: { questionarios: snap } });
  await DB.batch(ops);
  await auditar("gerar_avaliacoes", `${c.id}: +${ops.length - 1 - removidas} -${removidas}`);
  await recarregarCiclo();
  return { criadas: ops.length - 1 - removidas, removidas };
}

/* -------- cálculo de resultados -------- */
async function calcularResultados() {
  const c = (await DB.get("ciclos", S.ciclo.id));
  const funcs = await carregarFuncs(true); const deptos = await carregarDeptos(true);
  const eleg = await DB.get("elegibilidade", c.id);
  const avs = (await DB.list("avaliacoes", [["ciclo", "==", c.id]]));
  const exist = {}; (await DB.list("resultados", [["ciclo", "==", c.id]])).forEach((r) => (exist[r.id] = r));
  const quest = c.questionarios || (await carregarQuest());
  const ant = await fonteAnterior(c.id);
  const porAvaliado = {};
  avs.forEach((a) => (porAvaliado[a.avaliado] = porAvaliado[a.avaliado] || []).push(a));
  const ops = [];
  Object.keys(eleg.lista).filter((m) => eleg.lista[m].elegivel).forEach((m) => {
    const f = funcs[m] || eleg.lista[m];
    const lista = porAvaliado[m] || [];
    const env = lista.filter((a) => a.status === "enviada");
    const pub = NIVEIS[f.nivel] ? NIVEIS[f.nivel].publico : "ci";
    const comps = quest[pub] || [];
    const notasComp = {}; const tec = [], comp = [], todas = []; const papel = { lider: [], liderado: [], par: [] };
    comps.forEach((q) => {
      const vs = env.map((a) => a.notas && a.notas[q.id]).filter((v) => typeof v === "number");
      if (vs.length) notasComp[q.id] = round2(avg(vs));
      env.forEach((a) => { const v = a.notas && a.notas[q.id]; if (typeof v !== "number") return; (q.eixo === "tec" ? tec : comp).push(v); todas.push(v); (papel[a.papel] || []).push(v); });
    });
    const nLid = env.filter((a) => a.papel === "liderado").length, nPar = env.filter((a) => a.papel === "par").length;
    const evidencias = [];
    env.forEach((a) => {
      if (a.papel === "liderado" && nLid < MIN_ANON) return;
      Object.entries(a.obs || {}).forEach(([cid, t]) => { if (t) evidencias.push({ comp: (comps.find((q) => q.id === cid) || {}).nome || cid, nota: a.notas?.[cid] ?? null, papel: a.papel, texto: t }); });
      if (a.comentario) evidencias.push({ comp: "Comentário geral", nota: null, papel: a.papel, texto: a.comentario });
    });
    const mT = tec.length ? round2(avg(tec)) : null, mC = comp.length ? round2(avg(comp)) : null, mG = todas.length ? round2(avg(todas)) : null;
    const fT = faixa(mT), fC = faixa(mC);
    const boxCalc = fT && fC ? BOX[fT][fC] : null;
    const id = `${c.id}_${m}`; const old = exist[id];
    const d = (deptos[f.depto] || {});
    const data = {
      ciclo: c.id, matricula: m, nome: f.nome, cargo: f.cargo || "", depto: f.depto || "", nivel: f.nivel, publico: pub, faixaSal: f.faixa || "", admissao: f.admissao || "",
      n2: d.n2 || "", n2Nome: d.n2 && funcs[d.n2] ? funcs[d.n2].nome : "",
      notasComp, mediaTec: mT, mediaComp: mC, mediaGeral: mG, faixaTec: fT, faixaComp: fC, faixaGeral: faixa(mG), boxCalc,
      mediaPorPapel: { lider: papel.lider.length ? round2(avg(papel.lider)) : null, liderados: nLid >= MIN_ANON ? round2(avg(papel.liderado)) : null, pares: nPar >= MIN_ANON ? round2(avg(papel.par)) : null },
      ocultos: { liderados: nLid > 0 && nLid < MIN_ANON, pares: nPar > 0 && nPar < MIN_ANON },
      evidencias, dataCargo: f.dataCargo || null, ultimoReajuste: f.ultimoReajuste || null,
      anterior: ant ? ant.achar(m, f.nome) : null,
      nAval: { enviadas: env.length, total: lista.length, liderados: env.filter((a) => a.papel === "liderado").length, pares: env.filter((a) => a.papel === "par").length },
      calculadoEm: agoraISO(),
    };
    if (!old || !old.boxCal || old.boxCal === old.boxCalc) data.boxCal = boxCalc;
    if (!old) Object.assign(data, { justCal: "", recMerito: "", justMerito: "", validadoN2: false, decisao: "", obsComite: "", combinados: "" });
    ops.push({ col: "resultados", id, data, merge: true });
  });
  await DB.batch(ops);
  await auditar("calcular_resultados", `${c.id}: ${ops.length}`);
  return ops.length;
}

/* ================= FUNCIONÁRIOS ================= */
function lerPlanilhaFolha(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
  const hi = rows.findIndex((r) => r.some((x) => norm(x) === "CHAPA" || norm(x) === "MATRICULA") && r.some((x) => norm(x) === "NOME"));
  if (hi < 0) throw new Error("Não encontrei o cabeçalho (colunas Chapa e Nome) na planilha.");
  const H = rows[hi].map(norm);
  const col = (...nomes) => H.findIndex((h) => nomes.some((n) => h.startsWith(n)));
  const ix = { chapa: col("CHAPA", "MATRICULA"), nome: col("NOME"), filial: col("FILIAL"), cargo: col("CARGO"), faixa: col("FAIXA"), depto: col("DEPTO", "DEPARTAMENTO", "SETOR"), status: col("STATUS", "SITUACAO"), cpf: col("CPF"), escala: col("ESCALA", "TURNO", "HORARIO"), adm: col("DT. ADMISSAO", "DT ADMISSAO", "ADMISSAO", "DATA ADMISSAO", "DATA DE ADMISSAO") };
  const out = [];
  rows.slice(hi + 1).forEach((r) => {
    const raw = String(r[ix.chapa] ?? "").trim();
    if (!/^\d+$/.test(raw)) return; // cabeçalhos repetidos, totais e linhas vazias
    const g = (k) => (ix[k] >= 0 ? String(r[ix[k]] ?? "").trim() : "");
    const x = { matricula: padMat(raw), nome: g("nome").toUpperCase(), filial: g("filial"), cargo: g("cargo").toUpperCase(), faixa: g("faixa"), depto: g("depto").toUpperCase(), status: g("status") || "Ativo", admissao: ix.adm >= 0 ? parseData(r[ix.adm]) : null };
    const cpf = padCPF(g("cpf")); if (cpf) x.cpf = cpf; // vazio não apaga o CPF já cadastrado
    if (g("escala")) x.escala = g("escala").toUpperCase();
    out.push(x);
  });
  return out;
}

PAGES.funcionarios = async (el) => {
  const funcs = await carregarFuncs(true);
  const lista = Object.values(funcs);
  const deptos = [...new Set(lista.map((f) => f.depto).filter(Boolean))].sort();
  el.innerHTML = `<div class="page">${cabecalho("Base de pessoas", "Funcionários", "Importe o relatório de funcionários da folha (modelo FoRelaFunc). O nível é definido pelo cargo: Supervisor, Coordenador e Gerente são Gestor; Líder e Encarregado são Liderança; Diretores ficam fora da avaliação; os demais são Operacional.")}
    <div class="panel"><h2>Importar planilha da folha</h2><p class="desc">A importação atualiza nome, cargo, departamento, escala, CPF, status e admissão. Ajustes manuais de nível, avaliador e perfis são mantidos. Quem não estiver na nova planilha fica marcado como "fora da base".</p>
      <div class="form-grid"><div class="fld" style="grid-column:span 2"><input type="file" id="f-imp" accept=".xlsx,.xls,.csv"></div></div><div id="imp-res"></div></div>
    ${painelDatas()}
    <div class="filter-bar">
      <div class="fld grow"><label>Buscar</label><input id="fu-busca" placeholder="Nome, matrícula, CPF, cargo ou escala"></div>
      <div class="fld"><label>Departamento</label><select id="fu-depto"><option value="">Todos</option>${deptos.map((d) => `<option>${esc(d)}</option>`).join("")}</select></div>
      <div class="fld"><label>Nível</label><select id="fu-nivel"><option value="">Todos</option>${Object.entries(NIVEIS).map(([k, v]) => `<option value="${k}">${v.t}</option>`).join("")}</select></div>
      <div class="fld"><label>Situação</label><select id="fu-sit"><option value="base">Na base</option><option value="fora">Fora da base</option><option value="">Todos</option></select></div>
    </div>
    <div class="count" id="fu-count"></div>
    <div class="table-wrap"><table><thead><tr><th>Matrícula</th><th>Nome</th><th>Departamento</th><th>Nível</th><th>Admissão</th><th>Status</th><th>Perfis</th></tr></thead><tbody id="fu-body"></tbody></table></div></div>`;

  const render = () => {
    const b = norm($("#fu-busca").value), d = $("#fu-depto").value, n = $("#fu-nivel").value, s = $("#fu-sit").value;
    const rows = lista.filter((f) => (!b || norm(f.nome + " " + f.matricula + " " + f.cargo + " " + (f.cpf || "") + " " + (f.escala || "")).includes(b)) && (!d || f.depto === d) && (!n || f.nivel === n) && (!s || (s === "base" ? f.naBase !== false : f.naBase === false)))
      .sort((a, x) => a.nome.localeCompare(x.nome));
    $("#fu-count").textContent = `${rows.length} pessoas`;
    $("#fu-body").innerHTML = rows.length ? rows.map((f) => `<tr class="click" data-m="${f.matricula}"><td>${esc(f.matricula)}</td><td><b>${esc(titulo(f.nome))}</b><span class="sub">${esc(f.cargo || "")}</span></td><td>${esc(f.depto || "—")}${f.escala ? `<span class="sub">${esc(f.escala)}</span>` : ""}</td>
      <td><span class="pill ${NIVEIS[f.nivel]?.pill || "p-neutral"}">${NIVEIS[f.nivel]?.t || "?"}</span>${f.nivelManual ? ' <span class="pill p-neutral" title="Ajustado manualmente">manual</span>' : ""}</td>
      <td>${fmtData(f.admissao)}</td><td>${f.naBase === false ? '<span class="pill p-neutral">fora da base</span>' : `<span class="pill ${ativoNaBase(f) ? "p-ok" : "p-warn"}">${esc(f.status)}</span>`}</td>
      <td>${(f.perfis || []).map((p) => `<span class="pill p-info">${PERFIS[p]}</span>`).join(" ")}${f.avaliadorDireto ? ' <span class="pill p-warn" title="Líder direto definido por pessoa">líder por pessoa</span>' : ""}</td></tr>`).join("")
      : `<tr><td colspan="7" class="empty">${lista.length ? "Nenhuma pessoa com esses filtros." : "Importe a planilha da folha para começar."}</td></tr>`;
    $$("#fu-body tr[data-m]").forEach((tr) => (tr.onclick = () => editarFuncionario(tr.dataset.m, () => { invalidar("func"); ir("funcionarios"); })));
  };
  ["#fu-busca", "#fu-depto", "#fu-nivel", "#fu-sit"].forEach((s) => ($(s).oninput = render));
  render(); ligarDatas();

  $("#f-imp").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const box = $("#imp-res");
    try {
      const novos = lerPlanilhaFolha(await file.arrayBuffer());
      if (!novos.length) throw new Error("Nenhum funcionário encontrado na planilha.");
      const mats = new Set(novos.map((x) => x.matricula));
      const ins = novos.filter((x) => !funcs[x.matricula]).length;
      const sai = lista.filter((f) => f.naBase !== false && f.origem !== "manual" && !mats.has(f.matricula));
      const semAdm = novos.filter((x) => !x.admissao).length;
      const cpfRuim = novos.filter((x) => (funcs[x.matricula]?.nivelManual ? funcs[x.matricula].nivel : nivelPorCargo(x.cargo)) === "operacional" && STATUS_OK.includes(norm(x.status)) && !cpfValido(x.cpf)).length;
      const cont = {}; novos.forEach((x) => { const n = funcs[x.matricula]?.nivelManual ? funcs[x.matricula].nivel : nivelPorCargo(x.cargo); cont[n] = (cont[n] || 0) + 1; });
      box.innerHTML = `<div class="note"><b>${novos.length}</b> funcionários lidos em "${esc(file.name)}": ${ins} novos, ${novos.length - ins} atualizados${sai.length ? `, <b>${sai.length}</b> deixarão a base` : ""}.<br>
        Níveis: ${Object.entries(cont).map(([k, v]) => `${NIVEIS[k].t} ${v}`).join(" · ")}${semAdm ? `<br><b>${semAdm}</b> sem data de admissão (ficarão como "verificar").` : ""}${cpfRuim ? `<br><b>${cpfRuim}</b> operacionais ativos sem CPF válido (entrarão por matrícula e senha até o CPF ser corrigido).` : ""}</div>
        <div class="btn-row"><button class="btn btn-primary" id="bt-imp">Confirmar importação</button><button class="btn btn-ghost" id="bt-imp-x">Cancelar</button></div>`;
      $("#bt-imp-x").onclick = () => { box.innerHTML = ""; e.target.value = ""; };
      $("#bt-imp").onclick = (ev) => comBotao(ev.currentTarget, async () => {
        const ops = novos.map((x) => {
          const old = funcs[x.matricula] || {};
          return { col: "funcionarios", id: x.matricula, merge: true, data: { ...x, nivel: old.nivelManual ? old.nivel : nivelPorCargo(x.cargo), naBase: true, origem: "folha", importadoEm: agoraISO() } };
        });
        sai.forEach((f) => ops.push({ col: "funcionarios", id: f.matricula, op: "update", data: { naBase: false } }));
        await DB.batch(ops);
        await auditar("importar_base", `${novos.length} linhas`);
        invalidar("func"); toast("Base importada."); ir("funcionarios");
      });
    } catch (er) { box.innerHTML = `<div class="note bad">${esc(erroAmigavel(er))}</div>`; }
  };
};

function opcoesPessoas() {
  return `<datalist id="dl-pessoas">${Object.values(C.func || {}).filter((f) => f.naBase !== false || (f.perfis || []).length).sort((a, b) => a.nome.localeCompare(b.nome)).map((f) => `<option value="${f.matricula} — ${esc(titulo(f.nome))}">${esc(f.cargo || "")}</option>`).join("")}</datalist>`;
}
const pessoaTxt = (mat) => (mat && C.func && C.func[mat] ? `${mat} — ${titulo(C.func[mat].nome)}` : mat || "");
const lerPessoa = (v) => { const m = padMat(String(v || "").split("—")[0]); return m && C.func[m] ? m : ""; };

async function editarFuncionario(mat, depois) {
  await carregarDeptos();
  const f = C.func[mat];
  const regra = avaliadorDireto({ ...f, avaliadorDireto: null });
  const m = modal(`<h3>${esc(titulo(f.nome))}</h3>
    <p style="margin:0 0 14px;color:var(--muted);font-size:13px">${esc(f.matricula)} · ${esc(f.cargo || "")} · ${esc(f.depto || "")}${f.escala ? " · " + esc(f.escala) : ""} · admissão ${fmtData(f.admissao)}</p>
    <div class="form-grid">
      <div class="fld"><label>Nível</label><select id="e-nivel">${Object.entries(NIVEIS).map(([k, v]) => `<option value="${k}" ${f.nivel === k ? "selected" : ""}>${v.t}</option>`).join("")}</select><div class="hint">Pelo cargo: ${NIVEIS[nivelPorCargo(f.cargo)].t}</div></div>
      <div class="fld" style="grid-column:span 2"><label>Líder direto (por pessoa)</label><input id="e-aval" list="dl-pessoas" value="${esc(pessoaTxt(f.avaliadorDireto))}" placeholder="Usar a regra do departamento"><div class="hint">Regra do departamento: ${regra ? esc(pessoaTxt(regra)) : "não definida"}. Quando preenchido, prevalece sobre a regra.</div></div>
      <div class="fld"><label>CPF</label><input id="e-cpf" inputmode="numeric" value="${esc(fmtCPF(f.cpf))}" placeholder="Só números"><div class="hint">Operacionais entram com o CPF no usuário e na senha.</div></div>
      <div class="fld"><label>No cargo atual desde</label><input type="date" id="e-dcargo" value="${f.dataCargo || ""}"></div>
      <div class="fld"><label>Último reajuste</label><input type="date" id="e-dreaj" value="${f.ultimoReajuste || ""}"></div>
    </div>
    <div class="fld" style="margin-top:14px"><label>Perfis de acesso</label>
      ${Object.entries(PERFIS).map(([k, v]) => `<label style="display:inline-flex;gap:6px;align-items:center;margin-right:18px;text-transform:none;letter-spacing:0;font-size:13.5px;color:var(--ink);font-weight:500"><input type="checkbox" value="${k}" class="e-perf" ${(f.perfis || []).includes(k) ? "checked" : ""}> ${v}</label>`).join("")}
      <div class="hint">Todos podem responder as próprias avaliações. N2 calibra a área em que for cadastrado como N2 (tela Avaliadores).</div></div>
    ${opcoesPessoas()}
    <div class="btn-row"><button class="btn btn-primary" id="e-ok">Salvar</button><button class="btn btn-ghost" id="e-x">Cancelar</button></div>`);
  $("#e-x", m).onclick = fecharModal;
  $("#e-ok", m).onclick = (ev) => comBotao(ev.currentTarget, async () => {
    const nivel = $("#e-nivel").value; const avTxt = $("#e-aval").value.trim();
    const aval = avTxt ? lerPessoa(avTxt) : "";
    if (avTxt && !aval) return toast("Avaliador não encontrado. Escolha da lista.", true);
    if (aval === mat) return toast("A pessoa não pode avaliar a si mesma.", true);
    const cpf = padCPF($("#e-cpf").value);
    if (cpf && !cpfValido(cpf)) return toast("CPF inválido. Confira os números.", true);
    const perfis = $$(".e-perf", m).filter((x) => x.checked).map((x) => x.value);
    await DB.update("funcionarios", mat, { nivel, nivelManual: nivel !== nivelPorCargo(f.cargo), avaliadorDireto: aval || null, cpf: cpf || null, perfis, dataCargo: $("#e-dcargo").value || null, ultimoReajuste: $("#e-dreaj").value || null });
    const lg = await DB.get("logins", mat);
    if (lg && lg.uid) { try { await DB.update("usuarios", lg.uid, { perfis }); } catch (e) { /* conta antiga */ } }
    await auditar("editar_funcionario", mat);
    fecharModal(); toast("Salvo."); depois && depois();
  });
}

/* ================= OCORRÊNCIAS ================= */
const TIPOS_OC = { falta: "Falta", advertencia: "Advertência", suspensao: "Suspensão", afastamento: "Afastamento" };
PAGES.ocorrencias = async (el) => {
  await carregarFuncs();
  const ocs = (await DB.list("ocorrencias")).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const c = S.ciclo;
  el.innerHTML = `<div class="page">${cabecalho("Elegibilidade", "Ocorrências", `Lance faltas, advertências, suspensões e afastamentos. Qualquer ocorrência dentro do período do ciclo${c ? ` (${fmtData(c.periodoIni)} a ${fmtData(c.periodoFim)})` : ""} torna a pessoa inelegível.`)}
    <div class="panel"><h2>Nova ocorrência</h2><p class="desc">Para afastamento, informe também a data de retorno (ou deixe em branco se ainda estiver afastado).</p>
      <div class="form-grid">
        <div class="fld" style="grid-column:span 2"><label>Funcionário</label><input id="o-pessoa" list="dl-pessoas" placeholder="Digite nome ou matrícula"></div>
        <div class="fld"><label>Tipo</label><select id="o-tipo">${Object.entries(TIPOS_OC).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
        <div class="fld"><label>Data</label><input type="date" id="o-data"></div>
        <div class="fld" id="o-fim-box"><label>Retorno</label><input type="date" id="o-fim"></div>
      </div>
      <div class="fld" style="margin-top:12px"><label>Observação</label><input id="o-obs" placeholder="Opcional"></div>
      <div class="btn-row"><button class="btn btn-primary" id="o-add">Lançar ocorrência</button></div>${opcoesPessoas()}</div>
    ${painelImportOcorrencias()}
    <div class="filter-bar"><div class="fld grow"><label>Buscar</label><input id="o-busca" placeholder="Nome ou matrícula"></div>
      <div class="fld"><label>Tipo</label><select id="o-ftipo"><option value="">Todos</option>${Object.entries(TIPOS_OC).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <div class="fld"><label>Período</label><select id="o-fper"><option value="ciclo">No período do ciclo</option><option value="">Todas</option></select></div></div>
    <div class="count" id="o-count"></div>
    <div class="table-wrap"><table><thead><tr><th>Data</th><th>Funcionário</th><th>Tipo</th><th>Observação</th><th>Lançado por</th><th></th></tr></thead><tbody id="o-body"></tbody></table></div></div>`;
  const tipoSel = $("#o-tipo"); const fimBox = $("#o-fim-box");
  const tg = () => (fimBox.style.visibility = tipoSel.value === "afastamento" ? "visible" : "hidden"); tipoSel.onchange = tg; tg();
  const noCiclo = (o) => c && ocorrenciaNoPeriodo(o, c.periodoIni, c.periodoFim);
  const render = () => {
    const b = norm($("#o-busca").value), t = $("#o-ftipo").value, p = $("#o-fper").value;
    const rows = ocs.filter((o) => (!b || norm(o.matricula + " " + nomeDe(o.matricula)).includes(b)) && (!t || o.tipo === t) && (!p || !c || noCiclo(o)));
    $("#o-count").textContent = `${rows.length} ocorrências`;
    $("#o-body").innerHTML = rows.length ? rows.map((o) => `<tr><td>${fmtData(o.data)}${o.tipo === "afastamento" ? ` a ${o.dataFim ? fmtData(o.dataFim) : "<i>sem retorno</i>"}` : ""}</td>
      <td><b>${esc(nomeDe(o.matricula))}</b><span class="sub">${esc(o.matricula)}</span></td><td><span class="pill ${o.tipo === "falta" ? "p-warn" : o.tipo === "afastamento" ? "p-info" : "p-bad"}">${TIPOS_OC[o.tipo]}</span></td>
      <td>${esc(o.obs || "")}</td><td><span class="sub">${esc(nomeDe(o.por))} · ${fmtData(o.em)}</span></td><td><button class="btn btn-mini btn-danger" data-del="${o.id}">Excluir</button></td></tr>`).join("")
      : `<tr><td colspan="6" class="empty">Nenhuma ocorrência.</td></tr>`;
    $$("[data-del]").forEach((bt) => (bt.onclick = async () => {
      if (!(await confirmar("Excluir ocorrência", "A ocorrência será removida e a elegibilidade recalculada.", "Excluir", true))) return;
      await DB.del("ocorrencias", bt.dataset.del); await auditar("excluir_ocorrencia", bt.dataset.del); ir("ocorrencias");
    }));
  };
  ["#o-busca", "#o-ftipo", "#o-fper"].forEach((s) => ($(s).oninput = render)); render();
  ligarImportOcorrencias(ocs);
  $("#o-add").onclick = (ev) => comBotao(ev.currentTarget, async () => {
    const mat = lerPessoa($("#o-pessoa").value), data = $("#o-data").value;
    if (!mat) return toast("Escolha o funcionário da lista.", true);
    if (!data) return toast("Informe a data.", true);
    const o = { matricula: mat, tipo: tipoSel.value, data, dataFim: tipoSel.value === "afastamento" ? $("#o-fim").value || null : null, obs: $("#o-obs").value.trim(), por: S.me.matricula, em: agoraISO() };
    if (o.dataFim && o.dataFim < o.data) return toast("O retorno não pode ser antes do início.", true);
    await DB.add("ocorrencias", o); await auditar("lancar_ocorrencia", `${mat} ${o.tipo} ${data}`);
    toast("Ocorrência lançada."); ir("ocorrencias");
  });
};
function ocorrenciaNoPeriodo(o, ini, fim) {
  if (o.tipo === "afastamento") { const f = o.dataFim || "9999-12-31"; return o.data <= fim && f >= ini; }
  return o.data >= ini && o.data <= fim;
}

/* ================= ELEGIBILIDADE ================= */
function calcularElegibilidade(funcs, ocs, c, ajustes) {
  const porMat = {}; ocs.forEach((o) => (porMat[o.matricula] = porMat[o.matricula] || []).push(o));
  const lista = {};
  Object.values(funcs).filter((f) => f.naBase !== false).forEach((f) => {
    const mot = [];
    if (ehDiretoria(f)) mot.push("Diretoria — fora da avaliação");
    if (!f.admissao) mot.push("Sem data de admissão");
    else if (f.admissao > c.corte) mot.push(`Admitido em ${fmtData(f.admissao)} (após ${fmtData(c.corte)})`);
    if (!STATUS_OK.includes(norm(f.status))) mot.push(`Status: ${f.status}`);
    (porMat[f.matricula] || []).filter((o) => ocorrenciaNoPeriodo(o, c.periodoIni, c.periodoFim)).forEach((o) =>
      mot.push(o.tipo === "afastamento" ? `Afastamento a partir de ${fmtData(o.data)}` : `${TIPOS_OC[o.tipo]} em ${fmtData(o.data)}`));
    let elegivel = !mot.length; let ajuste = null;
    const aj = ajustes && ajustes[f.matricula];
    if (aj && !ehDiretoria(f)) { elegivel = aj.elegivel; ajuste = aj.motivo; }
    lista[f.matricula] = { elegivel, motivos: mot, ajuste, diretoria: ehDiretoria(f), nome: f.nome, cargo: f.cargo || "", depto: f.depto || "", nivel: f.nivel, admissao: f.admissao || "" };
  });
  return lista;
}

PAGES.elegibilidade = async (el) => {
  const c = S.ciclo; if (!c) return (el.innerHTML = `<div class="page">${cabecalho("Elegibilidade", "Elegibilidade")}${semCiclo()}</div>`);
  const funcs = await carregarFuncs(true);
  const ocs = await DB.list("ocorrencias");
  const doc = (await DB.get("elegibilidade", c.id)) || { ajustes: {}, congelada: false };
  const congelada = !!doc.congelada;
  const lista = congelada ? doc.lista : calcularElegibilidade(funcs, ocs, c, doc.ajustes || {});
  const arr = Object.entries(lista).map(([m, x]) => ({ m, ...x }));
  const el_ = arr.filter((x) => x.elegivel).length;
  const cont = {}; arr.filter((x) => !x.elegivel).forEach((x) => { const k = (x.ajuste ? "Ajuste manual" : (x.motivos[0] || "").replace(/ em .*| \(.*|: .*| a partir.*| — .*/, "")); cont[k] = (cont[k] || 0) + 1; });
  const porNivel = {}; arr.filter((x) => x.elegivel).forEach((x) => (porNivel[x.nivel] = (porNivel[x.nivel] || 0) + 1));
  el.innerHTML = `<div class="page">${cabecalho("Ciclo " + c.rotulo, "Elegibilidade", `Elegível: admitido até <b>${fmtData(c.corte)}</b>, ativo ou em férias e sem falta, advertência, suspensão ou afastamento entre ${fmtData(c.periodoIni)} e ${fmtData(c.periodoFim)}.`)}
    <div class="kpis">${kpi("Pessoas na base", arr.length)}${kpi("Elegíveis", el_, Object.entries(porNivel).map(([k, v]) => `${NIVEIS[k].t} ${v}`).join(" · "), pct(el_, arr.length))}${kpi("Inelegíveis", arr.length - el_, Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${esc(k)} ${v}`).join(" · "))}</div>
    <div class="panel"><h2>${congelada ? "Lista congelada" : "Lista em preparação"}</h2>
      <p class="desc">${congelada ? `Congelada em ${fmtData(doc.congeladaEm)} por ${esc(nomeDe(doc.por))}. É essa lista que gera as avaliações.` : "A lista é recalculada a cada mudança na base ou nas ocorrências. Quando estiver correta, congele para seguir."}</p>
      <div class="btn-row" style="margin:0">${congelada ? (c.etapa === "preparacao" ? `<button class="btn btn-ghost" id="bt-desc">Descongelar para ajustar</button>` : "") : `<button class="btn btn-primary" id="bt-cong">Congelar lista (${el_} elegíveis)</button>`}
        <button class="btn btn-ghost" id="bt-exp">Exportar Excel</button></div></div>
    <div class="filter-bar"><div class="fld grow"><label>Buscar</label><input id="el-busca" placeholder="Nome, matrícula, cargo ou departamento"></div>
      <div class="fld"><label>Resultado</label><select id="el-f"><option value="">Todos</option><option value="s">Elegíveis</option><option value="n">Inelegíveis</option><option value="a">Com ajuste manual</option></select></div>
      <div class="fld"><label>Nível</label><select id="el-n"><option value="">Todos</option>${Object.entries(NIVEIS).map(([k, v]) => `<option value="${k}">${v.t}</option>`).join("")}</select></div></div>
    <div class="count" id="el-count"></div>
    <div class="table-wrap"><table><thead><tr><th>Funcionário</th><th>Departamento</th><th>Nível</th><th>Admissão</th><th>Resultado</th><th>Motivo</th>${congelada ? "" : "<th></th>"}</tr></thead><tbody id="el-body"></tbody></table></div></div>`;
  const render = () => {
    const b = norm($("#el-busca").value), f = $("#el-f").value, n = $("#el-n").value;
    const rows = arr.filter((x) => (!b || norm(`${x.m} ${x.nome} ${x.cargo} ${x.depto}`).includes(b)) && (!n || x.nivel === n) && (!f || (f === "s" ? x.elegivel : f === "n" ? !x.elegivel : !!x.ajuste))).sort((a, z) => a.nome.localeCompare(z.nome));
    $("#el-count").textContent = `${rows.length} pessoas`;
    $("#el-body").innerHTML = rows.map((x) => `<tr><td><b>${esc(titulo(x.nome))}</b><span class="sub">${x.m} · ${esc(x.cargo)}</span></td><td>${esc(x.depto)}</td><td><span class="pill ${NIVEIS[x.nivel]?.pill}">${NIVEIS[x.nivel]?.t}</span></td><td>${fmtData(x.admissao)}</td>
      <td><span class="pill ${x.elegivel ? "p-ok" : "p-bad"}">${x.elegivel ? "Elegível" : "Inelegível"}</span></td>
      <td style="white-space:normal;max-width:340px">${esc(x.motivos.join(" · ")) || "—"}${x.ajuste ? `<span class="sub"><b>Ajuste manual:</b> ${esc(x.ajuste)}</span>` : ""}</td>
      ${congelada ? "" : `<td>${x.diretoria || x.nivel === "diretoria" ? "" : `<button class="btn btn-mini btn-ghost" data-aj="${x.m}">${x.ajuste ? "Desfazer ajuste" : x.elegivel ? "Excluir" : "Incluir"}</button>`}</td>`}</tr>`).join("") || `<tr><td colspan="7" class="empty">${arr.length ? "Nenhuma pessoa com esses filtros." : "Importe a base de funcionários."}</td></tr>`;
    $$("[data-aj]").forEach((bt) => (bt.onclick = async () => {
      const m = bt.dataset.aj; const x = lista[m]; const aj = { ...(doc.ajustes || {}) };
      if (x.ajuste) { delete aj[m]; }
      else {
        const mm = modal(`<h3>${x.elegivel ? "Excluir da avaliação" : "Incluir na avaliação"}</h3><p style="margin-top:0">${esc(titulo(x.nome))}</p><div class="fld"><label>Justificativa</label><textarea id="aj-mot" required></textarea></div>
          <div class="btn-row"><button class="btn btn-primary" id="aj-ok">Confirmar</button><button class="btn btn-ghost" onclick="fecharModal()">Cancelar</button></div>`);
        const mot = await new Promise((r) => ($("#aj-ok", mm).onclick = () => { const v = $("#aj-mot").value.trim(); if (!v) return toast("Informe a justificativa.", true); fecharModal(); r(v); }));
        aj[m] = { elegivel: !x.elegivel, motivo: mot, por: S.me.matricula, em: agoraISO() };
      }
      await DB.set("elegibilidade", c.id, { ciclo: c.id, ajustes: aj, congelada: false, lista: null }); await auditar("ajuste_elegibilidade", m); ir("elegibilidade");
    }));
  };
  ["#el-busca", "#el-f", "#el-n"].forEach((s) => ($(s).oninput = render)); render();
  $("#bt-cong") && ($("#bt-cong").onclick = (ev) => comBotao(ev.currentTarget, async () => {
    await DB.set("elegibilidade", c.id, { ciclo: c.id, ajustes: doc.ajustes || {}, lista, congelada: true, congeladaEm: agoraISO(), por: S.me.matricula });
    await auditar("congelar_elegibilidade", `${c.id}: ${el_}`); toast("Lista congelada."); ir("elegibilidade");
  }));
  $("#bt-desc") && ($("#bt-desc").onclick = async () => { await DB.set("elegibilidade", c.id, { congelada: false, lista: null }, true); ir("elegibilidade"); });
  $("#bt-exp").onclick = () => baixarXLSX(arr.map((x) => ({ Matrícula: x.m, Nome: x.nome, Cargo: x.cargo, Departamento: x.depto, Nível: NIVEIS[x.nivel]?.t, Admissão: fmtData(x.admissao), Elegível: x.elegivel ? "SIM" : "NÃO", Motivos: x.motivos.join(" | "), "Ajuste manual": x.ajuste || "" })), "Elegibilidade", `elegibilidade_${c.id}.xlsx`);
};

/* ================= AVALIADORES ================= */
PAGES.avaliadores = async (el) => {
  const funcs = await carregarFuncs(true); const deptos = await carregarDeptos(true);
  const base = Object.values(funcs).filter((f) => f.naBase !== false);
  const nomes = [...new Set(base.map((f) => f.depto).filter(Boolean))].sort();
  const cnt = (d, n) => base.filter((f) => f.depto === d && f.nivel === n).length;
  const excecoes = base.filter((f) => f.avaliadorDireto);
  /* equipes: líder → liderados ativos (para conferir turnos/áreas com mais de um líder) */
  const equipes = {};
  base.filter((f) => ativoNaBase(f) && !ehDiretoria(f)).forEach((f) => { const l = avaliadorDireto(f); if (l) (equipes[l] = equipes[l] || []).push(f); });
  el.innerHTML = `<div class="page">${cabecalho("Quem avalia quem", "Avaliadores", "Defina, por departamento, quem avalia os operacionais, a liderança e os gestores, e quem é o N2 da área. Onde há mais de um líder (turno, área ou cargo), importe a planilha de líder direto por pessoa.")}
    <div class="note">O <b>líder direto</b> de cada pessoa vem da planilha (ou do ajuste em Funcionários) e, se não houver, da regra do departamento. Ele avalia a pessoa, e os seus <b>liderados</b> o avaliam: cada liderado responde só sobre o próprio líder. Os <b>pares</b> de um gestor são todos os outros gestores da empresa.</div>
    <div class="panel"><h2>Líder direto por pessoa (planilha)</h2><p class="desc">Use quando o setor tem mais de um líder, por turno, área ou cargo. Baixe o modelo, que já vem com todos os funcionários ativos, a escala e o líder atual; corrija a coluna <b>Chapa do líder</b> e importe. Vale sempre o último arquivo importado. Linha com <b>Chapa do líder</b> em branco volta para a regra do departamento; quem não estiver no arquivo não muda.</p>
      <div class="btn-row" style="margin:0 0 12px"><button class="btn btn-ghost" id="bt-modelo-lider">Baixar modelo preenchido</button></div>
      <input type="file" id="ld-imp" accept=".xlsx,.xls,.csv"><div id="ld-res"></div></div>
    <div class="panel"><h2>Regras por departamento</h2><p class="desc">Digite o nome ou a matrícula e escolha na lista. Deixe em branco o que não se aplica ao departamento.</p>
      <div class="table-wrap" style="max-height:none"><table><thead><tr><th>Departamento</th><th class="num">Op · Lid · Gest</th><th>Avalia operacionais</th><th>Avalia liderança</th><th>Avalia gestores</th><th>N2 da área</th></tr></thead><tbody>
      ${nomes.map((d, i) => { const r = deptos[d] || {}; return `<tr data-d="${esc(d)}"><td><b>${esc(d)}</b></td><td class="num">${cnt(d, "operacional")} · ${cnt(d, "lideranca")} · ${cnt(d, "gestor")}</td>
        ${["avalOperacional", "avalLideranca", "avalGestor", "n2"].map((k) => `<td style="min-width:200px"><input list="dl-pessoas" data-k="${k}" value="${esc(pessoaTxt(r[k]))}"></td>`).join("")}</tr>`; }).join("") || `<tr><td colspan="6" class="empty">Importe a base de funcionários.</td></tr>`}
      </tbody></table></div>${opcoesPessoas()}
      <div class="btn-row"><button class="btn btn-primary" id="bt-sav">Salvar regras</button></div></div>
    <div class="grid2">
      <div class="panel"><h2>Diagnóstico</h2><p class="desc">Pessoas da base sem avaliador direto. Diretoria (cargo ou perfil) fica de fora, pois não é avaliada.</p><div id="diag"></div></div>
      <div class="panel"><h2>Equipes por líder</h2><p class="desc">Quantos liderados ativos cada líder tem e de quais escalas. Clique para ver os nomes.</p>
        ${Object.keys(equipes).length ? `<div class="table-wrap" style="max-height:320px"><table><thead><tr><th>Líder</th><th class="num">Liderados</th><th>Escalas</th></tr></thead><tbody>${Object.entries(equipes).sort((a, b) => nomeDe(a[0]).localeCompare(nomeDe(b[0]))).map(([l, fs]) => `<tr class="click" data-eq="${l}"><td><b>${esc(nomeDe(l))}</b><span class="sub">${esc(funcs[l]?.cargo || "")} · ${esc(funcs[l]?.depto || "")}</span></td><td class="num">${fs.length}</td><td>${[...new Set(fs.map((f) => f.escala || "—"))].map(esc).join("<br>")}</td></tr>`).join("")}</tbody></table></div>` : '<p class="empty">Nenhum líder definido ainda.</p>'}
        <p class="hint">${excecoes.length} pessoas com líder definido por pessoa; as demais seguem a regra do departamento.</p></div></div></div>`;
  const diag = () => {
    const sem = base.filter((f) => !ehDiretoria(f) && !avaliadorDireto(f));
    $("#diag").innerHTML = sem.length ? `<p style="margin:0 0 8px"><span class="pill p-warn">${sem.length} pessoas</span></p><div class="table-wrap" style="max-height:320px"><table><tbody>${sem.map((f) => `<tr class="click" data-m="${f.matricula}"><td><b>${esc(titulo(f.nome))}</b><span class="sub">${esc(f.cargo)}</span></td><td>${esc(f.depto)}</td><td><span class="pill ${NIVEIS[f.nivel].pill}">${NIVEIS[f.nivel].t}</span></td></tr>`).join("")}</tbody></table></div>` : '<p class="note" style="margin:0">Todos têm avaliador direto.</p>';
    $$("tr.click[data-m]").forEach((tr) => (tr.onclick = () => editarFuncionario(tr.dataset.m, () => ir("avaliadores"))));
  };
  diag();
  $$("tr[data-eq]").forEach((tr) => (tr.onclick = () => {
    const l = tr.dataset.eq; const fs = equipes[l].sort((a, b) => a.nome.localeCompare(b.nome));
    const m = modal(`<h3>Equipe de ${esc(nomeDe(l))}</h3><div class="table-wrap" style="max-height:380px"><table><tbody>${fs.map((f) => `<tr><td><b>${esc(titulo(f.nome))}</b><span class="sub">${f.matricula} · ${esc(f.cargo || "")}</span></td><td>${esc(f.escala || "—")}</td><td>${f.avaliadorDireto ? '<span class="pill p-warn">por pessoa</span>' : '<span class="pill p-neutral">regra do depto</span>'}</td></tr>`).join("")}</tbody></table></div><div class="btn-row"><button class="btn btn-primary" id="eq-ok">Fechar</button></div>`, true);
    $("#eq-ok", m).onclick = fecharModal;
  }));
  $("#bt-modelo-lider").onclick = () => {
    const linhas = base.filter((f) => ativoNaBase(f) && !ehDiretoria(f))
      .sort((a, b) => (a.depto || "").localeCompare(b.depto || "") || (a.escala || "").localeCompare(b.escala || "") || a.nome.localeCompare(b.nome))
      .map((f) => { const l = avaliadorDireto(f); return { Chapa: f.matricula, Nome: titulo(f.nome), Cargo: f.cargo || "", Nível: NIVEIS[f.nivel]?.t || "", Departamento: f.depto || "", Escala: f.escala || "", "Chapa do líder": l || "", "Nome do líder (conferência)": l ? nomeDe(l) : "" }; });
    baixarXLSX(linhas, "Lider direto", `lider_direto_${hojeISO()}.xlsx`);
  };
  $("#ld-imp").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const box = $("#ld-res");
    try {
      const r = lerPlanilhaLider(await file.arrayBuffer(), funcs);
      const tab = (tit, l) => (l.length ? `<details style="margin-top:8px"><summary><b>${tit} (${l.length})</b></summary><div class="table-wrap" style="max-height:220px"><table><tbody>${l.map((x) => `<tr><td>${esc(x)}</td></tr>`).join("")}</tbody></table></div></details>` : "");
      box.innerHTML = `<div class="note ${r.erros.length ? "warn" : ""}"><b>${r.linhas}</b> linhas lidas em "${esc(file.name)}": <b>${r.mudancas.length}</b> mudanças de líder, ${r.iguais} sem mudança${r.erros.length ? `, <b>${r.erros.length}</b> com problema (serão ignoradas)` : ""}.
        ${tab("Mudanças", r.mudancas.map((x) => `${x.mat} ${nomeDe(x.mat)}: ${x.de ? nomeDe(x.de) : "sem líder"} → ${x.para ? nomeDe(x.para) : "sem líder"}`))}${tab("Problemas", r.erros)}</div>
        ${r.mudancas.length ? `<div class="btn-row"><button class="btn btn-primary" id="ld-ok">Gravar ${r.mudancas.length} mudanças</button><button class="btn btn-ghost" id="ld-x">Cancelar</button></div>` : ""}`;
      if (!r.mudancas.length) return;
      $("#ld-x").onclick = () => { box.innerHTML = ""; e.target.value = ""; };
      $("#ld-ok").onclick = (ev) => comBotao(ev.currentTarget, async () => {
        await DB.batch(r.mudancas.map((x) => ({ op: "update", col: "funcionarios", id: x.mat, data: { avaliadorDireto: x.gravar || null } })));
        await auditar("importar_lider_direto", `${r.mudancas.length} mudanças (${file.name})`);
        invalidar("func"); toast("Líderes atualizados."); ir("avaliadores");
      });
    } catch (er) { box.innerHTML = `<div class="note bad">${esc(erroAmigavel(er))}</div>`; }
  };
  $("#bt-sav") && ($("#bt-sav").onclick = (ev) => comBotao(ev.currentTarget, async () => {
    const ops = []; const erros = [];
    $$("tr[data-d]").forEach((tr) => {
      const d = tr.dataset.d; const r = { nome: d };
      $$("input[data-k]", tr).forEach((i) => { const v = i.value.trim(); const m = v ? lerPessoa(v) : ""; if (v && !m) erros.push(`${d}: "${v}"`); r[i.dataset.k] = m || null; });
      ops.push({ col: "deptos", id: d.replace(/\//g, "-"), data: r });
    });
    if (erros.length) return toast(`Não encontrei: ${erros.slice(0, 3).join(", ")}${erros.length > 3 ? "…" : ""}`, true);
    await DB.batch(ops); await auditar("salvar_avaliadores", `${ops.length} deptos`);
    invalidar("deptos"); toast("Regras salvas."); ir("avaliadores");
  }));
};

/* planilha simples: Chapa do funcionário + Chapa do líder */
function lerPlanilhaLider(buf, funcs) {
  const wb = XLSX.read(buf, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
  const ehLider = (h) => /LIDER|GESTOR|AVALIADOR/.test(h);
  const hi = rows.findIndex((r) => { const H = r.map(norm); return H.some((h) => /^(CHAPA|MATRICULA)/.test(h) && !ehLider(h)) && H.some(ehLider); });
  if (hi < 0) throw new Error("Não encontrei as colunas Chapa e Chapa do líder. Use o modelo baixado nesta tela.");
  const H = rows[hi].map(norm);
  const iF = H.findIndex((h) => /^(CHAPA|MATRICULA)/.test(h) && !ehLider(h));
  const iL = [H.findIndex((h) => ehLider(h) && /CHAPA|MATRICULA/.test(h)), H.findIndex(ehLider)].find((i) => i >= 0);
  const res = { linhas: 0, iguais: 0, mudancas: [], erros: [] }; const vistos = new Set();
  rows.slice(hi + 1).forEach((r, k) => {
    const rf = soDig(r[iF]); if (!rf) return;
    res.linhas++;
    const mat = padMat(rf), f = funcs[mat], lin = `Linha ${hi + k + 2}`;
    if (!f) return res.erros.push(`${lin}: chapa ${mat} não está na base`);
    if (vistos.has(mat)) return res.erros.push(`${lin}: chapa ${mat} repetida (vale a primeira)`);
    vistos.add(mat);
    const rl = soDig(String(r[iL] ?? "").split(/[—–]/)[0]);
    const lider = rl ? padMat(rl) : "";
    if (lider && !funcs[lider]) return res.erros.push(`${lin}: líder ${lider} de ${titulo(f.nome)} não está na base`);
    if (lider && funcs[lider].naBase === false) return res.erros.push(`${lin}: líder ${lider} (${titulo(funcs[lider].nome)}) está fora da base`);
    if (lider === mat) return res.erros.push(`${lin}: ${titulo(f.nome)} não pode ser líder de si mesmo`);
    /* líder igual à regra do departamento: não precisa ficar gravado por pessoa */
    const regra = avaliadorDireto({ ...f, avaliadorDireto: null }) || "";
    const atual = f.avaliadorDireto || "";
    const para = lider === regra ? "" : lider;
    if (atual === para) { res.iguais++; return; }
    res.mudancas.push({ mat, de: atual || regra, para: para || regra, gravar: para });
  });
  return res;
}

/* ================= QUESTIONÁRIOS ================= */
PAGES.questionarios = async (el, params) => {
  const quest = await carregarQuest(true);
  const pub = params.pub || "ci";
  const bloqueado = S.ciclo && S.ciclo.etapa === "avaliacao";
  const comps = JSON.parse(JSON.stringify(quest[pub]));
  el.innerHTML = `<div class="page">${cabecalho("Matriz de Competências", "Questionários", "Cada competência tem 5 descrições de comportamento, do nível 1 (crítico) ao 5 (referência). O avaliador escolhe a descrição que mais se parece com a pessoa; a nota é o nível escolhido.")}
    ${bloqueado ? `<div class="note warn">O ciclo está em avaliação. Alterar o questionário agora pode deixar respostas incompletas; prefira ajustar entre ciclos.</div>` : ""}
    <div class="tabs">${Object.entries(PUBLICOS).map(([k, v]) => `<button class="tab ${k === pub ? "on" : ""}" data-pub="${k}">${v}<span class="sub" style="display:block;font-size:10.5px;font-weight:500">${k === "ci" ? "Operacional" : k === "lideranca" ? "Líder · Encarregado" : "Supervisor · Coordenador · Gerente"}</span></button>`).join("")}</div>
    <div id="q-list"></div>
    <div class="btn-row"><button class="btn btn-ghost" id="q-add">Adicionar competência</button><button class="btn btn-primary" id="q-sav">Salvar questionário</button><button class="btn btn-ghost" id="q-rest">Restaurar Matriz 2026</button></div></div>`;
  $$(".tab").forEach((t) => (t.onclick = () => ir("questionarios", { pub: t.dataset.pub })));
  const NV = ["1 — Crítico", "2 — Em desenvolvimento", "3 — Atende", "4 — Supera", "5 — Referência"];
  const render = () => {
    $("#q-list").innerHTML = comps.map((q, i) => `<div class="comp-card ${q.eixo === "comp" ? "comp" : ""}" data-i="${i}">
      <div class="form-grid" style="grid-template-columns:1fr 180px auto;align-items:end">
        <div class="fld"><label>Competência ${i + 1}</label><input data-f="nome" value="${esc(q.nome)}"></div>
        <div class="fld"><label>Eixo</label><select data-f="eixo"><option value="tec" ${q.eixo === "tec" ? "selected" : ""}>Técnico</option><option value="comp" ${q.eixo === "comp" ? "selected" : ""}>Comportamental</option></select></div>
        <button class="btn btn-mini btn-danger" data-rm="${i}">Remover</button></div>
      <div class="form-grid" style="margin-top:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">${q.niveis.map((n, k) => `<div class="fld"><label>${NV[k]}</label><textarea data-n="${k}" rows="4">${esc(n)}</textarea></div>`).join("")}</div></div>`).join("");
    $$("[data-rm]").forEach((b) => (b.onclick = () => { coletar(); comps.splice(+b.dataset.rm, 1); render(); }));
  };
  const coletar = () => $$(".comp-card[data-i]").forEach((card) => {
    const q = comps[+card.dataset.i];
    q.nome = $("[data-f=nome]", card).value.trim(); q.eixo = $("[data-f=eixo]", card).value;
    q.niveis = $$("textarea[data-n]", card).map((t) => t.value.trim());
    if (!q.id) q.id = norm(q.nome).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "comp-" + Date.now();
  });
  render();
  $("#q-add").onclick = () => { coletar(); comps.push({ id: "", nome: "Nova competência", eixo: "comp", niveis: ["", "", "", "", ""] }); render(); };
  $("#q-rest").onclick = async () => { if (await confirmar("Restaurar", "Substituir este questionário pela Matriz de Competências 2026 original?", "Restaurar")) { comps.splice(0, comps.length, ...JSON.parse(JSON.stringify(window.MATRIZ_2026[pub]))); render(); } };
  $("#q-sav").onclick = (ev) => comBotao(ev.currentTarget, async () => {
    coletar();
    if (comps.some((q) => !q.nome || q.niveis.some((n) => !n))) return toast("Preencha o nome e as 5 descrições de todas as competências.", true);
    const ids = comps.map((q) => q.id); if (new Set(ids).size !== ids.length) return toast("Há competências com o mesmo nome.", true);
    await DB.set("questionarios", pub, { publico: pub, competencias: comps, atualizadoEm: agoraISO(), por: S.me.matricula });
    await auditar("salvar_questionario", pub); invalidar("quest"); toast("Questionário salvo.");
  });
};

/* ================= ACESSOS E SENHAS ================= */
S.senhasGeradas = S.senhasGeradas || [];
PAGES.acessos = async (el) => {
  const funcs = await carregarFuncs(true); await carregarDeptos(true);
  const logins = {}; (await DB.list("logins")).forEach((l) => (logins[l.id] = l));
  const usuarios = {}; (await DB.list("usuarios")).forEach((u) => (usuarios[u.id] = u));
  let avaliadores = new Set();
  if (S.ciclo && S.ciclo.etapa !== "preparacao") (await DB.list("avaliacoes", [["ciclo", "==", S.ciclo.id]])).forEach((a) => avaliadores.add(a.avaliador));
  const lideres = lideresDiretos(funcs);
  const linhas = Object.values(funcs).filter((f) => f.naBase !== false || (f.perfis || []).length).map((f) => {
    const l = logins[f.matricula]; const u = l && usuarios[l.uid];
    const tipoEsp = tipoAcessoEsperado(f, lideres);
    const tipo = u ? u.tipoAcesso || "matricula" : null;
    return { f, u, l, tipo, tipoEsp, situ: !u ? "sem" : tipo === "cpf" ? "ativo" : u.trocarSenha ? "inicial" : "ativo", aval: avaliadores.has(f.matricula),
      trocar: !!u && tipo !== tipoEsp || (!!u && tipo === "cpf" && l && l.cpf !== f.cpf) };
  });
  const precisa = (x) => x.situ === "sem" && (x.aval || (x.f.perfis || []).length || (!avaliadores.size && x.f.naBase !== false && ativoNaBase(x.f)));
  const pend = linhas.filter(precisa);
  const ajustar = linhas.filter((x) => x.trocar && x.f.naBase !== false);
  const opSemCPF = linhas.filter((x) => x.f.naBase !== false && ativoNaBase(x.f) && x.f.nivel === "operacional" && !(x.f.perfis || []).length && !lideres.has(x.f.matricula) && !cpfValido(x.f.cpf));
  const n = (s) => linhas.filter((x) => x.situ === s).length;
  const nCPF = linhas.filter((x) => x.tipo === "cpf").length;
  el.innerHTML = `<div class="page">${cabecalho("Login por CPF ou matrícula", "Acessos e senhas", "Operacionais que só avaliam o líder entram com o <b>CPF no usuário e na senha</b> (fixo, sem troca). Líderes, gestores e perfis RH, N2 e Diretoria entram com a matrícula e uma senha inicial gerada aqui; no primeiro acesso criam a própria senha. Baixe a planilha logo após gerar: o RH não vê as senhas depois.")}
    <div class="kpis">${kpi("Com acesso ativo", n("ativo"), `${nCPF} por CPF`)}${kpi("Senha inicial não trocada", n("inicial"))}${kpi("Sem acesso", n("sem"), avaliadores.size ? `${pend.length} são avaliadores neste ciclo` : "")}</div>
    ${opSemCPF.length ? `<div class="note warn"><b>${opSemCPF.length}</b> operacionais ativos estão sem CPF válido e receberão acesso por matrícula e senha. Corrija o CPF em Funcionários (ou reimporte a folha) antes de gerar os acessos.</div>` : ""}
    <div class="panel"><h2>Gerar acessos</h2><p class="desc">${avaliadores.size ? `Gera acesso para quem tem avaliação a responder neste ciclo ou tem perfil RH, N2 ou Diretoria.` : `As avaliações do ciclo ainda não foram geradas: serão criados acessos para todos os ativos da base.`}${ajustar.length ? ` Também ajusta <b>${ajustar.length}</b> acessos cujo tipo mudou (por exemplo, quem virou líder ou teve o CPF corrigido).` : ""}</p>
      ${window.MODO_DADOS === "firebase" ? `<div class="note warn">O Firebase limita a criação de contas a cerca de 100 por hora a partir do mesmo computador. Se o limite for atingido, o sistema para e você continua mais tarde de onde parou.</div>` : ""}
      <div class="btn-row" style="margin:0"><button class="btn btn-primary" id="bt-ger" ${pend.length + ajustar.length ? "" : "disabled"}>Gerar ${pend.length + ajustar.length} acessos pendentes</button>
      <button class="btn btn-ghost" id="bt-baixar" ${S.senhasGeradas.length ? "" : "disabled"}>Baixar senhas geradas nesta sessão (${S.senhasGeradas.length})</button></div>
      <div id="ger-prog" class="hint"></div></div>
    <div class="filter-bar"><div class="fld grow"><label>Buscar</label><input id="ac-busca" placeholder="Nome ou matrícula"></div>
      <div class="fld"><label>Situação</label><select id="ac-f"><option value="">Todas</option><option value="ativo">Ativo</option><option value="inicial">Senha inicial</option><option value="sem">Sem acesso</option></select></div>
      <div class="fld"><label>Login</label><select id="ac-t"><option value="">Todos</option><option value="cpf">CPF</option><option value="matricula">Matrícula</option></select></div>
      <div class="fld"><label>Avaliador no ciclo</label><select id="ac-av"><option value="">Todos</option><option value="s">Sim</option></select></div></div>
    <div class="count" id="ac-count"></div>
    <div class="table-wrap"><table><thead><tr><th>Funcionário</th><th>Departamento</th><th>Perfis</th><th>Avaliador</th><th>Login</th><th>Acesso</th><th></th></tr></thead><tbody id="ac-body"></tbody></table></div></div>`;
  const SIT = { ativo: ["p-ok", "Ativo"], inicial: ["p-warn", "Senha inicial"], sem: ["p-neutral", "Sem acesso"] };
  const TIPO = { cpf: "CPF", matricula: "Matrícula" };
  const render = () => {
    const b = norm($("#ac-busca").value), f = $("#ac-f").value, av = $("#ac-av").value, t = $("#ac-t").value;
    const rows = linhas.filter((x) => (!b || norm(x.f.nome + " " + x.f.matricula).includes(b)) && (!f || x.situ === f) && (!av || x.aval) && (!t || (x.tipo || x.tipoEsp) === t)).sort((a, z) => a.f.nome.localeCompare(z.f.nome));
    $("#ac-count").textContent = `${rows.length} pessoas`;
    $("#ac-body").innerHTML = rows.map((x) => `<tr><td><b>${esc(titulo(x.f.nome))}</b><span class="sub">${x.f.matricula} · ${esc(x.f.cargo || "")}</span></td><td>${esc(x.f.depto || "")}</td>
      <td>${(x.f.perfis || []).map((p) => `<span class="pill p-info">${PERFIS[p]}</span>`).join(" ")}</td><td>${x.aval ? '<span class="pill p-ok">sim</span>' : ""}</td>
      <td>${TIPO[x.tipo || x.tipoEsp]}${x.trocar ? ` <span class="pill p-warn" title="Será ajustado ao gerar acessos">→ ${TIPO[x.tipoEsp]}</span>` : ""}</td>
      <td><span class="pill ${SIT[x.situ][0]}">${SIT[x.situ][1]}</span></td>
      <td style="white-space:nowrap">${x.situ === "sem" ? `<button class="btn btn-mini btn-ghost" data-cri="${x.f.matricula}">Criar acesso</button>` : `<button class="btn btn-mini btn-ghost" data-res="${x.f.matricula}">${x.tipoEsp === "cpf" ? "Recriar acesso" : "Reiniciar senha"}</button> ${x.f.matricula === S.me.matricula ? "" : `<button class="btn btn-mini btn-danger" data-rem="${x.f.matricula}">Remover</button>`}`}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">Nenhuma pessoa.</td></tr>`;
    $$("[data-cri]").forEach((bt) => (bt.onclick = () => comBotao(bt, async () => { const f = funcs[bt.dataset.cri]; mostrarSenha(f, await criarAcesso(f, logins[f.matricula], lideres)); })));
    $$("[data-res]").forEach((bt) => (bt.onclick = async () => {
      const f = funcs[bt.dataset.res]; const cpf = tipoAcessoEsperado(f, lideres) === "cpf";
      if (!(await confirmar(cpf ? "Recriar acesso" : "Reiniciar senha", cpf ? `${esc(titulo(f.nome))} continuará entrando com o CPF no usuário e na senha.` : `${esc(titulo(f.nome))} receberá uma nova senha inicial e a atual deixará de funcionar.`, cpf ? "Recriar" : "Reiniciar"))) return;
      comBotao(bt, async () => mostrarSenha(f, await criarAcesso(f, logins[f.matricula], lideres)));
    }));
    $$("[data-rem]").forEach((bt) => (bt.onclick = async () => {
      const m = bt.dataset.rem; const l = logins[m];
      if (!(await confirmar("Remover acesso", `${esc(nomeDe(m))} não conseguirá mais entrar no sistema.`, "Remover", true))) return;
      const ops = [{ op: "delete", col: "usuarios", id: l.uid }, { op: "delete", col: "logins", id: m }];
      if (l.cpf) ops.push({ op: "delete", col: "logins", id: "cpf_" + l.cpf });
      await DB.batch(ops); await auditar("remover_acesso", m); ir("acessos");
    }));
  };
  ["#ac-busca", "#ac-f", "#ac-av", "#ac-t"].forEach((s) => ($(s).oninput = render)); render();
  const mostrarSenha = (f, s) => {
    const cpf = s === null;
    const m = modal(`<h3>${cpf ? "Acesso por CPF" : "Senha inicial"}</h3><p style="margin-top:0">${esc(titulo(f.nome))} · matrícula <b>${f.matricula}</b></p>
      ${cpf ? `<p>Usuário e senha: o próprio CPF, só números (${esc(fmtCPF(f.cpf))}). A senha é fixa.</p>`
        : `<div style="font-family:var(--display);font-stretch:75%;font-weight:900;font-size:44px;color:var(--verde);letter-spacing:.06em">${esc(s)}</div><p class="hint">Entregue à pessoa. No primeiro acesso ela criará a própria senha.</p>`}
      <div class="btn-row"><button class="btn btn-primary" id="ms-ok">Fechar</button></div>`);
    $("#ms-ok", m).onclick = () => { fecharModal(); ir("acessos"); };
  };
  $("#bt-baixar").onclick = () => baixarXLSX(S.senhasGeradas.map((x) => ({ Matrícula: x.matricula, Nome: x.nome, Cargo: x.cargo, Departamento: x.depto, "Senha inicial": x.senha, "Gerada em": x.em })), "Senhas iniciais", `senhas_iniciais_${hojeISO()}.xlsx`);
  $("#bt-ger").onclick = (ev) => comBotao(ev.currentTarget, async () => {
    const prog = $("#ger-prog"); let ok = 0, okCPF = 0; const fila = [...pend, ...ajustar];
    for (const x of fila) {
      try { const s = await criarAcesso(x.f, logins[x.f.matricula], lideres); ok++; if (s === null) okCPF++; prog.textContent = `${ok} de ${fila.length} criados…`; }
      catch (e) {
        if (/too-many|quota/.test(e.code || e.message)) { prog.innerHTML = `<b>Limite do Firebase atingido após ${ok} contas.</b> Baixe as senhas geradas e continue mais tarde.`; break; }
        throw e;
      }
    }
    toast(`${ok} acessos criados (${okCPF} por CPF).${ok > okCPF ? " Baixe a planilha de senhas." : ""}`);
    await PAGES.acessos(el);
  });
};
/* quem é líder direto de alguém da base ativa */
function lideresDiretos(funcs) {
  const s = new Set();
  Object.values(funcs).forEach((f) => { if (ativoNaBase(f) && !ehDiretoria(f)) { const l = avaliadorDireto(f); if (l) s.add(l); } });
  return s;
}
/* CPF: operacional, sem perfil e que não lidera ninguém (só avalia o próprio líder) */
function tipoAcessoEsperado(f, lideres) {
  return f.nivel === "operacional" && !(f.perfis || []).length && !lideres.has(f.matricula) && cpfValido(f.cpf) ? "cpf" : "matricula";
}
/* cria (ou recria) o acesso; devolve a senha inicial, ou null quando o acesso é por CPF */
async function criarAcesso(f, loginAtual, lideres) {
  const porCPF = tipoAcessoEsperado(f, lideres || lideresDiretos(C.func || {})) === "cpf";
  const senha = porCPF ? padCPF(f.cpf) : senhaAleatoria();
  const email = (v) => (porCPF ? emailCPF(f.matricula, v) : emailDe(f.matricula, v));
  let versao = loginAtual ? (loginAtual.versao || 0) + 1 : 0;
  let uid = null;
  for (let t = 0; t < 5 && !uid; t++) {
    try { uid = await AUTH.createUser(email(versao), senha); }
    catch (e) { if (/email-already-in-use/.test(e.code || e.message)) versao++; else throw e; }
  }
  if (!uid) throw new Error("Não foi possível criar o acesso.");
  const tipo = porCPF ? "cpf" : "matricula";
  const ops = [
    { col: "usuarios", id: uid, data: { matricula: f.matricula, nome: f.nome, perfis: f.perfis || [], trocarSenha: !porCPF, tipoAcesso: tipo, versao, criadoEm: agoraISO() } },
    { col: "logins", id: f.matricula, data: { email: email(versao), uid, versao, tipo, cpf: porCPF ? senha : null } },
  ];
  if (porCPF) ops.push({ col: "logins", id: "cpf_" + senha, data: { email: email(versao), uid, matricula: f.matricula } });
  if (loginAtual && loginAtual.cpf && (!porCPF || loginAtual.cpf !== senha)) ops.push({ op: "delete", col: "logins", id: "cpf_" + loginAtual.cpf });
  if (loginAtual && loginAtual.uid && loginAtual.uid !== uid) ops.push({ op: "delete", col: "usuarios", id: loginAtual.uid });
  await DB.batch(ops);
  await auditar(loginAtual ? "reiniciar_senha" : "criar_acesso", `${f.matricula} (${tipo})`);
  if (porCPF) return null;
  S.senhasGeradas.push({ matricula: f.matricula, nome: f.nome, cargo: f.cargo || "", depto: f.depto || "", senha, em: new Date().toLocaleString("pt-BR") });
  return senha;
}

/* ================= ACOMPANHAMENTO ================= */
PAGES.acompanhamento = async (el) => {
  const c = S.ciclo;
  if (!c) return (el.innerHTML = `<div class="page">${cabecalho("Ciclo", "Acompanhamento")}${semCiclo()}</div>`);
  const avs = await DB.list("avaliacoes", [["ciclo", "==", c.id]]);
  if (!avs.length) return (el.innerHTML = `<div class="page">${cabecalho("Ciclo " + c.rotulo, "Acompanhamento")}<div class="panel"><h2>Sem avaliações</h2><p class="desc" style="border:0;margin:0;padding:0">As avaliações ainda não foram geradas. Gere em <button class="btn-link" onclick="ir('ciclos')">Ciclo</button>.</p></div></div>`);
  await carregarFuncs();
  const env = avs.filter((a) => a.status === "enviada").length, ras = avs.filter((a) => a.status === "rascunho").length;
  const porAv = {}; avs.forEach((a) => { const k = a.avaliador; porAv[k] = porAv[k] || { mat: k, nome: a.avaliadorNome, total: 0, env: 0, list: [] }; porAv[k].total++; if (a.status === "enviada") porAv[k].env++; porAv[k].list.push(a); });
  const porDep = {}; avs.forEach((a) => { const k = a.avaliadoDepto || "—"; porDep[k] = porDep[k] || { total: 0, env: 0 }; porDep[k].total++; if (a.status === "enviada") porDep[k].env++; });
  const porPapel = {}; avs.forEach((a) => { porPapel[a.papel] = porPapel[a.papel] || { total: 0, env: 0 }; porPapel[a.papel].total++; if (a.status === "enviada") porPapel[a.papel].env++; });
  el.innerHTML = `<div class="page">${cabecalho("Ciclo " + c.rotulo, "Acompanhamento", "Adesão das avaliações por avaliador e por departamento. Use para cobrar quem ainda não respondeu.")}
    <div class="kpis">${kpi("Adesão", pct(env, avs.length) + "%", `${env} de ${avs.length} enviadas`, pct(env, avs.length))}${kpi("Em rascunho", ras)}${kpi("Não iniciadas", avs.length - env - ras)}${kpi("Avaliadores", Object.keys(porAv).length, `${Object.values(porAv).filter((x) => x.env === x.total).length} concluíram tudo`)}</div>
    <div class="grid2">
      <div class="panel"><h2>Por tipo de avaliação</h2><p class="desc">Líder direto, liderados avaliando a liderança e pares entre gestores.</p>
        <table><tbody>${Object.entries(porPapel).map(([k, v]) => `<tr><td>${PAPEIS[k]}</td><td class="num">${v.env}/${v.total}</td><td><span class="minibar"><span style="width:${pct(v.env, v.total)}%"></span></span>${pct(v.env, v.total)}%</td></tr>`).join("")}</tbody></table></div>
      <div class="panel"><h2>Por departamento do avaliado</h2><p class="desc">Ordenado pela menor adesão.</p><div class="table-wrap" style="max-height:260px"><table><tbody>
        ${Object.entries(porDep).sort((a, b) => a[1].env / a[1].total - b[1].env / b[1].total).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v.env}/${v.total}</td><td><span class="minibar"><span style="width:${pct(v.env, v.total)}%"></span></span>${pct(v.env, v.total)}%</td></tr>`).join("")}</tbody></table></div></div></div>
    <div class="panel" style="margin-top:20px"><h2>Por avaliador</h2><p class="desc">Clique para ver as avaliações de cada um e, se preciso, reabrir uma enviada.</p>
      <div class="filter-bar" style="margin-bottom:10px"><div class="fld grow"><label>Buscar</label><input id="ap-busca"></div><div class="fld"><label>Mostrar</label><select id="ap-f"><option value="p">Com pendência</option><option value="">Todos</option></select></div>
        <button class="btn btn-ghost" id="ap-exp">Exportar pendências</button></div>
      <div class="table-wrap"><table><thead><tr><th>Avaliador</th><th class="num">Enviadas</th><th>Progresso</th><th></th></tr></thead><tbody id="ap-body"></tbody></table></div></div>
    ${c.etapa === "avaliacao" ? painelCobranca(porAv, c) : ""}
    ${painelForaDaCurva(avs)}</div>`;
  const render = () => {
    const b = norm($("#ap-busca").value), f = $("#ap-f").value;
    const rows = Object.values(porAv).filter((x) => (!b || norm(x.nome + x.mat).includes(b)) && (!f || x.env < x.total)).sort((a, z) => a.env / a.total - z.env / z.total);
    $("#ap-body").innerHTML = rows.map((x) => `<tr class="click" data-m="${x.mat}"><td><b>${esc(titulo(x.nome))}</b><span class="sub">${x.mat} · ${esc(C.func[x.mat]?.depto || "")}</span></td><td class="num">${x.env}/${x.total}</td><td><span class="minibar"><span style="width:${pct(x.env, x.total)}%"></span></span>${pct(x.env, x.total)}%</td><td>${x.env < x.total && c.etapa === "avaliacao" ? `<button class="btn btn-mini btn-ghost" data-msg="${x.mat}">Mensagem</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">Ninguém com pendência.</td></tr>`;
    $$("#ap-body tr[data-m]").forEach((tr) => (tr.onclick = () => detalheAvaliador(porAv[tr.dataset.m])));
    $$("#ap-body [data-msg]").forEach((bt) => (bt.onclick = (ev) => { ev.stopPropagation(); const x = porAv[bt.dataset.msg]; modalMensagem("Mensagem para " + titulo(x.nome), montarMsg(modelo(), x, c)); }));
  };
  const modelo = () => ($("#cb-mod") ? $("#cb-mod").value : MSG_PADRAO);
  ["#ap-busca", "#ap-f"].forEach((s) => ($(s).oninput = render)); render();
  $("#cb-mod") && ($("#cb-mod").oninput = (e) => localSet("cb-modelo", e.target.value));
  $("#cb-grupo") && ($("#cb-grupo").onclick = () => {
    const pend = Object.values(porAv).filter((x) => x.env < x.total).sort((a, z) => a.nome.localeCompare(z.nome));
    modalMensagem("Mensagem para o grupo", `Pessoal, as avaliações de desempenho do ciclo ${c.rotulo} estão abertas${c.prazo ? ` até ${fmtData(c.prazo)}` : ""}. Ainda faltam respostas de:\n${pend.map((x) => `• ${titulo(x.nome)} (${x.total - x.env})`).join("\n")}\n\nAcesse ${linkSistema()} com sua matrícula e senha. Obrigado!`);
  });
  $("#ap-exp").onclick = () => baixarXLSX(avs.filter((a) => a.status !== "enviada").map((a) => ({ "Matrícula avaliador": a.avaliador, Avaliador: a.avaliadorNome, Avaliado: a.avaliadoNome, Papel: PAPEIS[a.papel], Situação: a.status === "rascunho" ? "Rascunho" : "Não iniciada" })), "Pendências", `pendencias_${c.id}.xlsx`);
  function detalheAvaliador(x) {
    const m = modal(`<h3>${esc(titulo(x.nome))}</h3><div class="table-wrap" style="max-height:420px"><table><thead><tr><th>Avaliado</th><th>Papel</th><th>Situação</th><th></th></tr></thead><tbody>
      ${x.list.map((a) => `<tr><td>${esc(titulo(a.avaliadoNome))}<span class="sub">${esc(a.avaliadoCargo)}</span></td><td>${PAPEIS[a.papel]}</td><td><span class="pill ${a.status === "enviada" ? "p-ok" : a.status === "rascunho" ? "p-warn" : "p-neutral"}">${a.status === "enviada" ? "Enviada" : a.status === "rascunho" ? "Rascunho" : "Não iniciada"}</span></td>
      <td>${a.status === "enviada" && c.etapa === "avaliacao" ? `<button class="btn btn-mini btn-ghost" data-reab="${a.id}">Reabrir</button>` : ""}</td></tr>`).join("")}</tbody></table></div>
      <div class="btn-row"><button class="btn btn-ghost" onclick="fecharModal()">Fechar</button></div>`, true);
    $$("[data-reab]", m).forEach((b) => (b.onclick = async () => { await DB.update("avaliacoes", b.dataset.reab, { status: "rascunho" }); await auditar("reabrir_avaliacao", b.dataset.reab); fecharModal(); toast("Avaliação reaberta."); ir("acompanhamento"); }));
  }
};
