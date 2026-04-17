"use client";

import { Square } from "lucide-react";
import { endGame } from "../../admin/[eventCode]/actions";
import { SubmitButton } from "@/app/components/ui/SubmitButton";

export function EndGameButton({ eventCode }: { eventCode: string }) {
  return (
    <form
      action={endGame.bind(null, eventCode)}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "End the game? Cards will freeze and end-of-game prizes will be computed.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <SubmitButton
        variant="danger"
        size="md"
      >
        <Square size={12} /> End game
      </SubmitButton>
    </form>
  );
}
