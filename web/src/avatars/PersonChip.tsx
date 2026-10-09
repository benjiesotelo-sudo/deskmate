import { AvatarHead } from "./Avatar.tsx";
import type { AvatarTokens } from "./tokens.ts";

type Props = {
  person?: { id: string; name: string; role?: string; avatar?: Partial<AvatarTokens> };
  fallbackId?: string;
  size?: number;
  showRole?: boolean;
  tone?: "paper" | "stage";
};

// A head and a name. When a person id no longer resolves, the id is shown as it is.
export function PersonChip({ person, fallbackId = "", size = 26, showRole = false, tone = "paper" }: Props) {
  const seed = person?.id ?? fallbackId ?? "unknown";
  return (
    <span className={`person-chip person-chip-${tone}`}>
      <AvatarHead avatar={person?.avatar} seed={seed} size={size} />
      <span className="person-chip-text">
        <span className="person-chip-name">{person?.name ?? (fallbackId || "Nobody yet")}</span>
        {showRole && person?.role ? <span className="person-chip-role">{person.role}</span> : null}
      </span>
    </span>
  );
}
