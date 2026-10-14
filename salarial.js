/* ============================================================
   TABELA SALARIAL e PROJEÇÃO DE MÉRITO
   A projeção usa o valor da tabela na faixa atual da pessoa e o
   valor da faixa seguinte (ou a faixa escolhida pelo N2).
   ============================================================ */
"use strict";

const FAIXAS_SAL = ["A", "B", "C", "D", "E", "F"];
const brl = (v) => (v == null || isNaN(v) ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pctTxt = (v) => (v == null || isNaN(v) ? "—" : (v >= 0 ? "+" : "") + v.toFixed(1).replace(".", ",") + "%");

async function carregarTabela(forcar) {
  if (C.tabela === undefined || forcar) C.tabela = await DB.get("tabela", "atual").catch(() => null);
  return C.tabela;
}

function lerTabelaSalarial(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
  const hi = rows.findIndex((r) => r.some((x) => norm(x) === "CARGO") && r.some((x) => norm(x) === "A") && r.some((x) => norm(x) === "B"));
  if (hi < 0) throw new Error("Não encontrei o cabeçalho (colunas CARGO e faixas A a F) na planilha.");
  const H = rows[hi].map(norm);
  const ix = (n) => H.indexOf(n);
  const iF = {}; FAIXAS_SAL.forEach((f) => (iF[f] = ix(f)));
  const num = (v) => { if (v === "" || v == null) return null; const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[R$\s.]/g, "").replace(",", ".")); return isNaN(n) ? null : round2(n); };
  const linhas = [];
  rows.slice(hi + 1).forEach((r, k) => {
    const cargo = String(r[ix("CARGO")] ?? "").trim();
    if (!cargo) return;
    const valores = {}; FAIXAS_SAL.forEach((f) => (valores[f] = iF[f] >= 0 ? num(r[iF[f]]) : null));
    if (FAIXAS_SAL.every((f) => valores[f] == null)) return;
    const g = (n) => (ix(n) >= 0 ? String(r[ix(n)] ?? "").trim() : "");
    linhas.push({ id: g("ID") || "l" + k, cargo: cargo.toUpperCase(), depto: g("DEPARTAMENTO").toUpperCase(), filial: g("FILIAL"), grupo: g("TABELA SALARIAL"), area: g("AREA"),
      valores, efetivoCargo: g("CARGO EFETIVO").toUpperCase(), efetivoFaixa: g("FAIXA EFETIVA").toUpperCase(), obs: g("OBS. EFETIVA") });
  });
  if (!linhas.length) throw new Error("Nenhum cargo com valores encontrado na planilha.");
  return linhas;
}

/* cargo + departamento; se não houver, o primeiro cargo com o mesmo nome */
function acharLinha(tab, cargo, depto) {
  if (!tab) return null;
  const c = norm(cargo), d = norm(depto);
  return tab.linhas.find((x) => norm(x.cargo) === c && norm(x.depto) === d) || tab.linhas.find((x) => norm(x.cargo) === c) || null;
}

/* projeção do mérito para um resultado (r.cargo, r.depto, r.faixaSal) */
function projetar(r, faixaDestino) {
  const tab = C.tabela;
  if (!tab) return { erro: "Tabela salarial não importada" };
  const l = acharLinha(tab, r.cargo, r.depto);
  if (!l) return { erro: "Cargo não está na tabela salarial" };
  const fa = String(r.faixaSal || "").trim().toUpperCase();
  if (!FAIXAS_SAL.includes(fa)) return { erro: "Sem faixa atual no cadastro" };
  const vAtual = l.valores[fa];
  if (vAtual == null) return { erro: `Faixa ${fa} sem valor na tabela` };
  let opcoes = FAIXAS_SAL.slice(FAIXAS_SAL.indexOf(fa) + 1).filter((f) => l.valores[f] != null).map((f) => ({ cargo: l.cargo, faixa: f, valor: l.valores[f] }));
  if (!opcoes.length && l.efetivoCargo) {
    const le = acharLinha(tab, l.efetivoCargo, r.depto); const ff = l.efetivoFaixa || "A";
    if (le && le.valores[ff] != null) opcoes = [{ cargo: le.cargo, faixa: ff, valor: le.valores[ff], efetivacao: true }];
  }
  if (!opcoes.length) return { erro: fa === "F" ? "Já está na faixa F (topo)" : "Sem faixa seguinte na tabela", faixaAtual: fa, valorAtual: vAtual };
  const d = opcoes.find((o) => o.faixa === faixaDestino) || opcoes[0];
  return { cargoAtual: l.cargo, faixaAtual: fa, valorAtual: vAtual, cargoDestino: d.cargo, faixaDestino: d.faixa, valorDestino: d.valor,
    dif: round2(d.valor - vAtual), pct: round2((d.valor / vAtual - 1) * 100), efetivacao: !!d.efetivacao, opcoes };
}
const projSalvar = (p) => (p && !p.erro ? { cargoAtual: p.cargoAtual, faixaAtual: p.faixaAtual, valorAtual: p.valorAtual, cargoDestino: p.cargoDestino, faixaDestino: p.faixaDestino, valorDestino: p.valorDestino, dif: p.dif, pct: p.pct, efetivacao: p.efetivacao, em: agoraISO() } : null);
function projHTML(p) {
  if (!p) return "—";
  if (p.erro) return `<span class="pill p-warn">${esc(p.erro)}</span>`;
  return `<b>${p.faixaAtual} → ${p.efetivacao ? esc(titulo(p.cargoDestino)) + " " : ""}${p.faixaDestino}</b> <span class="pill p-ok">${pctTxt(p.pct)}</span>
    <span class="sub">${brl(p.valorAtual)} → ${brl(p.valorDestino)} (${brl(p.dif)}/mês)</span>`;
}
function projExport(r) {
  const p = r.recMerito === "Recomenda" ? projetar(r, r.faixaProposta) : null;
  return { "Faixa atual (tabela)": p && !p.erro ? p.faixaAtual : r.faixaSal || "", "Valor faixa atual": p && !p.erro ? p.valorAtual : "", "Cargo proposto": p && !p.erro ? p.cargoDestino : "",
    "Faixa proposta": p && !p.erro ? p.faixaDestino : "", "Valor faixa proposta": p && !p.erro ? p.valorDestino : "", "Ajuste mensal estimado": p && !p.erro ? p.dif : "", "Ajuste %": p && !p.erro ? p.pct : "", "Obs. projeção": p && p.erro ? p.erro : "" };
}

