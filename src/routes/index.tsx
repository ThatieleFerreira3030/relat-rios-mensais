import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Kpi, Secao } from "@/components/painel/ui";
import {
  brl,
  compararComSafraAnterior,
  pct,
  rotuloMes,
  rotuloMesSafra,
  type PainelUpload,
  type SafraSerieMes,
} from "@/lib/painel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel Financeiro — Faturamento e Inadimplência" },
      {
        name: "description",
        content:
          "Acompanhe mensalmente o faturamento de matrizes e touros, a carteira de clientes e a inadimplência em um painel atualizado por planilha.",
      },
      { property: "og:title", content: "Painel Financeiro — Faturamento e Inadimplência" },
      {
        property: "og:description",
        content:
          "Faturamento mensal, carteira, aging e ranking de clientes em um painel público atualizado por upload de Excel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Painel,
});

const MESES_EVOLUCAO = 12;

async function buscarUltimo() {
  const { data, error } = await supabase
    .from("painel_uploads")
    .select("id, criado_em, rotulo, fonte, dados")
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as PainelUpload | null;
}

function Painel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["painel-ultimo"],
    queryFn: buscarUltimo,
  });
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);

  const dados = data?.dados;

  const serie = useMemo(
    () =>
      (dados?.meses ?? []).map((m) => ({
        ...m,
        rotulo: rotuloMes(m.mes),
        pctInad: m.aReceber && m.inadimplencia ? m.inadimplencia / m.aReceber : null,
      })),
    [dados],
  );

  const mesAtual = useMemo(() => {
    if (!serie.length) return null;
    return serie.find((m) => m.mes === mesSelecionado) ?? serie[serie.length - 1]!;
  }, [serie, mesSelecionado]);

  const mesAnterior = useMemo(() => {
    if (!mesAtual) return null;
    const i = serie.findIndex((m) => m.mes === mesAtual.mes);
    return i > 0 ? serie[i - 1]! : null;
  }, [serie, mesAtual]);

  const variacao =
    mesAtual && mesAnterior && mesAnterior.faturamento
      ? mesAtual.faturamento / mesAnterior.faturamento - 1
      : null;

  const comparativoSafra = useMemo(
    () => (dados ? compararComSafraAnterior(dados.meses) : null),
    [dados],
  );

  const serieRecente = useMemo(() => serie.slice(-MESES_EVOLUCAO), [serie]);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent-foreground">
          Relatório mensal
        </p>
        <h1 className="mt-2 text-3xl text-foreground sm:text-4xl">
          Faturamento &amp; Inadimplência
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {dados
            ? `Período de ${rotuloMes(dados.periodo.inicio)} a ${rotuloMes(dados.periodo.fim)} · base: ${data?.rotulo}`
            : "Carregando os indicadores mais recentes…"}
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando painel…</p>
      ) : error ? (
        <p className="text-sm text-destructive">Não foi possível carregar os dados.</p>
      ) : !dados ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma base publicada ainda.
          </p>
          <Link
            to="/enviar"
            className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Enviar planilha
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              rotulo="Faturamento do período"
              valor={brl(dados.kpis.faturamentoTotal)}
              detalhe={`Média mensal de ${brl(dados.kpis.faturamentoMedio)}`}
              tom="positivo"
            />
            <Kpi
              rotulo="Carteira a receber"
              valor={brl(dados.kpis.carteiraTotal)}
              detalhe={`${dados.kpis.titulos.toLocaleString("pt-BR")} títulos · ${dados.kpis.clientes} clientes`}
            />
            <Kpi
              rotulo="Em atraso"
              valor={brl(dados.kpis.emAtraso)}
              detalhe={`A vencer: ${brl(dados.kpis.aVencer)}`}
              tom="alerta"
            />
            <Kpi
              rotulo="% Inadimplência"
              valor={pct(dados.kpis.pctInadimplencia)}
              detalhe="Vencido sobre a carteira total"
              tom="alerta"
            />
          </div>

          {comparativoSafra ? (
            <Secao
              titulo={`Safra ${comparativoSafra.atual.rotulo} vs. safra ${comparativoSafra.anterior.rotulo}`}
              descricao={`Safra de abril a março: o que já foi realizado de ${rotuloMesSafra(1)} a ${rotuloMesSafra(comparativoSafra.ultimoIndice)} frente ao mesmo intervalo da safra anterior.`}
            >
              <div className="space-y-8">
                <GraficoComparativoSafra
                  titulo="Faturamento"
                  dados={comparativoSafra.serie}
                  chaveAtual="faturamentoAtual"
                  chaveAnterior="faturamentoAnterior"
                  nomeAtual={`Safra ${comparativoSafra.atual.rotulo}`}
                  nomeAnterior={`Safra ${comparativoSafra.anterior.rotulo}`}
                />
                <GraficoComparativoSafra
                  titulo="Carteira a receber"
                  dados={comparativoSafra.serie}
                  chaveAtual="aReceberAtual"
                  chaveAnterior="aReceberAnterior"
                  nomeAtual={`Safra ${comparativoSafra.atual.rotulo}`}
                  nomeAnterior={`Safra ${comparativoSafra.anterior.rotulo}`}
                />
                <GraficoComparativoSafra
                  titulo="Inadimplência"
                  dados={comparativoSafra.serie}
                  chaveAtual="inadimplenciaAtual"
                  chaveAnterior="inadimplenciaAnterior"
                  nomeAtual={`Safra ${comparativoSafra.atual.rotulo}`}
                  nomeAnterior={`Safra ${comparativoSafra.anterior.rotulo}`}
                />
              </div>
            </Secao>
          ) : null}

          <Secao
            titulo="Destaque do mês"
            descricao="Escolha o mês para ver o fechamento e a variação em relação ao mês anterior."
            acao={
              <select
                value={mesAtual?.mes ?? ""}
                onChange={(e) => setMesSelecionado(e.target.value)}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {serie.map((m) => (
                  <option key={m.mes} value={m.mes}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            }
          >
            {mesAtual ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi rotulo="Faturamento" valor={brl(mesAtual.faturamento)} tom="positivo" />
                <Kpi
                  rotulo="Variação M/M (Faturamento)"
                  valor={variacao === null ? "—" : pct(variacao)}
                  detalhe={mesAnterior ? `vs. ${mesAnterior.rotulo}` : undefined}
                  tom={variacao !== null && variacao < 0 ? "alerta" : "positivo"}
                />
                <Kpi rotulo="Total a receber" valor={brl(mesAtual.aReceber)} />
                <Kpi
                  rotulo="Inadimplência"
                  valor={brl(mesAtual.inadimplencia)}
                  detalhe={mesAtual.pctInad ? `${pct(mesAtual.pctInad)} da carteira` : undefined}
                  tom="alerta"
                />
              </div>
            ) : null}
          </Secao>

          <Secao
            titulo="Evolução mensal"
            descricao={`Faturamento por tipo de produto e evolução da inadimplência nos últimos ${MESES_EVOLUCAO} meses.`}
          >
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={serieRecente}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="rotulo" fontSize={12} stroke="var(--color-muted-foreground)" />
                  <YAxis
                    yAxisId="left"
                    fontSize={12}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(v: number) => brl(v, true)}
                    width={80}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    fontSize={12}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(v: number) => brl(v, true)}
                    width={80}
                  />
                  <Tooltip
                    formatter={(v, nome) => [brl(Number(v)), String(nome)] as [string, string]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-card)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="matrizes"
                    name="Matrizes"
                    stackId="f"
                    fill="var(--color-chart-1)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="touros"
                    name="Touros"
                    stackId="f"
                    fill="var(--color-chart-2)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="inadimplencia"
                    name="Inadimplência"
                    stroke="var(--color-chart-3)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Secao>

          <div className="grid gap-6 lg:grid-cols-2">
            <Secao titulo="Carteira por faixa de atraso" descricao="Aging dos títulos a receber.">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.aging} layout="vertical" margin={{ left: 12, right: 16 }}>
                    <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                    <XAxis
                      type="number"
                      fontSize={12}
                      stroke="var(--color-muted-foreground)"
                      tickFormatter={(v: number) => brl(v, true)}
                    />
                    <YAxis
                      type="category"
                      dataKey="faixa"
                      fontSize={12}
                      width={70}
                      stroke="var(--color-muted-foreground)"
                    />
                    <Tooltip
                      formatter={(v) => brl(Number(v))}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-card)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="valor" name="Valor" radius={[0, 6, 6, 0]}>
                      {dados.aging.map((a) => (
                        <Cell
                          key={a.faixa}
                          fill={
                            a.faixa === "Em Dia" ? "var(--color-chart-1)" : "var(--color-chart-3)"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Secao>

            <Secao titulo="Maiores inadimplentes" descricao="Títulos vencidos por cliente.">
              <ol className="divide-y divide-border text-sm">
                {dados.topDevedores.slice(0, 10).map((d, i) => (
                  <li key={d.nome + i} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="truncate text-foreground">
                      <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                      {d.nome}
                    </span>
                    <span className="shrink-0 font-medium text-destructive">{brl(d.valor)}</span>
                  </li>
                ))}
              </ol>
            </Secao>
          </div>

          <Secao titulo="Maiores clientes" descricao="Ranking por valor faturado no período.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">#</th>
                    <th className="py-2 pr-4 font-medium">Cliente</th>
                    <th className="py-2 pr-4 text-right font-medium">Faturado</th>
                    <th className="py-2 text-right font-medium">Em carteira</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dados.topClientes.slice(0, 15).map((c, i) => (
                    <tr key={c.nome + i}>
                      <td className="py-2.5 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 pr-4">{c.nome}</td>
                      <td className="py-2.5 pr-4 text-right font-medium">{brl(c.faturado)}</td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {brl(c.carteira)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Secao>

          <Secao titulo="Tabela mensal" descricao="Fechamento mês a mês do período analisado.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Mês</th>
                    <th className="py-2 pr-4 text-right font-medium">Matrizes</th>
                    <th className="py-2 pr-4 text-right font-medium">Touros</th>
                    <th className="py-2 pr-4 text-right font-medium">Faturamento</th>
                    <th className="py-2 pr-4 text-right font-medium">A receber</th>
                    <th className="py-2 pr-4 text-right font-medium">Inadimplência</th>
                    <th className="py-2 text-right font-medium">% Inad.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {serie.map((m) => (
                    <tr key={m.mes}>
                      <td className="py-2.5 pr-4 font-medium">{m.rotulo}</td>
                      <td className="py-2.5 pr-4 text-right">{brl(m.matrizes)}</td>
                      <td className="py-2.5 pr-4 text-right">{brl(m.touros)}</td>
                      <td className="py-2.5 pr-4 text-right font-medium">{brl(m.faturamento)}</td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">
                        {brl(m.aReceber)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-destructive">
                        {brl(m.inadimplencia)}
                      </td>
                      <td className="py-2.5 text-right">{pct(m.pctInad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Secao>

          <p className="text-xs text-muted-foreground">
            Fonte: {dados.fonte} · publicado em{" "}
            {data ? new Date(data.criado_em).toLocaleDateString("pt-BR") : "—"}
          </p>
        </div>
      )}
    </main>
  );
}

function GraficoComparativoSafra({
  titulo,
  dados,
  chaveAtual,
  chaveAnterior,
  nomeAtual,
  nomeAnterior,
}: {
  titulo: string;
  dados: SafraSerieMes[];
  chaveAtual: keyof SafraSerieMes;
  chaveAnterior: keyof SafraSerieMes;
  nomeAtual: string;
  nomeAnterior: string;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-foreground">{titulo}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="rotulo" fontSize={12} stroke="var(--color-muted-foreground)" />
            <YAxis
              fontSize={12}
              stroke="var(--color-muted-foreground)"
              tickFormatter={(v: number) => brl(v, true)}
              width={80}
            />
            <Tooltip
              formatter={(v, nome) => [brl(Number(v)), String(nome)] as [string, string]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--color-border)",
                background: "var(--color-card)",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey={chaveAnterior}
              name={nomeAnterior}
              fill="var(--color-chart-2)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey={chaveAtual}
              name={nomeAtual}
              fill="var(--color-chart-1)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
