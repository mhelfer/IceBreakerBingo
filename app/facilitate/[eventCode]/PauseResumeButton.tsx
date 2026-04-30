"use client";

import { Pause, Play } from "lucide-react";
import { pauseGame, resumeGame } from "../../admin/[eventCode]/actions";
import { SubmitButton } from "@/app/components/ui/SubmitButton";

export function PauseResumeButton({
  eventCode,
  paused,
}: {
  eventCode: string;
  paused: boolean;
}) {
  const action = paused ? resumeGame : pauseGame;
  return (
    <form action={action.bind(null, eventCode)}>
      <SubmitButton variant="secondary" size="md">
        {paused ? (
          <>
            <Play size={12} /> Resume
          </>
        ) : (
          <>
            <Pause size={12} /> Pause
          </>
        )}
      </SubmitButton>
    </form>
  );
}
