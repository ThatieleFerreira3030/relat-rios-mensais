import * as XLSX from "xlsx";

export type MesRegistro = {
  mes: string; // "2025-04"
  matrizes: number;
  touros: number;
  faturamento: number;
  aReceber: number | null;
  inadimplencia: number | null;
};

export type PainelDados = {
  periodo: { inicio: string; fim: string };
  meses: MesRegistro[];
  kpis: {
    faturamentoTotal: number;
    faturamentoMedio: number;
    carteiraTotal: number;
    emAtraso: number;
    aVencer: number;
    pctInadimplencia: number;
    clientes: number;
    titulos: number;
  };
  aging: { faixa: string; valor: number; titulos: number }[];
  topClientes: { nome: string; faturado: number; carteira: number }[];
  topDevedores: { nome: string; valor: number }[];
  agingPorCliente: { nome: string; faixas: Record<string, number>; total: number }[];
  fonte: string;
};

export type PainelUpload = {
  id: string;
  criado_em: string;
  rotulo: string;
  fonte: string | null;
  dados: PainelDados;
};

const MESES_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function rotuloMes(chave: string) {
  const [ano = "", mes = ""] = chave.split("-");
  const i = Number(mes) - 1;
  return `${MESES_PT[i] ?? mes}/${ano.slice(2)}`;
}

