import type { ReactNode } from "react";

import { classNames } from "@/lib/format";

interface SectionCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const SectionCard = ({
  title,
  description,
  action,
  children,
  className,
}: SectionCardProps) => (
  <section className={classNames("card", className)}>
    <div className="card-heading">
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="card-action">{action}</div> : null}
    </div>
    {children}
  </section>
);

interface MetricCardProps {
  label: string;
  value: string;
  caption?: string;
  tone?: "olive" | "rust" | "sand" | "forest";
}

export const MetricCard = ({
  label,
  value,
  caption,
  tone = "olive",
}: MetricCardProps) => (
  <article className={classNames("metric-card", `tone-${tone}`)}>
    <span>{label}</span>
    <strong>{value}</strong>
    {caption ? <p>{caption}</p> : null}
  </article>
);

export const StatusPill = ({
  value,
  tone = "neutral",
}: {
  value: string;
  tone?: "neutral" | "good" | "warn" | "alert";
}) => (
  <span className={classNames("status-pill", `status-${tone}`)}>{value}</span>
);
