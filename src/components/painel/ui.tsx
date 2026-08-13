import type { ReactNode } from "react";

export function Secao({
  titulo,
  descricao,
  children,
  acao,
}: {
  titulo: string;
  descricao?: string | undefined;
  children: ReactNode;
  acao?: ReactNode | undefined;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_0_var(--color-border)] sm:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg text-foreground sm:text-xl">{titulo}</h2>
          {descricao ? (
            <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
          ) : null}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string;
  detalhe?: string | undefined;
  tom?: "neutro" | "positivo" | "alerta" | "aviso" | undefined;
}) {
  const cor =
    tom === "alerta"
      ? "text-destructive"
      : tom === "aviso"
        ? "text-[var(--color-chart-2)]"
        : tom === "positivo"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {rotulo}
      </p>
      <p className={`mt-3 font-display text-2xl font-semibold sm:text-3xl ${cor}`}>{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}
