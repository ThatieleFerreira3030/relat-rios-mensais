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

  async function lerArquivos(lista: FileList | null) {
    setErro(null);
    setPrevia(null);
    if (!lista || !lista.length) return;
    setOcupado(true);
    try {
      const arquivos = await Promise.all(
        Array.from(lista).map(async (f) => ({ nome: f.name, buffer: await f.arrayBuffer() })),
      );
      const dados = analisarPlanilhas(arquivos);
      setPrevia(dados);
      if (!rotulo && dados.periodo.fim) {
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
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent-foreground">
          Atualização mensal
        </p>
        <h1 className="mt-2 text-3xl text-foreground">Enviar planilha do mês</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Envie a planilha estruturada (abas <strong>F_Vendas</strong>, <strong>F_Carteira</strong>,{" "}
          <strong>D_Clientes</strong>) e, se quiser, o resumo com a aba <strong>Base_Dados</strong>.
          Os indicadores são calculados no seu navegador e publicados no painel.
        </p>
      </header>

      <div className="space-y-6">
        <Secao titulo="1. Selecione os arquivos" descricao="Aceita .xlsx — pode enviar os dois de uma vez.">
          <input
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={(e) => lerArquivos(e.target.files)}
            className="block w-full cursor-pointer rounded-xl border border-dashed border-input bg-background p-4 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
          />
          {erro ? <p className="mt-3 text-sm text-destructive">{erro}</p> : null}
        </Secao>

        {previa ? (
          <>
            <Secao titulo="2. Confira a leitura" descricao="Resumo do que foi identificado nos arquivos.">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Período</dt>
                  <dd className="mt-1 text-sm font-medium">
                    {rotuloMes(previa.periodo.inicio)} a {rotuloMes(previa.periodo.fim)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">Meses</dt>
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
              </dl>
            </Secao>

            <Secao titulo="3. Publicar" descricao="O painel passa a exibir esta base como a mais recente.">
              <label className="block text-sm">
                <span className="text-muted-foreground">Nome desta atualização</span>
                <input
                  value={rotulo}
                  onChange={(e) => setRotulo(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Fechamento mai/26"
                />
              </label>
              <button
                onClick={publicar}
                disabled={ocupado}
                className="mt-4 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {ocupado ? "Publicando…" : "Publicar no painel"}
              </button>
            </Secao>
          </>
        ) : null}
      </div>
    </main>
  );
}
