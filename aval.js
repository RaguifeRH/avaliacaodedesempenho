/* ============================================================
   AVALIAÇÃO (avaliadores) e RESULTADOS (RH, N2, Diretoria)
   ============================================================ */
"use strict";

/* ================= MINHAS AVALIAÇÕES ================= */
PAGES.minhas = async (el, params) => {
  const c = S.ciclo;
  if (!c) return (el.innerHTML = `<div class="page">${cabecalho("Avaliação", "Minhas avaliações")}${semCiclo()}</div>`);
  if (params.id) return formularioAvaliacao(el, params.id);
  const avs = await DB.list("avaliacoes", [["avaliador", "==", S.me.matricula], ["ciclo", "==", c.id]]);
  const aberto = c.etapa === "avaliacao";
  const env = avs.filter((a) => a.status === "enviada").length;
  const grupos = [
    { papel: "lider", t: "Sua equipe", d: "Você é o líder direto destas pessoas." },
    { papel: "liderado", t: "Sua liderança", d: "Sua resposta é anônima: o líder e o N2 veem só a média de todos os liderados." },
    { papel: "par", t: "Seus pares", d: "Avalie os outros gestores da empresa com base no que você observa no dia a dia." },
  ];
  let html = `<div class="page">${cabecalho("Ciclo " + c.rotulo, "Minhas avaliações", aberto ? `Para cada competência, escolha a descrição que mais se parece com o comportamento da pessoa nos últimos 6 meses. Você pode salvar e continuar depois.${c.prazo ? ` <b>${esc(prazoTxt(c))}.</b>` : ""}` : "O período de respostas não está aberto. As avaliações aparecem aqui apenas para consulta.")}`;
  if (!avs.length) html += `<div class="panel"><h2>Nada para responder</h2><p class="desc" style="border:0;margin:0;padding:0">Você não tem avaliações neste ciclo.</p></div>`;
  else {
    html += `<div class="kpis">${kpi("Concluídas", `${env}/${avs.length}`, env === avs.length ? "Tudo pronto. Obrigado!" : `${avs.length - env} restantes`, pct(env, avs.length))}</div>`;
    grupos.forEach((g) => {
      const l = avs.filter((a) => a.papel === g.papel).sort((a, b) => (a.status === "enviada") - (b.status === "enviada") || a.avaliadoNome.localeCompare(b.avaliadoNome));
      if (!l.length) return;
      html += `<div class="grp-title">${g.t} · ${l.filter((a) => a.status === "enviada").length}/${l.length}</div><p class="hint" style="margin:-4px 0 10px">${g.d}</p>`;
      html += l.map((a) => {
        const st = a.status === "enviada" ? ["p-ok", "Enviada"] : a.status === "rascunho" ? ["p-warn", "Em andamento"] : ["p-neutral", "A fazer"];
        const bt = !aberto || a.status === "enviada" ? "Ver" : a.status === "rascunho" ? "Continuar" : "Avaliar";
        return `<div class="person-card"><div class="who-av">${esc(iniciais(titulo(a.avaliadoNome)))}</div><div class="pc-tx"><b>${esc(titulo(a.avaliadoNome))}</b><span>${esc(a.avaliadoCargo)} · ${esc(a.avaliadoDepto)}</span></div>
          <span class="pill ${st[0]}">${st[1]}</span><button class="btn btn-mini ${bt === "Ver" ? "btn-ghost" : "btn-primary"}" onclick="ir('minhas',{id:'${a.id}'})">${bt}</button></div>`;
      }).join("");
    });
  }
  el.innerHTML = html + `</div>`;
  atualizarContadorMinhas();
};

