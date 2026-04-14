"use client";

import { Plus } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Dialog } from "@/app/components/ui/Dialog";
import { Input, Label } from "@/app/components/ui/Input";
import { createEvent } from "./actions";

export function NewEventDialog() {
  return (
    <Dialog
      title="New event"
      description="Give it a name and an optional start time — you can keep editing everything later."
      trigger={(open) => (
        <Button type="button" variant="primary" size="md" onClick={open}>
          <Plus size={14} /> New event
        </Button>
      )}
    >
      {(close) => (
        <form
          action={createEvent}
          className="flex flex-col gap-4"
          onSubmit={() => setTimeout(close, 0)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-event-name">Name</Label>
            <Input
              id="new-event-name"
              name="name"
              required
              maxLength={120}
              placeholder="Q2 Eng Offsite"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-event-starts">
              Starts at <span className="text-zinc-400">(optional)</span>
            </Label>
            <Input
              id="new-event-starts"
              name="starts_at"
              type="datetime-local"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create event
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
