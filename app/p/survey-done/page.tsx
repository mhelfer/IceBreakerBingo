import { CheckCircle2 } from "lucide-react";
import { PlayerHero } from "../PlayerHero";

export default function SurveyDonePage() {
  return (
    <PlayerHero
      icon={<CheckCircle2 size={22} />}
      eyebrow="Survey submitted"
      title="You're in"
      body={
        <p>
          Thanks — your answers are saved. Come back to this link when the
          facilitator starts the game.
        </p>
      }
      footer="Tip: keep this tab pinned so you can jump back in quickly."
    />
  );
}
