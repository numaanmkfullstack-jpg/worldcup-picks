import { flagForCode, flagImageForCode } from "@/lib/flags";

type FlagBadgeProps = {
  code: string | null;
  name: string;
};

export function FlagBadge({ code, name }: FlagBadgeProps) {
  const imageUrl = flagImageForCode(code);
  const label = code ?? "TBD";

  return (
    <span className="flag" aria-label={`${name} flag`} title={name}>
      {imageUrl ? <span aria-hidden="true" className="flag-image" style={{ backgroundImage: `url(${imageUrl})` }} /> : <span className="flag-emoji">{flagForCode(code)}</span>}
      <span className="flag-code">{label}</span>
    </span>
  );
}
