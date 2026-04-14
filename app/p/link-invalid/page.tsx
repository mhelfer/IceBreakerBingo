import { AlertTriangle } from "lucide-react";
import { PlayerHero } from "../PlayerHero";

export default function LinkInvalidPage() {
  return (
    <PlayerHero
      icon={<AlertTriangle size={22} />}
      tone="warning"
      eyebrow="Link out of date"
      title="This link can't be used"
      body={
        <p>
          Ask your facilitator for a fresh one — personal links can be rotated
          if they get shared or leaked.
        </p>
      }
    />
  );
}