/* ================= TELA: TABELA SALARIAL ================= */
PAGES.tabela = async (el) => {
  const tab = await carregarTabela(true);
  const funcs = await carregarFuncs();
  const base = Object.values(funcs).filter((f) => f.naBase !== false && f.nivel !== "diretoria");
  const semCargo = tab ? base.filter((f) => !acharLinha(tab, f.cargo, f.depto)) : [];
  const semFaixa = base.filter((f) => !FAIXAS_SAL.includes(String(f.faixa || "").toUpperCase()));
  el.innerHTML = `<div class="page">${cabecalho("Remuneração", "Tabela salarial", "Valores por cargo e faixa (A a F). A calibração usa esta tabela para projetar o ajuste por mérito: valor da faixa atual da pessoa → valor da faixa seguinte. Importe de novo sempre que a tabela for atualizada.")}
    <div class="panel"><h2>Importar tabela</h2><p class="desc">${tab ? `Tabela atual: <b>${esc(tab.arquivo || "")}</b>, importada em ${fmtData(tab.importadoEm)} por ${esc(nomeDe(tab.por))} · ${tab.linhas.length} cargos.` : "Nenhuma tabela importada ainda."} A nova importação substitui a anterior; projeções já salvas são recalculadas ao abrir a calibração.</p>
      <input type="file" id="ts-imp" accept=".xlsx,.xls"><div id="ts-res"></div></div>
    ${tab ? `<div class="kpis">${kpi("Cargos na tabela", tab.linhas.length)}${kpi("Funcionários com cargo encontrado", `${base.length - semCargo.length}/${base.length}`, "", pct(base.length - semCargo.length, base.length))}${kpi("Sem faixa no cadastro", semFaixa.length, "Sem projeção de mérito")}</div>
    ${semCargo.length ? `<div class="panel"><h2>Cargos da base fora da tabela</h2><p class="desc">Essas pessoas não terão projeção. Inclua o cargo na tabela ou corrija o cargo na folha.</p><div class="table-wrap" style="max-height:280px"><table><thead><tr><th>Cargo</th><th>Departamento</th><th class="num">Pessoas</th></tr></thead><tbody>
      ${Object.entries(semCargo.reduce((a, f) => { const k = f.cargo + "|" + f.depto; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k.split("|")[0])}</td><td>${esc(k.split("|")[1])}</td><td class="num">${n}</td></tr>`).join("")}</tbody></table></div></div>` : ""}
    <div class="filter-bar"><div class="fld grow"><label>Buscar</label><input id="ts-busca" placeholder="Cargo ou departamento"></div></div>
    <div class="table-wrap"><table><thead><tr><th>Cargo</th><th>Departamento</th>${FAIXAS_SAL.map((f) => `<th class="num">${f}</th>`).join("")}<th>Efetivação</th></tr></thead><tbody id="ts-body"></tbody></table></div>` : ""}</div>`;
  if (tab) {
    const render = () => {
      const b = norm($("#ts-busca").value);
      $("#ts-body").innerHTML = tab.linhas.filter((l) => !b || norm(l.cargo + " " + l.depto).includes(b)).map((l) => `<tr><td><b>${esc(l.cargo)}</b><span class="sub">${esc(l.grupo || "")}</span></td><td>${esc(l.depto)}</td>
        ${FAIXAS_SAL.map((f) => `<td class="num">${l.valores[f] != null ? brl(l.valores[f]) : "—"}</td>`).join("")}<td>${l.efetivoCargo ? `${esc(titulo(l.efetivoCargo))} · ${esc(l.efetivoFaixa || "A")}` : ""}</td></tr>`).join("");
    };
    $("#ts-busca").oninput = render; render();
  }
  $("#ts-imp").onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const box = $("#ts-res");
    try {
      const linhas = lerTabelaSalarial(await file.arrayBuffer());
      box.innerHTML = `<div class="note"><b>${linhas.length}</b> cargos lidos em "${esc(file.name)}".</div><div class="btn-row"><button class="btn btn-primary" id="ts-ok">Substituir tabela</button><button class="btn btn-ghost" id="ts-x">Cancelar</button></div>`;
      $("#ts-x").onclick = () => { box.innerHTML = ""; e.target.value = ""; };
      $("#ts-ok").onclick = (ev) => comBotao(ev.currentTarget, async () => {
        await DB.set("tabela", "atual", { linhas, arquivo: file.name, importadoEm: agoraISO(), por: S.me.matricula });
        await auditar("importar_tabela_salarial", `${linhas.length} cargos`);
        toast("Tabela salarial atualizada."); ir("tabela");
      });
    } catch (er) { box.innerHTML = `<div class="note bad">${esc(erroAmigavel(er))}</div>`; }
  };
};
