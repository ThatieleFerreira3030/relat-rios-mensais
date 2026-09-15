import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Secao } from "@/components/painel/ui";
import { analisarPlanilhas, rotuloMes, type PainelDados } from "@/lib/painel";

export const Route = createFileRoute("/enviar")({
  head: () => ({
    meta: [
      { title: "Enviar planilha do mês — Painel Financeiro" },
      {
        name: "description",
        content:
          "Envie a planilha mensal de faturamento e carteira para atualizar automaticamente os indicadores do painel.",
      },
      { property: "og:title", content: "Enviar planilha do mês — Painel Financeiro" },
      {
        property: "og:description",
        content: "Atualize o painel financeiro enviando as planilhas de faturamento e carteira.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Enviar,
});

function Enviar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rotulo, setRotulo] = useState("");
  const [previa, setPrevia] = useState<PainelDados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [tipoImportacao, setTipoImportacao] = useState<"financeiro" | "cobranca" | null>(null);

  async function lerArquivos(
    lista: FileList | null,
    tipo: "financeiro" | "cobranca",
  ) {
    setErro(null);
    setPrevia(null);
    setTipoImportacao(tipo);
    if (!lista || !lista.length) return;
    setOcupado(true);
    try {
      const arquivos = await Promise.all(
        Array.from(lista).map(async (f) => ({ nome: f.name, buffer: await f.arrayBuffer() })),
      );
      const { data: baseAtual, error: erroBaseAtual } = await supabase
        .from("painel_uploads")
        .select("dados")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (erroBaseAtual) throw erroBaseAtual;

      const dados = analisarPlanilhas(
        arquivos,
        baseAtual?.dados as unknown as PainelDados | undefined,
      );
      setPrevia(dados);
      if (tipo === "cobranca") {
        setRotulo(
          `Atualização de cobrança ${new Date().toLocaleDateString("pt-BR")}`,
        );
      } else if (!rotulo && dados.periodo.fim) {
        setRotulo(`Fechamento ${rotuloMes(dados.periodo.fim)}`);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler a planilha.");
    } finally {
      setOcupado(false);
    }
  }

  async function publicar() {
    if (!previa) return;
    setOcupado(true);
    setErro(null);
    const { error } = await supabase.from("painel_uploads").insert({
      rotulo: rotulo || `Fechamento ${rotuloMes(previa.periodo.fim)}`,
      fonte: previa.fonte,
      dados: JSON.parse(JSON.stringify(previa)),
    });
    setOcupado(false);
    if (error) {
      setErro("Não foi possível publicar os dados. Tente novamente.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["painel-ultimo"] });
    navigate({ to: "/" });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <header className="mb-8">
        <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground">
          Atualização do painel
        </span>
        <h1 className="mt-3 text-3xl text-foreground">Importar planilhas</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha abaixo o tipo de atualização. A posição de inadimplentes pode
          ser importada separadamente e não altera os valores financeiros do
          painel.
        </p>
      </header>

      <div className="space-y-6">
        <Secao
          titulo="1. Dados financeiros"
          descricao="Atualize faturamento, carteira e indicadores pelas abas F_Vendas, F_Carteira, D_Clientes e Base_Dados."
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => lerArquivos(e.target.files, "financeiro")}
            disabled={ocupado}
            className="block w-full cursor-pointer rounded-xl border border-dashed border-input bg-background p-4 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          />
          {tipoImportacao === "financeiro" && erro ? (
            <p className="mt-3 text-sm text-destructive">{erro}</p>
          ) : null}
        </Secao>

        <Secao
          titulo="2. Posição de inadimplentes"
          descricao="Importe a planilha com as colunas Cliente, Observação e Responsável. Vencimentos e valores desse arquivo serão ignorados."
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => lerArquivos(e.target.files, "cobranca")}
            disabled={ocupado}
            className="block w-full cursor-pointer rounded-xl border border-dashed border-input bg-background p-4 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            O site localizará automaticamente o cabeçalho, mesmo que ele não
            esteja na primeira linha da planilha.
          </p>
          {tipoImportacao === "cobranca" && erro ? (
            <p className="mt-3 text-sm text-destructive">{erro}</p>
          ) : null}
        </Secao>

        {previa ? (
          <>
            <Secao
              titulo="3. Confira a leitura"
              descricao={
                tipoImportacao === "cobranca"
                  ? "Confira as situações identificadas antes de atualizar os balões."
                  : "Resumo dos dados financeiros identificados."
              }
            >
              {tipoImportacao === "cobranca" ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium text-foreground">
                    {(previa.situacoesCobranca ?? []).length.toLocaleString("pt-BR")} clientes
                    com situação de cobrança identificada
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Responsável e observação serão exibidos nos balões. Os valores
                    financeiros atuais permanecerão inalterados.
                  </p>
                </div>
              ) : (
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                      Período
                    </dt>
                    <dd className="mt-1 text-sm font-medium">
                      {rotuloMes(previa.periodo.inicio)} a {rotuloMes(previa.periodo.fim)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                      Meses
                    </dt>
                    <dd className="mt-1 text-sm font-medium">{previa.meses.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                      Títulos em carteira
                    </dt>
                    <dd className="mt-1 text-sm font-medium">
                      {previa.kpis.titulos.toLocaleString("pt-BR")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                      Clientes
                    </dt>
                    <dd className="mt-1 text-sm font-medium">{previa.kpis.clientes}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                      Situações preservadas
                    </dt>
                    <dd className="mt-1 text-sm font-medium">
                      {(previa.situacoesCobranca ?? []).length.toLocaleString("pt-BR")} clientes
                    </dd>
                  </div>
                </dl>
              )}
            </Secao>

            <Secao
              titulo="4. Publicar"
              descricao={
                tipoImportacao === "cobranca"
                  ? "Após publicar, os balões serão atualizados nas duas visões do painel."
                  : "O painel passará a exibir esta base financeira como a mais recente."
              }
            >
              <label className="block text-sm">
                <span className="text-muted-foreground">Nome desta atualização</span>
                <input
                  value={rotulo}
                  onChange={(e) => setRotulo(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder={
                    tipoImportacao === "cobranca"
                      ? "Atualização de cobrança"
                      : "Fechamento mai/26"
                  }
                />
              </label>
              <button
                onClick={publicar}
                disabled={ocupado}
                className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {ocupado
                  ? "Publicando…"
                  : tipoImportacao === "cobranca"
                    ? "Atualizar balões no painel"
                    : "Publicar dados financeiros"}
              </button>
            </Secao>
          </>
        ) : null}
      </div>
    </main>
  );
}
