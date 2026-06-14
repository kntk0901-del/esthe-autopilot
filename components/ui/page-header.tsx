import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[#d9654f]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#17202a] md:text-[2.1rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6e746f]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
