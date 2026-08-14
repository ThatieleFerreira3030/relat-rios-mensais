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
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm shadow-black/[0.03] sm:p-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-2 inline-block size-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <div>
            <h2 className="font-sans text-lg font-semibold text-foreground sm:text-xl">{titulo}</h2>
            {descricao ? <p className="mt-1 text-sm text-muted-foreground">{descricao}</p> : null}
          </div>
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

const TOM_CLASSES = {
  neutro: {
    texto: "text-foreground",
    barra: "bg-foreground/70",
    preenchido: "bg-foreground text-background",
  },
  positivo: {
    texto: "text-primary",
    barra: "bg-primary",
    preenchido: "bg-primary text-primary-foreground",
  },
  aviso: {
    texto: "text-accent",
    barra: "bg-accent",
    preenchido: "bg-accent text-accent-foreground",
  },
  alerta: {
    texto: "text-destructive",
    barra: "bg-destructive",
    preenchido: "bg-destructive text-destructive-foreground",
  },
} as const;

export function Kpi({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string | undefined;
  tom?: keyof typeof TOM_CLASSES | undefined;
  destaque?: boolean | undefined;
}) {
  const classes = TOM_CLASSES[tom];

  if (destaque) {
    return (
      <div className={`rounded-3xl p-5 shadow-md shadow-black/10 ${classes.preenchido}`}>
        <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{rotulo}</p>
        <p className="mt-3 font-display text-2xl font-semibold sm:text-3xl">{valor}</p>
        {detalhe ? <p className="mt-1 text-xs opacity-80">{detalhe}</p> : null}
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 pt-6 shadow-sm shadow-black/[0.02] transition-shadow hover:shadow-md hover:shadow-black/[0.06]">
      <span className={`absolute inset-x-0 top-0 h-1 ${classes.barra}`} aria-hidden />
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {rotulo}
      </p>
      <p className={`mt-3 font-display text-2xl font-semibold sm:text-3xl ${classes.texto}`}>
        {valor}
      </p>
      {detalhe ? <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}
