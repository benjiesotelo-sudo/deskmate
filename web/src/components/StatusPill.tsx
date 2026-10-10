const LABEL: Record<string, string> = { current: "Current", draft: "Draft", superseded: "Superseded", missing: "Missing" };

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status}`}>{LABEL[status] ?? status}</span>;
}