export function brl(valor: number | null | undefined, curto = false) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  if (curto) {
    if (Math.abs(valor) >= 1_000_000)
      return `R$ ${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
    if (Math.abs(valor) >= 1_000)
      return `R$ ${(valor / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  }
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function pct(valor: number | null | undefined, casas = 1) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "—";
  return `${(valor * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

export function pctInadimplencia(
  aReceber: number | null,
  inadimplencia: number | null,
): number | null {
  if (!aReceber || inadimplencia === null) return null;
  return inadimplencia / aReceber;
}

export const ORDEM_FAIXAS = ["Em Dia", "0-30", "31-60", "61-90", "+90"];

const ROTULOS_MES_SAFRA = [
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
  "Jan",
  "Fev",
  "Mar",
];

/** Ano de início da safra (abr a mar) à qual o mês pertence. Jan-Mar contam na safra do ano anterior. */
export function anoInicioSafra(chave: string): number {
  const [anoStr = "", mesStr = ""] = chave.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  return mes >= 4 ? ano : ano - 1;
}

/** Posição do mês dentro da safra: abr = 1 ... mar = 12. */
export function indiceMesSafra(chave: string): number {
  const mes = Number(chave.split("-")[1] ?? 0);
  return mes >= 4 ? mes - 3 : mes + 9;
}

export function rotuloMesSafra(indice: number): string {
  return ROTULOS_MES_SAFRA[indice - 1] ?? String(indice);
}

export function rotuloSafra(anoInicio: number): string {
  return `${anoInicio}/${String(anoInicio + 1).slice(2)}`;
}

export type MesComIndice = MesRegistro & { indice: number };

export type SafraResumo = {
  anoInicio: number;
  rotulo: string;
  meses: MesComIndice[];
};

/** Agrupa o histórico mensal em safras (abr a mar), ordenadas da mais antiga para a mais recente. */
export function agruparPorSafra(meses: MesRegistro[]): SafraResumo[] {
  const grupos = new Map<number, MesComIndice[]>();
  for (const m of meses) {
    const ano = anoInicioSafra(m.mes);
    const lista = grupos.get(ano) ?? [];
    lista.push({ ...m, indice: indiceMesSafra(m.mes) });
    grupos.set(ano, lista);
  }
  return Array.from(grupos.entries())
    .sort(([a], [b]) => a - b)
    .map(([anoInicio, lista]) => ({
      anoInicio,
      rotulo: rotuloSafra(anoInicio),
      meses: lista.sort((a, b) => a.indice - b.indice),
    }));
}

export type SafraSerieMes = {
  rotulo: string;
  indice: number;
  faturamentoAtual: number | null;
  faturamentoAnterior: number | null;
  aReceberAtual: number | null;
  aReceberAnterior: number | null;
  inadimplenciaAtual: number | null;
  inadimplenciaAnterior: number | null;
};

export type ComparativoSafra = {
  atual: SafraResumo;
  anterior: SafraResumo;
  ultimoIndice: number;
  serie: SafraSerieMes[];
};

/**
 * Compara a safra mais recente (abr a mar, em andamento ou não) com o mesmo
 * intervalo de meses da safra imediatamente anterior, mês a mês.
 */
export function compararComSafraAnterior(meses: MesRegistro[]): ComparativoSafra | null {
  const safras = agruparPorSafra(meses);
  if (safras.length < 2) return null;

  const atual = safras[safras.length - 1]!;
  const anterior = safras.find((s) => s.anoInicio === atual.anoInicio - 1);
  if (!anterior) return null;

  const ultimoIndice = atual.meses[atual.meses.length - 1]?.indice ?? 0;
  if (!anterior.meses.some((m) => m.indice <= ultimoIndice)) return null;

  const serie = Array.from({ length: 12 }, (_, i) => {
    const indice = i + 1;
    const mAtual = atual.meses.find((m) => m.indice === indice);
    const mAnterior = anterior.meses.find((m) => m.indice === indice);
    return {
      rotulo: rotuloMesSafra(indice),
      indice,
      faturamentoAtual: mAtual ? mAtual.faturamento : null,
      faturamentoAnterior: mAnterior ? mAnterior.faturamento : null,
      aReceberAtual: mAtual?.aReceber ?? null,
      aReceberAnterior: mAnterior?.aReceber ?? null,
      inadimplenciaAtual: mAtual?.inadimplencia ?? null,
      inadimplenciaAnterior: mAnterior?.inadimplencia ?? null,
    };
  }).filter(
    (m) =>
      m.faturamentoAtual !== null ||
      m.faturamentoAnterior !== null ||
      m.aReceberAtual !== null ||
      m.aReceberAnterior !== null ||
      m.inadimplenciaAtual !== null ||
      m.inadimplenciaAnterior !== null,
  );

  return { atual, anterior, ultimoIndice, serie };
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const limpo = v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const n = Number(limpo);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function chaveMesDeAbrev(texto: string): string | null {
  const m = String(texto).trim().toLowerCase().match(/^([a-zç]{3})\/(\d{2,4})$/);
  if (!m) return null;
  const i = MESES_PT.indexOf(m[1] ?? "");
  if (i < 0) return null;
  const bruto = m[2] ?? "";
  const ano = bruto.length === 2 ? `20${bruto}` : bruto;
  return `${ano}-${String(i + 1).padStart(2, "0")}`;
}

type Linha = Record<string, unknown>;

function lerAba(wb: XLSX.WorkBook, nome: string): Linha[] {
  const ws = wb.Sheets[nome];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Linha>(ws, { defval: null });
}

/**
 * Lê uma ou mais planilhas no mesmo formato do modelo do Power BI
 * (abas F_Vendas / F_Carteira / D_Clientes e/ou Base_Dados) e devolve
 * os indicadores já calculados para o painel.
 */
export function analisarPlanilhas(
  arquivos: { nome: string; buffer: ArrayBuffer }[],
): PainelDados {
  const vendas: Linha[] = [];
  const carteira: Linha[] = [];
  const clientes: Linha[] = [];
  const baseResumo: Linha[] = [];

  for (const arq of arquivos) {
    const wb = XLSX.read(arq.buffer, { type: "array", cellDates: true });
    vendas.push(...lerAba(wb, "F_Vendas"));
    carteira.push(...lerAba(wb, "F_Carteira"));
    clientes.push(...lerAba(wb, "D_Clientes"));
    baseResumo.push(...lerAba(wb, "Base_Dados"));
  }

  if (!vendas.length && !baseResumo.length) {
    throw new Error(
      "Não encontrei as abas esperadas (F_Vendas, F_Carteira, D_Clientes ou Base_Dados) na planilha enviada.",
    );
  }

  // Faturamento mensal por tipo de produto
  const porMes = new Map<string, { matrizes: number; touros: number }>();
  for (const l of vendas) {
    let chave = l["PeriodoMes"] ? String(l["PeriodoMes"]).slice(0, 7) : null;
    if (!chave && l["DataFaturamento"]) {
      const d = new Date(l["DataFaturamento"] as string);
      if (!Number.isNaN(d.getTime()))
        chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    if (!chave) continue;
    const atual = porMes.get(chave) ?? { matrizes: 0, touros: 0 };
    const valor = num(l["ValorFaturado"]);
    if (String(l["TipoProduto"] ?? "").toLowerCase().startsWith("matriz")) atual.matrizes += valor;
    else atual.touros += valor;
    porMes.set(chave, atual);
  }

  // Carteira / inadimplência mensal vinda do resumo executivo
  const resumoPorMes = new Map<string, { aReceber: number; inadimplencia: number }>();
  for (const l of baseResumo) {
    const chave = chaveMesDeAbrev(String(l["Meses"] ?? ""));
    if (!chave) continue;
    resumoPorMes.set(chave, {
      aReceber: num(l["Total a Receber"]),
      inadimplencia: num(l["Inadimplência"] ?? l["Inadimplencia"]),
    });
    if (!porMes.has(chave) && l["Faturamento Total"] != null) {
      porMes.set(chave, {
        matrizes: num(l["Matrizes"]),
        touros: num(l["Touros"]),
      });
    }
  }

  const chaves = Array.from(new Set([...porMes.keys(), ...resumoPorMes.keys()])).sort();
  const meses: MesRegistro[] = chaves.map((mes) => {
    const f = porMes.get(mes) ?? { matrizes: 0, touros: 0 };
    const r = resumoPorMes.get(mes);
    return {
      mes,
      matrizes: f.matrizes,
      touros: f.touros,
      faturamento: f.matrizes + f.touros,
      aReceber: r?.aReceber ?? null,
      inadimplencia: r?.inadimplencia ?? null,
    };
  });

  // Aging da carteira
  const aging = new Map<string, { valor: number; titulos: number }>();
  const devedores = new Map<string, number>();
  const agingClientes = new Map<string, Record<string, number>>();
  for (const l of carteira) {
    const faixa = String(l["FaixaAtraso"] ?? "Em Dia");
    const valor = num(l["ValorLiquido"]);
    const atual = aging.get(faixa) ?? { valor: 0, titulos: 0 };
    atual.valor += valor;
    atual.titulos += 1;
    aging.set(faixa, atual);
    if (String(l["StatusTitulo"] ?? "") === "Em Atraso") {
      const nome = String(l["ClientePadrao"] ?? l["Cliente"] ?? "—").trim();
      devedores.set(nome, (devedores.get(nome) ?? 0) + valor);
    }
    const nomeCliente = String(l["ClientePadrao"] ?? l["Cliente"] ?? "—").trim();
    const faixasCliente = agingClientes.get(nomeCliente) ?? {};
    faixasCliente[faixa] = (faixasCliente[faixa] ?? 0) + valor;
    agingClientes.set(nomeCliente, faixasCliente);
  }
  const agingLista = ORDEM_FAIXAS.filter((f) => aging.has(f)).map((faixa) => ({
    faixa,
    valor: aging.get(faixa)!.valor,
    titulos: aging.get(faixa)!.titulos,
  }));

  const aVencer = aging.get("Em Dia")?.valor ?? 0;
  const emAtraso = agingLista
    .filter((a) => a.faixa !== "Em Dia")
    .reduce((s, a) => s + a.valor, 0);

  const topClientes = clientes
    .map((l) => ({
      nome: String(l["ClienteExibicao"] ?? l["ClientePadrao"] ?? "—").trim(),
      faturado: num(l["ValorFaturadoTotal"]),
      carteira: num(l["ValorCarteiraTotal"]),
    }))
    .sort((a, b) => b.faturado - a.faturado)
    .slice(0, 20);

  const topDevedores = Array.from(devedores.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 20);

  const agingPorCliente = Array.from(agingClientes.entries())
    .map(([nome, faixas]) => ({
      nome,
      faixas,
      total: ORDEM_FAIXAS.reduce((s, f) => s + (faixas[f] ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total);

  const faturamentoTotal = meses.reduce((s, m) => s + m.faturamento, 0);
  const mesesComVenda = meses.filter((m) => m.faturamento > 0).length || 1;
  const carteiraTotal = aVencer + emAtraso;

  return {
    periodo: { inicio: chaves[0] ?? "", fim: chaves[chaves.length - 1] ?? "" },
    meses,
    kpis: {
      faturamentoTotal,
      faturamentoMedio: faturamentoTotal / mesesComVenda,
      carteiraTotal,
      emAtraso,
      aVencer,
      pctInadimplencia: carteiraTotal ? emAtraso / carteiraTotal : 0,
      clientes: clientes.length,
      titulos: carteira.length,
    },
    aging: agingLista,
    topClientes,
    topDevedores,
    agingPorCliente,
    fonte: arquivos.map((a) => a.nome).join(" + "),
  };
}