async function formularioAvaliacao(el, id) {
  const a = await DB.get("avaliacoes", id);
  if (!a || a.avaliador !== S.me.matricula) { el.innerHTML = `<div class="page"><div class="note bad">Avaliação não encontrada.</div></div>`; return; }
  const quest = await carregarQuest();
  const comps = quest[a.publico] || [];
  const leitura = a.status === "enviada" || S.ciclo.etapa !== "avaliacao";
  const notas = { ...(a.notas || {}) };
  const obs = { ...(a.obs || {}) };
  const extremo = (v) => v === 1 || v === 5;
  const intro = { lider: "Você está avaliando um integrante da sua equipe.", liderado: "Você está avaliando o seu líder. <b>Sua resposta é anônima</b>: ninguém além do RH sabe quem respondeu, e o líder vê apenas a média de todos.", par: "Você está avaliando um gestor par." }[a.papel];
  el.innerHTML = `<div class="page">
    <button class="btn-link" onclick="ir('minhas')">← Voltar para a lista</button>
    <div class="hero" style="margin-top:12px"><div class="eyebrow-mod">${PAPEIS[a.papel]} · ${PUBLICOS[a.publico]}</div><h1 class="page-title">${esc(titulo(a.avaliadoNome))}</h1><p class="page-desc">${esc(a.avaliadoCargo)} · ${esc(a.avaliadoDepto)}</p></div>
    <div class="note">${intro} Escolha, em cada competência, a descrição que mais se parece com o que você observou nos últimos 6 meses. ${leitura ? "<b>Somente leitura.</b>" : ""}</div>
    <div id="comps">${comps.map((q, i) => `<div class="comp-card ${q.eixo === "comp" ? "comp" : ""}" id="cc-${q.id}"><div class="eixo">${i + 1} de ${comps.length} · ${q.eixo === "tec" ? "Técnico" : "Comportamental"}</div><h3>${esc(q.nome)}</h3>
      <div class="opts" role="radiogroup" aria-label="${esc(q.nome)}">${q.niveis.map((n, k) => `<label class="opt ${notas[q.id] === k + 1 ? "on" : ""}"><input type="radio" name="r-${q.id}" value="${k + 1}" ${notas[q.id] === k + 1 ? "checked" : ""} ${leitura ? "disabled" : ""}><span>${esc(n)}</span></label>`).join("")}</div>
      <div class="fld obs-box ${extremo(notas[q.id]) ? "" : "hidden"}" id="ob-${q.id}" style="margin-top:12px"><label for="obt-${q.id}">Dê um exemplo que justifique esta nota (obrigatório para notas extremas)</label><textarea id="obt-${q.id}" rows="2" ${leitura ? "disabled" : ""} placeholder="O que a pessoa fez, quando e qual foi o resultado.">${esc(obs[q.id] || "")}</textarea></div></div>`).join("")}</div>
    <div class="comp-card comp"><div class="eixo">Opcional</div><h3>Comentário</h3><textarea id="av-com" ${leitura ? "disabled" : ""} placeholder="Algo que ajude a entender sua avaliação (exemplos, destaques, pontos a desenvolver).">${esc(a.comentario || "")}</textarea></div>
    <div class="av-foot"><div class="av-progress"><div class="hint" id="av-prog" style="margin:0 0 4px"></div><div class="bar"><span id="av-bar"></span></div></div>
      ${leitura ? `<button class="btn btn-ghost" onclick="ir('minhas')">Voltar</button>` : `<button class="btn btn-ghost" id="av-sal">Salvar e continuar depois</button><button class="btn btn-primary" id="av-env">Enviar avaliação</button>`}</div></div>`;
  const prog = () => { const n = comps.filter((q) => notas[q.id]).length; $("#av-prog").textContent = `${n} de ${comps.length} competências respondidas`; $("#av-bar").style.width = pct(n, comps.length) + "%"; };
  prog();
  if (leitura) return;
  $$("#comps input[type=radio]").forEach((r) => (r.onchange = () => {
    const qid = r.name.slice(2); notas[qid] = +r.value;
    $("#ob-" + qid).classList.toggle("hidden", !extremo(notas[qid]));
    $$(`input[name="${r.name}"]`).forEach((x) => x.closest(".opt").classList.toggle("on", x.checked));
    prog();
  }));
  const salvar = async (enviar) => {
    comps.forEach((q) => { const t = $("#obt-" + q.id).value.trim(); if (extremo(notas[q.id]) && t) obs[q.id] = t; else delete obs[q.id]; });
    const dados = { notas, obs, comentario: $("#av-com").value.trim(), status: enviar ? "enviada" : "rascunho", atualizadaEm: agoraISO() };
    if (enviar) dados.enviadaEm = agoraISO();
    await DB.update("avaliacoes", id, dados);
  };
  $("#av-sal").onclick = (e) => comBotao(e.currentTarget, async () => { await salvar(false); toast("Rascunho salvo."); });
  $("#av-env").onclick = async () => {
    const falta = comps.find((q) => !notas[q.id]);
    if (falta) { toast(`Falta responder: ${falta.nome}`, true); $("#cc-" + falta.id).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const semEx = comps.find((q) => extremo(notas[q.id]) && !$("#obt-" + q.id).value.trim());
    if (semEx) { toast(`Nota ${notas[semEx.id]} em "${semEx.nome}": escreva um exemplo.`, true); $("#obt-" + semEx.id).focus(); $("#cc-" + semEx.id).scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    if (!(await confirmar("Enviar avaliação", `Depois de enviada, a avaliação de <b>${esc(titulo(a.avaliadoNome))}</b> não pode mais ser alterada.`, "Enviar"))) return;
    await comBotao($("#av-env"), async () => { await salvar(true); toast("Avaliação enviada. Obrigado!"); ir("minhas"); });
  };
}

/* ================= RESULTADOS ================= */
function etapaPermite(etapas) { return S.ciclo && etapas.includes(S.ciclo.etapa); }
async function carregarResultados() {
  const c = S.ciclo;
  if (ehRH() || temPerfil("diretoria")) {
    if (!ehRH() && !etapaPermite(["comite", "encerrado"])) return null;
    return DB.list("resultados", [["ciclo", "==", c.id]]);
  }
  return DB.list("resultados", [["ciclo", "==", c.id], ["n2", "==", S.me.matricula]]);
}
function aguardando(el, tit) {
  el.innerHTML = `<div class="page">${cabecalho(S.ciclo ? "Ciclo " + S.ciclo.rotulo : "Resultados", tit)}${S.ciclo ? `<div class="panel"><h2>Ainda não disponível</h2><p class="desc" style="border:0;margin:0;padding:0">Os resultados ficam disponíveis depois que o RH encerra as respostas e calcula as notas${temPerfil("diretoria") && !ehRH() ? ", e para a Diretoria a partir da etapa de Comitê" : ""}.</p></div>` : semCiclo()}</div>`;
}
const nomeComp = (pub, id) => ((S.ciclo.questionarios || C.quest || {})[pub] || []).find((q) => q.id === id)?.nome || id;

PAGES.resultados = async (el) => {
  if (!etapaPermite(["calibracao", "comite", "encerrado"])) return aguardando(el, "Painel e 9-Box");
  const res = await carregarResultados();
  if (!res) return aguardando(el, "Painel e 9-Box");
  await carregarQuest();
  const deptos = [...new Set(res.map((r) => r.depto))].sort();
  let selBox = null, modoBox = "boxCal";
  el.innerHTML = `<div class="page">${cabecalho("Ciclo " + S.ciclo.rotulo, "Painel e 9-Box", `${ehRH() || temPerfil("diretoria") ? "Todas as áreas." : "Pessoas das áreas em que você é N2."} A nota de cada eixo é a média simples de todas as respostas recebidas; a 9-Box cruza a faixa técnica com a comportamental.`)}
    <div class="filter-bar">
      <div class="fld grow"><label>Buscar</label><input id="r-busca" placeholder="Nome ou cargo"></div>
      <div class="fld"><label>Departamento</label><select id="r-dep"><option value="">Todos</option>${deptos.map((d) => `<option>${esc(d)}</option>`).join("")}</select></div>
      <div class="fld"><label>Nível</label><select id="r-niv"><option value="">Todos</option>${["operacional", "lideranca", "gestor"].map((k) => `<option value="${k}">${NIVEIS[k].t}</option>`).join("")}</select></div>
      <div class="fld"><label>9-Box</label><select id="r-modo"><option value="boxCal">Calibrada (N2)</option><option value="boxCalc">Calculada</option></select></div>
      <button class="btn btn-ghost" id="r-exp">Exportar</button></div>
    <div id="r-kpis"></div>
    <div class="grid2"><div class="panel"><h2>Distribuição</h2><p class="desc">Nota geral comparada à dispersão recomendada pela política (20% · 60–70% · 20%).</p><div id="r-dist"></div></div>
      <div class="panel"><h2>Matriz 9-Box</h2><p class="desc">Clique em um quadrante para filtrar a lista.</p><div id="r-9box"></div></div></div>
    <div id="r-evo" style="margin-top:20px"></div>
    <div class="panel"><h2>Médias por competência</h2><p class="desc">Média das pessoas filtradas, por questionário.</p><div id="r-comp"></div></div>
    <div class="panel"><h2>Pessoas</h2><p class="desc" id="r-cnt"></p><div class="table-wrap"><table><thead><tr><th>Funcionário</th><th>Departamento</th><th class="num">Técnico</th><th class="num">Comport.</th><th class="num">Geral</th><th>9-Box</th><th>Evolução</th><th>Respostas</th></tr></thead><tbody id="r-body"></tbody></table></div></div></div>`;
  const filtrados = () => {
    const b = norm($("#r-busca").value), d = $("#r-dep").value, n = $("#r-niv").value;
    return res.filter((r) => (!b || norm(r.nome + " " + r.cargo).includes(b)) && (!d || r.depto === d) && (!n || r.nivel === n));
  };
  const render = () => {
    modoBox = $("#r-modo").value;
    const fl = filtrados(); const av = fl.filter((r) => r.mediaGeral != null);
    const cont = { Abaixo: 0, "Em linha": 0, Acima: 0 }; av.forEach((r) => cont[r.faixaGeral]++);
    const mg = avg(av.map((r) => r.mediaGeral));
    $("#r-kpis").innerHTML = `<div class="kpis">${kpi("Avaliados", av.length, fl.length - av.length ? `${fl.length - av.length} sem respostas` : "")}${kpi("Nota média geral", fmtN(mg), `Técnico ${fmtN(avg(av.map((r) => r.mediaTec)))} · Comportamental ${fmtN(avg(av.map((r) => r.mediaComp)))}`)}
      ${kpi("Acima do esperado", pct(cont.Acima, av.length) + "%", `${cont.Acima} pessoas · recomendado ~20%`)}${kpi("Abaixo do esperado", pct(cont.Abaixo, av.length) + "%", `${cont.Abaixo} pessoas · recomendado ~20%`)}</div>`;
    const seg = (k, cor) => (cont[k] ? `<span style="width:${pct(cont[k], av.length)}%;background:${cor}">${pct(cont[k], av.length)}%</span>` : "");
    $("#r-dist").innerHTML = `<div class="hint" style="margin:0 0 4px">Atual</div><div class="hbar">${seg("Abaixo", FAIXA_COR.Abaixo)}${seg("Em linha", FAIXA_COR["Em linha"])}${seg("Acima", FAIXA_COR.Acima)}</div>
      <div class="hint" style="margin:12px 0 4px">Recomendado</div><div class="hbar"><span style="width:20%;background:#d9a8a4">20%</span><span style="width:60%;background:#a9bfd9">60–70%</span><span style="width:20%;background:#a8cdb4">20%</span></div>
      <div class="legend"><span><i style="background:${FAIXA_COR.Abaixo}"></i>Abaixo (até 3,00)</span><span><i style="background:${FAIXA_COR["Em linha"]}"></i>Em linha (3,01–4,00)</span><span><i style="background:${FAIXA_COR.Acima}"></i>Acima (4,01–5,00)</span></div>`;
    const nb = {}; av.forEach((r) => { const k = r[modoBox]; if (k) nb[k] = (nb[k] || 0) + 1; });
    const ordem = [["Abaixo", "Acima"], ["Em linha", "Acima"], ["Acima", "Acima"], ["Abaixo", "Em linha"], ["Em linha", "Em linha"], ["Acima", "Em linha"], ["Abaixo", "Abaixo"], ["Em linha", "Abaixo"], ["Acima", "Abaixo"]];
    $("#r-9box").innerHTML = `<div class="ninebox"><div class="nb-axis-y">Comportamental →</div>${ordem.map(([t, cp]) => { const nome = BOX[t][cp]; const n = nb[nome] || 0; return `<div class="nb-cell ${selBox === nome ? "sel" : ""}" data-box="${esc(nome)}" style="border-top:4px solid ${BOX_COR[nome]};${n ? "" : "opacity:.6"}"><div class="nb-n" style="color:${BOX_COR[nome]}">${n}</div><div class="nb-t" style="color:${BOX_COR[nome]}">${nome}</div><div class="nb-p">${pct(n, av.length)}% dos avaliados</div><div class="nb-ax">Téc. ${t} · Comp. ${cp}</div></div>`; }).join("")}<div></div><div class="nb-axis-x">Técnico →</div></div>`;
    $$("[data-box]").forEach((x) => (x.onclick = () => { selBox = selBox === x.dataset.box ? null : x.dataset.box; render(); }));
    $("#r-evo").innerHTML = painelEvolucao(av);
    $$("#r-evo [data-dos]").forEach((tr) => (tr.onclick = () => dossie(res.find((r) => r.id === tr.dataset.dos))));
    /* médias por competência */
    const porPub = {};
    av.forEach((r) => Object.entries(r.notasComp || {}).forEach(([id, v]) => { const k = r.publico; porPub[k] = porPub[k] || {}; (porPub[k][id] = porPub[k][id] || []).push(v); }));
    $("#r-comp").innerHTML = Object.keys(porPub).length ? `<div class="grid2">${Object.entries(porPub).map(([p, m]) => `<div><div class="grp-title" style="margin-top:0">${PUBLICOS[p]}</div><table><tbody>${Object.entries(m).map(([id, vs]) => [id, avg(vs)]).sort((a, b) => a[1] - b[1]).map(([id, v]) => `<tr><td>${esc(nomeComp(p, id))}</td><td class="num" style="width:140px"><span class="minibar"><span style="width:${(v / 5) * 100}%;background:${FAIXA_COR[faixa(v)]}"></span></span>${fmtN(v)}</td></tr>`).join("")}</tbody></table></div>`).join("")}</div>` : '<p class="empty">Sem notas.</p>';
    const tb = fl.filter((r) => !selBox || r[modoBox] === selBox).sort((a, b) => (b.mediaGeral ?? -1) - (a.mediaGeral ?? -1));
    $("#r-cnt").textContent = `${tb.length} pessoas${selBox ? ` em "${selBox}"` : ""}. Clique para ver o detalhe.`;
    $("#r-body").innerHTML = tb.map((r) => `<tr class="click" data-id="${r.id}"><td><b>${esc(titulo(r.nome))}</b><span class="sub">${esc(r.cargo)}</span></td><td>${esc(r.depto)}</td>
      <td class="num">${fmtN(r.mediaTec)}</td><td class="num">${fmtN(r.mediaComp)}</td><td class="num"><b>${fmtN(r.mediaGeral)}</b></td>
      <td>${r[modoBox] ? `<span class="pill" style="background:${BOX_COR[r[modoBox]]};color:#fff">${esc(r[modoBox])}</span>` : '<span class="pill p-neutral">sem respostas</span>'}</td><td>${movHTML(r)}</td><td class="num">${r.nAval?.enviadas ?? 0}/${r.nAval?.total ?? 0}</td></tr>`).join("") || `<tr><td colspan="8" class="empty">Ninguém com esses filtros.</td></tr>`;
    $$("#r-body tr[data-id]").forEach((tr) => (tr.onclick = () => dossie(res.find((r) => r.id === tr.dataset.id))));
  };
  ["#r-busca", "#r-dep", "#r-niv", "#r-modo"].forEach((s) => ($(s).oninput = render)); render();
  $("#r-exp").onclick = () => baixarXLSX(filtrados().map(linhaExport), "Resultados", `resultados_${S.ciclo.id}.xlsx`);
};
function linhaExport(r) {
  const o = { Matrícula: r.matricula, Nome: r.nome, Cargo: r.cargo, Departamento: r.depto, Nível: NIVEIS[r.nivel]?.t, "Faixa salarial": r.faixaSal, N2: r.n2Nome,
    "Média técnica": r.mediaTec, "Média comportamental": r.mediaComp, "Média geral": r.mediaGeral, "Faixa geral": r.faixaGeral || "",
    "Média líder direto": r.mediaPorPapel?.lider, "Média liderados": r.mediaPorPapel?.liderados, "Média pares": r.mediaPorPapel?.pares,
    "9-Box calculada": r.boxCalc || "", "9-Box calibrada": r.boxCal || "", "9-Box anterior": r.anterior ? `${r.anterior.rotulo}: ${r.anterior.box}` : "", Evolução: r.anterior ? (MOV[movDe(r)]?.[1] || "") : "",
    "Bloqueio de mérito": bloqueioMerito(r).join(" | "), "Justificativa calibração": r.justCal || "", "Recomendação mérito (N2)": r.recMerito || "", "Justificativa mérito": r.justMerito || "",
    ...(C.tabela ? projExport(r) : {}),
    "Validado N2": r.validadoN2 ? "Sim" : "Não", "Decisão Comitê": r.decisao || "", "Obs. Comitê": r.obsComite || "", "Respostas recebidas": `${r.nAval?.enviadas ?? 0}/${r.nAval?.total ?? 0}` };
  Object.entries(r.notasComp || {}).forEach(([id, v]) => (o["[" + (PUBLICOS[r.publico] || "") + "] " + nomeComp(r.publico, id)] = v));
  return o;
}
function dossie(r) {
  const comps = ((S.ciclo.questionarios || C.quest)[r.publico] || []);
  const linha = (q) => { const v = r.notasComp?.[q.id]; return `<tr><td>${esc(q.nome)}</td><td style="width:170px"><span class="minibar" style="width:100px"><span style="width:${v ? (v / 5) * 100 : 0}%;background:${v ? FAIXA_COR[faixa(v)] : "#ccc"}"></span></span>${fmtN(v)}</td></tr>`; };
  const mp = r.mediaPorPapel || {};
  modal(`<h3>${esc(titulo(r.nome))}</h3>
    <p style="margin:0 0 12px;color:var(--muted);font-size:13px">${esc(r.cargo)} · ${esc(r.depto)} · ${NIVEIS[r.nivel]?.t} · faixa ${esc(r.faixaSal || "—")}</p>
    <div class="kpis" style="grid-template-columns:repeat(3,1fr)">${kpi("Técnico", fmtN(r.mediaTec), r.faixaTec || "")}${kpi("Comportamental", fmtN(r.mediaComp), r.faixaComp || "")}${kpi("Geral", fmtN(r.mediaGeral), r.faixaGeral || "")}</div>
    <p style="font-size:13px;margin:0 0 12px">9-Box calculada: <b>${esc(r.boxCalc || "—")}</b> · calibrada: <b>${esc(r.boxCal || "—")}</b>${r.justCal ? `<br><span class="hint">Justificativa: ${esc(r.justCal)}</span>` : ""}</p>
    <p style="font-size:12.5px;color:var(--muted);margin:0 0 12px">Médias por avaliador: líder direto ${fmtN(mp.lider)}${r.nivel === "lideranca" ? ` · liderados ${r.ocultos?.liderados ? `oculta (menos de ${MIN_ANON} respostas)` : `${fmtN(mp.liderados)} (${r.nAval?.liderados || 0} respostas)`}` : ""}${r.nivel === "gestor" ? ` · pares ${r.ocultos?.pares ? `oculta (menos de ${MIN_ANON} respostas)` : `${fmtN(mp.pares)} (${r.nAval?.pares || 0} respostas)`}` : ""}</p>
    ${r.anterior ? `<p style="font-size:13px;margin:0 0 12px">Ciclo anterior (${esc(r.anterior.rotulo)}): <b>${esc(r.anterior.box)}</b>${r.anterior.media != null ? ` · média ${fmtN(r.anterior.media)}` : ""} ${movHTML(r).split("<span class=\"sub\">")[0]}</p>` : ""}
    <div class="grid2" style="gap:14px"><div><div class="grp-title" style="margin-top:0">Técnico</div><table><tbody>${comps.filter((q) => q.eixo === "tec").map(linha).join("")}</tbody></table></div>
    <div><div class="grp-title" style="margin-top:0">Comportamental</div><table><tbody>${comps.filter((q) => q.eixo === "comp").map(linha).join("")}</tbody></table></div></div>
    ${(r.evidencias || []).length ? `<div class="grp-title">Exemplos registrados pelos avaliadores</div>${r.evidencias.map((e) => `<div class="ps-coment" style="border:1px solid var(--line);border-left:4px solid var(--mod);padding:9px 12px;margin-bottom:6px;font-size:13px"><div class="hint" style="margin:0 0 3px"><b>${esc(e.comp)}</b>${e.nota ? ` · nota ${e.nota}` : ""} · ${PAPEIS[e.papel]}</div>${esc(e.texto)}</div>`).join("")}` : ""}
    <div class="btn-row"><button class="btn btn-ghost" onclick="fecharModal()">Fechar</button></div>`, true);
}

/* célula de projeção na calibração */
function projCelula(r, dis) {
  if (r.recMerito !== "Recomenda") return '<span class="sub">Aparece ao recomendar mérito</span>';
  const p = projetar(r, r.faixaProposta);
  if (p.erro) return projHTML(p);
  const sel = p.opcoes.length > 1 ? `<select data-f="faixaProposta" ${dis} style="margin-bottom:5px">${p.opcoes.map((o) => `<option value="${o.faixa}" ${o.faixa === p.faixaDestino ? "selected" : ""}>Faixa ${o.faixa} · ${brl(o.valor)}</option>`).join("")}</select>` : "";
  return sel + projHTML(p);
}

/* ================= CALIBRAÇÃO ================= */
PAGES.calibracao = async (el) => {
  if (!etapaPermite(["calibracao", "comite", "encerrado"])) return aguardando(el, "Calibração");
  const res = await DB.list("resultados", ehRH() ? [["ciclo", "==", S.ciclo.id]] : [["ciclo", "==", S.ciclo.id], ["n2", "==", S.me.matricula]]);
  const edita = S.ciclo.etapa === "calibracao";
  await carregarTabela();
  const n2s = [...new Set(res.map((r) => r.n2Nome || "Sem N2"))].sort();
  el.innerHTML = `<div class="page">${cabecalho("Ciclo " + S.ciclo.rotulo, "Calibração", "Revise o quadrante de cada pessoa. Se reposicionar, registre a justificativa. Indique quem você recomenda para mérito: o sistema projeta o ajuste pela tabela salarial, da faixa atual para a seguinte (você pode escolher outra faixa). Valide cada linha. Quem está Abaixo do esperado não é elegível a mérito (política GP020).")}
    ${C.tabela ? "" : `<div class="note warn">A tabela salarial ainda não foi importada pelo RH. A projeção de mérito aparece depois da importação.</div>`}
    ${edita ? "" : `<div class="note warn">A calibração está fechada (etapa ${ETAPAS.find((e) => e.id === S.ciclo.etapa).t}). Somente consulta.</div>`}
    <div id="c-kpis"></div>
    <div class="filter-bar"><div class="fld grow"><label>Buscar</label><input id="c-busca"></div>
      ${ehRH() ? `<div class="fld"><label>N2</label><select id="c-n2"><option value="">Todos</option>${n2s.map((n) => `<option>${esc(titulo(n))}</option>`).join("")}</select></div>` : ""}
      <div class="fld"><label>Mostrar</label><select id="c-f"><option value="">Todos</option><option value="p">Não validados</option><option value="r">Reposicionados</option><option value="m">Recomendados p/ mérito</option></select></div></div>
    <div class="table-wrap" style="max-height:none"><table><thead><tr><th>Funcionário</th><th class="num">T · C · Geral</th><th>9-Box (calculada → calibrada)</th><th>Mérito / justificativa</th><th>Projeção do ajuste</th><th>Ok</th></tr></thead><tbody id="c-body"></tbody></table></div></div>`;
  const kpis = () => { const v = res.filter((r) => r.validadoN2).length, rp = res.filter((r) => r.boxCal && r.boxCal !== r.boxCalc).length, rec = res.filter((r) => r.recMerito === "Recomenda" && !bloqueioMerito(r).length);
    const ps = rec.map((r) => projetar(r, r.faixaProposta)).filter((p) => !p.erro); const tot = ps.reduce((a, p) => a + p.dif, 0);
    $("#c-kpis").innerHTML = `<div class="kpis">${kpi("Validados", `${v}/${res.length}`, "", pct(v, res.length))}${kpi("Reposicionados", rp)}${kpi("Recomendados para mérito", rec.length, rec.length - ps.length ? `${rec.length - ps.length} sem projeção` : "")}${kpi("Impacto mensal estimado", brl(tot), `${brl(tot * 13)} no ano, com 13º e sem encargos`)}</div>`; };
  const render = () => {
    const b = norm($("#c-busca").value), f = $("#c-f").value, n2 = $("#c-n2") ? $("#c-n2").value : "";
    const rows = res.filter((r) => (!b || norm(r.nome + r.cargo + r.depto).includes(b)) && (!n2 || titulo(r.n2Nome || "Sem N2") === n2) &&
      (!f || (f === "p" ? !r.validadoN2 : f === "r" ? r.boxCal !== r.boxCalc : r.recMerito === "Recomenda"))).sort((a, z) => a.depto.localeCompare(z.depto) || a.nome.localeCompare(z.nome));
    const dis = edita ? "" : "disabled";
    $("#c-body").innerHTML = rows.map((r) => {
      const semNota = r.mediaGeral == null; const bloq = bloqueioMerito(r); const naoEleg = bloq.length > 0;
      return `<tr data-id="${r.id}"><td style="min-width:170px"><b>${esc(titulo(r.nome))}</b><span class="sub">${esc(r.cargo)} · ${esc(r.depto)}</span></td>
      <td class="num">${fmtN(r.mediaTec)} · ${fmtN(r.mediaComp)} · <b>${fmtN(r.mediaGeral)}</b></td>
      <td style="min-width:200px"><div style="margin-bottom:5px">${r.boxCalc ? `<span class="pill" style="background:${BOX_COR[r.boxCalc]};color:#fff">${esc(r.boxCalc)}</span>` : '<span class="pill p-neutral">sem respostas</span>'}</div><select data-f="boxCal" ${dis || (semNota ? "disabled" : "")}>${BOX_LISTA.map((x) => `<option ${r.boxCal === x.nome ? "selected" : ""}>${x.nome}</option>`).join("")}</select>${r.anterior ? `<span class="sub">${esc(r.anterior.rotulo)}: ${esc(r.anterior.box)} · ${MOV[movDe(r)]?.[1] || ""}</span>` : ""}
        <input data-f="justCal" placeholder="Por que reposicionou?" value="${esc(r.justCal || "")}" style="margin-top:5px" ${dis}></td>
      <td style="min-width:180px"><select data-f="recMerito" ${dis || (naoEleg ? "disabled" : "")}><option value="">—</option><option ${r.recMerito === "Recomenda" ? "selected" : ""}>Recomenda</option><option ${r.recMerito === "Não recomenda" ? "selected" : ""}>Não recomenda</option></select>
        ${naoEleg ? `<span class="sub" style="color:var(--bad)">Não elegível: ${esc(bloq.join("; "))}</span>` : `<input data-f="justMerito" placeholder="Justificativa" value="${esc(r.justMerito || "")}" style="margin-top:5px" ${dis}>`}</td>
      <td style="min-width:210px">${projCelula(r, dis)}</td>
      <td><input type="checkbox" data-f="validadoN2" ${r.validadoN2 ? "checked" : ""} ${dis} style="width:20px;height:20px"></td></tr>`;
    }).join("") || `<tr><td colspan="6" class="empty">${res.length ? "Ninguém com esses filtros." : "Nenhuma pessoa sob sua responsabilidade neste ciclo."}</td></tr>`;
    if (!edita) return;
    $$("#c-body tr[data-id]").forEach((tr) => $$("[data-f]", tr).forEach((inp) => (inp.onchange = async () => {
      const r = res.find((x) => x.id === tr.dataset.id); const campo = inp.dataset.f;
      const val = inp.type === "checkbox" ? inp.checked : inp.value.trim();
      const dados = { [campo]: val };
      if (campo === "recMerito" || campo === "faixaProposta") {
        const rr = { ...r, ...dados };
        dados.projecao = rr.recMerito === "Recomenda" ? projSalvar(projetar(rr, rr.faixaProposta)) : null;
      }
      if (campo === "validadoN2" && val) {
        const bc = $("[data-f=boxCal]", tr).value, jc = $("[data-f=justCal]", tr).value.trim();
        if (bc !== r.boxCalc && r.boxCalc && !jc) { inp.checked = false; return toast("Reposicionou: informe a justificativa antes de validar.", true); }
        if ($("[data-f=recMerito]", tr).value === "Recomenda" && !($("[data-f=justMerito]", tr)?.value.trim())) { inp.checked = false; return toast("Justifique a recomendação de mérito antes de validar.", true); }
        dados.validadoEm = agoraISO(); dados.validadoPor = S.me.matricula;
      }
      try { await DB.update("resultados", r.id, dados); Object.assign(r, dados); kpis(); toast("Salvo."); if (campo === "recMerito" || campo === "faixaProposta" || campo === "boxCal") render(); }
      catch (e) { toast(erroAmigavel(e), true); }
    })));
  };
  ["#c-busca", "#c-f", "#c-n2"].forEach((s) => $(s) && ($(s).oninput = render));
  kpis(); render();
};

/* ================= COMITÊ ================= */
PAGES.comite = async (el) => {
  if (!etapaPermite(["calibracao", "comite", "encerrado"]) || (!ehRH() && !etapaPermite(["comite", "encerrado"]))) return aguardando(el, "Comitê");
  const res = await DB.list("resultados", [["ciclo", "==", S.ciclo.id]]);
  const edita = ehRH() && S.ciclo.etapa === "comite";
  await carregarTabela();
  el.innerHTML = `<div class="page">${cabecalho("Ciclo " + S.ciclo.rotulo, "Comitê de Avaliação", "RH e Gestores N2 definem os contemplados com mérito, dentro do orçamento do semestre. A Diretoria consulta o resultado aqui.")}
    ${ehRH() && S.ciclo.etapa === "calibracao" ? `<div class="note warn">O ciclo ainda está em calibração. As decisões podem ser registradas a partir da etapa Comitê.</div>` : ""}
    <div class="panel"><h2>Orçamento do mérito</h2><p class="desc">Valor mensal disponível para os ajustes por mérito deste semestre. O sistema soma a projeção da tabela salarial dos aprovados.</p>
      <div class="form-grid" style="max-width:560px"><div class="fld"><label>Orçamento mensal (R$)</label><input id="cm-orc" inputmode="decimal" value="${S.ciclo.orcamento != null ? String(S.ciclo.orcamento).replace(".", ",") : ""}" ${ehRH() && S.ciclo.etapa !== "encerrado" ? "" : "disabled"} placeholder="Ex.: 15000,00"></div></div>
      <div id="cm-orc-bar" style="margin-top:14px"></div></div>
    <div id="cm-kpis"></div>
    <div class="filter-bar"><div class="fld grow"><label>Buscar</label><input id="cm-busca"></div>
      <div class="fld"><label>Mostrar</label><select id="cm-f"><option value="r">Recomendados pelo N2</option><option value="a">Aprovados</option><option value="">Todos</option></select></div>
      <button class="btn btn-ghost" id="cm-exp">Exportar</button></div>
    <div class="table-wrap" style="max-height:none"><table><thead><tr><th>Funcionário</th><th>Faixa</th><th class="num">Geral</th><th>9-Box</th><th>Recomendação N2</th><th>Projeção do ajuste</th><th>Decisão</th><th>Observação</th></tr></thead><tbody id="cm-body"></tbody></table></div></div>`;
  const elegRec = (x) => x.recMerito === "Recomenda" && !bloqueioMerito(x).length;
  const soma = (l) => l.map((x) => projetar(x, x.faixaProposta)).filter((p) => !p.erro).reduce((t, p) => t + p.dif, 0);
  const kpis = () => {
    const rec = res.filter(elegRec), apr = res.filter((x) => elegRec(x) && x.decisao === "Aprovado");
    const tr = soma(rec), ta = soma(apr), orc = S.ciclo.orcamento;
    $("#cm-kpis").innerHTML = `<div class="kpis">${kpi("Recomendados pelo N2", rec.length, `Impacto ${brl(tr)}/mês`)}${kpi("Aprovados", apr.length, `Impacto ${brl(ta)}/mês · ${brl(ta * 13)}/ano`)}${kpi("Não aprovados", res.filter((x) => x.decisao === "Não aprovado").length)}${kpi("Em análise", rec.filter((x) => !x.decisao || x.decisao === "Em análise").length)}</div>`;
    const bar = $("#cm-orc-bar");
    if (orc == null) { bar.innerHTML = `<p class="hint" style="margin:0">Informe o orçamento para acompanhar o saldo.</p>`; return; }
    const saldo = orc - ta, usado = pct(ta, orc);
    bar.innerHTML = `<div class="kpis" style="margin-bottom:10px">${kpi("Orçamento mensal", brl(orc))}${kpi("Usado pelos aprovados", brl(ta), `${usado}% do orçamento`, usado)}${kpi("Saldo", brl(saldo), saldo < 0 ? "Acima do orçamento" : `${brl(saldo * 13)} no ano`)}</div>
      ${saldo < 0 ? `<div class="note bad" style="margin:0">Os aprovados passam do orçamento em <b>${brl(-saldo)}</b> por mês.</div>` : tr > orc ? `<div class="note warn" style="margin:0">Aprovar todos os recomendados custaria ${brl(tr)} por mês, ${brl(tr - orc)} acima do orçamento.</div>` : ""}`;
  };
  const render = () => {
    const b = norm($("#cm-busca").value), f = $("#cm-f").value;
    const rows = res.filter((r) => (!b || norm(r.nome + r.cargo + r.depto).includes(b)) && (!f || (f === "r" ? r.recMerito === "Recomenda" : r.decisao === "Aprovado"))).sort((a, z) => (z.mediaGeral ?? 0) - (a.mediaGeral ?? 0));
    const dis = edita ? "" : "disabled";
    $("#cm-body").innerHTML = rows.map((r) => `<tr data-id="${r.id}"><td style="min-width:200px"><b>${esc(titulo(r.nome))}</b><span class="sub">${esc(r.cargo)} · ${esc(r.depto)}</span>${r.anterior ? `<span class="sub">${esc(r.anterior.rotulo)}: ${esc(r.anterior.box)} · ${MOV[movDe(r)]?.[1] || ""}</span>` : ""}</td><td>${esc(r.faixaSal || "—")}</td><td class="num"><b>${fmtN(r.mediaGeral)}</b></td>
      <td>${r.boxCal ? `<span class="pill" style="background:${BOX_COR[r.boxCal]};color:#fff">${esc(r.boxCal)}</span>` : ""}</td>
      <td style="white-space:normal;max-width:300px">${r.recMerito ? `<span class="pill ${r.recMerito === "Recomenda" ? "p-ok" : "p-neutral"}">${r.recMerito}</span>` : "—"}${r.recMerito === "Recomenda" && bloqueioMerito(r).length ? `<span class="sub" style="color:var(--bad)"><b>Bloqueado:</b> ${esc(bloqueioMerito(r).join("; "))}</span>` : ""}<span class="sub">${esc(r.justMerito || "")}</span><span class="sub">N2: ${esc(titulo(r.n2Nome || "—"))}</span></td>
      <td style="min-width:190px">${r.recMerito === "Recomenda" ? projHTML(projetar(r, r.faixaProposta)) : "—"}</td>
      <td style="min-width:150px"><select data-f="decisao" ${dis || (r.recMerito === "Recomenda" && bloqueioMerito(r).length && r.decisao !== "Aprovado" ? "disabled" : "")}><option value="">—</option>${["Aprovado", "Não aprovado", "Em análise"].map((d) => `<option ${r.decisao === d ? "selected" : ""}>${d}</option>`).join("")}</select></td>
      <td style="min-width:200px"><input data-f="obsComite" value="${esc(r.obsComite || "")}" ${dis}></td></tr>`).join("") || `<tr><td colspan="8" class="empty">Ninguém com esses filtros.</td></tr>`;
    if (!edita) return;
    $$("#cm-body [data-f]").forEach((inp) => (inp.onchange = async () => {
      const id = inp.closest("tr").dataset.id; const r = res.find((x) => x.id === id);
      const d = { [inp.dataset.f]: inp.value.trim(), decididoEm: agoraISO(), decididoPor: S.me.matricula };
      await DB.update("resultados", id, d); Object.assign(r, d); kpis(); toast("Salvo.");
    }));
  };
  ["#cm-busca", "#cm-f"].forEach((s) => ($(s).oninput = render)); kpis(); render();
  $("#cm-orc").onchange = async (e) => {
    const t = e.target.value.trim(); const v = t ? parseFloat(t.replace(/[R$\s.]/g, "").replace(",", ".")) : null;
    if (t && isNaN(v)) return toast("Valor inválido. Use, por exemplo, 15000,00.", true);
    await DB.update("ciclos", S.ciclo.id, { orcamento: v }); S.ciclo.orcamento = v; kpis(); toast("Orçamento salvo.");
  };
  $("#cm-exp").onclick = () => baixarXLSX(res.filter((r) => r.recMerito === "Recomenda" || r.decisao).map(linhaExport), "Comitê", `comite_${S.ciclo.id}.xlsx`);
};

/* ================= CARTAS ================= */
function cartaHTML(r) {
  const key = (r.boxCal || r.boxCalc || "colaborador raguife").toLowerCase();
  const mod = window.MODELOS_CARTA[key] || window.MODELOS_CARTA["colaborador raguife"];
  const cor = (window.ACCENTS || {})[key] || "#1B6B2E";
  const comps = ((S.ciclo.questionarios || C.quest)[r.publico] || []);
  const notas = comps.map((q) => ({ ...q, v: r.notasComp?.[q.id] })).filter((q) => q.v != null).sort((a, b) => a.v - b.v);
  const gaps = notas.slice(0, 2);
  const pdi = gaps.map((g) => ({ g, a: window.PDI_ACOES[g.id] })).filter((x) => x.a);
  const card = (k, pctx, tit, c1, bg) => `<div class="rg-pdi-c" style="border-top-color:${c1}"><div class="rg-pdi-h" style="background:${bg};color:${c1}"><b>${pctx}%</b>${tit}</div><ul>${pdi.map((x) => `<li><i>${esc(x.g.nome)}</i>${esc(x.a[k])}</li>`).join("")}</ul></div>`;
  return `<div class="rg-carta">
    <div class="rg-head"><img src="${window.LOGO_CARTA}" alt="Raguife"><div class="rg-head-r"><b>Avaliação de Desempenho</b><span>Ciclo ${esc(S.ciclo.rotulo)} · Documento individual confidencial</span></div></div>
    <div class="rg-colab" style="background:${cor}"><div><div class="rg-nome">${esc(titulo(r.nome))}</div><div class="rg-cargo">${esc(r.cargo)} · ${esc(r.depto)}</div>
      <div class="rg-badge">${esc(mod.titulo)}<small>${esc(mod.sub)}</small></div></div>
      <div class="rg-medias"><div class="rg-media"><b>${fmtN(r.mediaTec)}</b><span>Técnica</span></div><div class="rg-media"><b>${fmtN(r.mediaComp)}</b><span>Comportamental</span></div><div class="rg-media"><b style="font-size:26px">${fmtN(r.mediaGeral)}</b><span>Geral</span></div></div></div>
    <div class="rg-sec"><div class="rg-sec-t">Feedback</div><div class="rg-txt"><p>Olá, ${esc(titulo(r.nome).split(" ")[0])}.</p><p>${mod.intro}</p><p>${mod.p2}</p><p>${mod.p3}</p></div></div>
    <div class="rg-destaque">${mod.destaque}</div>
    <div class="rg-sec"><div class="rg-sec-t">Próximos passos</div><ol class="rg-passos">${mod.passos.map((p) => `<li>${p}</li>`).join("")}</ol></div>
    ${gaps.length ? `<div class="rg-sec"><div class="rg-sec-t">Competências de maior atenção</div>${gaps.map((g) => `<div class="rg-comp"><span class="t" style="background:${g.eixo === "tec" ? "#EBF3FF" : "#EAF4EE"};color:${g.eixo === "tec" ? "#1D4ED8" : "#1B6B2E"}">${g.eixo === "tec" ? "Técnica" : "Comportamental"}</span><span class="n">${esc(g.nome)}</span><span class="v" style="color:${FAIXA_COR[faixa(g.v)]}">${fmtN(g.v)}</span></div>`).join("")}</div>` : ""}
    ${pdi.length ? `<div class="rg-sec"><div class="rg-sec-t">Plano de Desenvolvimento Individual · 70-20-10</div><div class="rg-pdi">${card("p70", 70, "No trabalho", "#14532D", "#F0FDF4")}${card("p20", 20, "Com pessoas", "#1E3A8A", "#EFF6FF")}${card("p10", 10, "Educação formal", "#581C87", "#FAF5FF")}</div></div>` : ""}
    <div class="rg-sec"><div class="rg-sec-t">Combinados</div><div class="rg-comb">${esc(r.combinados || "")}</div></div>
    <div class="rg-txt rg-sec" style="font-size:12.5px">${(window.ENCERRAMENTOS || {})[key] || ""}</div>
    <div class="rg-ass"><div>Colaborador(a)</div><div>Liderança</div></div></div>`;
}
function imprimirCartas(lista) {
  const pa = $("#print-area"); pa.innerHTML = lista.map(cartaHTML).join("");
  document.body.classList.add("printing");
  const fim = () => { document.body.classList.remove("printing"); pa.innerHTML = ""; window.removeEventListener("afterprint", fim); };
  window.addEventListener("afterprint", fim);
  setTimeout(() => window.print(), 300);
}
PAGES.cartas = async (el) => {
  if (!etapaPermite(["calibracao", "comite", "encerrado"])) return aguardando(el, "Cartas de feedback");
  await carregarQuest();
  const res = (await DB.list("resultados", [["ciclo", "==", S.ciclo.id]])).filter((r) => r.mediaGeral != null);
  const deptos = [...new Set(res.map((r) => r.depto))].sort();
  el.innerHTML = `<div class="page">${cabecalho("Ciclo " + S.ciclo.rotulo, "Cartas de feedback", "A carta usa o texto do quadrante da 9-Box calibrada, as duas competências com menor nota e um PDI 70-20-10 sugerido para elas. Registre os combinados da conversa e imprima ou salve em PDF.")}
    <div class="filter-bar"><div class="fld grow"><label>Buscar</label><input id="ct-busca"></div>
      <div class="fld"><label>Departamento</label><select id="ct-dep"><option value="">Todos</option>${deptos.map((d) => `<option>${esc(d)}</option>`).join("")}</select></div>
      <div class="fld"><label>9-Box</label><select id="ct-box"><option value="">Todos</option>${BOX_LISTA.map((b) => `<option>${b.nome}</option>`).join("")}</select></div>
      <button class="btn btn-ghost" id="ct-all">Imprimir as filtradas</button></div>
    <div class="table-wrap"><table><thead><tr><th>Funcionário</th><th>Departamento</th><th>9-Box</th><th class="num">Geral</th><th>Combinados</th><th></th></tr></thead><tbody id="ct-body"></tbody></table></div></div>`;
  const filt = () => { const b = norm($("#ct-busca").value), d = $("#ct-dep").value, x = $("#ct-box").value; return res.filter((r) => (!b || norm(r.nome + r.cargo).includes(b)) && (!d || r.depto === d) && (!x || r.boxCal === x)).sort((a, z) => a.nome.localeCompare(z.nome)); };
  const render = () => {
    $("#ct-body").innerHTML = filt().map((r) => `<tr><td><b>${esc(titulo(r.nome))}</b><span class="sub">${esc(r.cargo)}</span></td><td>${esc(r.depto)}</td><td><span class="pill" style="background:${BOX_COR[r.boxCal]};color:#fff">${esc(r.boxCal || "")}</span></td><td class="num">${fmtN(r.mediaGeral)}</td>
      <td>${r.combinados ? '<span class="pill p-ok">registrados</span>' : '<span class="pill p-neutral">—</span>'}</td><td><button class="btn btn-mini btn-primary" data-id="${r.id}">Abrir carta</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty">Ninguém com esses filtros.</td></tr>`;
    $$("#ct-body [data-id]").forEach((b) => (b.onclick = () => abrirCarta(res.find((r) => r.id === b.dataset.id), render)));
  };
  ["#ct-busca", "#ct-dep", "#ct-box"].forEach((s) => ($(s).oninput = render)); render();
  $("#ct-all").onclick = () => { const l = filt(); if (!l.length) return toast("Nenhuma carta.", true); imprimirCartas(l); };
};
function abrirCarta(r, depois) {
  const m = modal(`<h3>Carta · ${esc(titulo(r.nome))}</h3><div class="carta-wrap" id="cw">${cartaHTML(r)}</div>
    <div class="fld" style="margin-top:14px"><label>Combinados da conversa de feedback</label><textarea id="ct-comb" rows="4" placeholder="O que foi combinado com a pessoa, prazos e acompanhamento.">${esc(r.combinados || "")}</textarea></div>
    <div class="btn-row"><button class="btn btn-ghost" id="ct-sal">Salvar combinados</button><button class="btn btn-primary" id="ct-pr">Imprimir / salvar PDF</button><button class="btn btn-ghost" onclick="fecharModal()">Fechar</button></div>`, true);
  const sal = async () => { r.combinados = $("#ct-comb", m).value.trim(); await DB.update("resultados", r.id, { combinados: r.combinados }); $("#cw", m).innerHTML = cartaHTML(r); };
  $("#ct-sal", m).onclick = (e) => comBotao(e.currentTarget, async () => { await sal(); toast("Combinados salvos."); depois && depois(); });
  $("#ct-pr", m).onclick = async () => { await sal(); fecharModal(); imprimirCartas([r]); depois && depois(); };
}
