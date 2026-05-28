export type OrderStepHeaderProps = {
  title: string;
  subtitle?: string;
  step?: { current: number; total: number; label?: string };
  className?: string;
};

export function OrderStepHeader({
  title,
  subtitle,
  step,
  className = "",
}: OrderStepHeaderProps) {
  return (
    <header className={`mb-6 ${className}`}>
      {step && (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6B7280]">
          Step {step.current} of {step.total}
          {step.label ? ` — ${step.label}` : ""}
        </p>
      )}
      <h1 className="text-2xl font-semibold tracking-tight text-[#111111]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>
      )}
    </header>
  );
}
