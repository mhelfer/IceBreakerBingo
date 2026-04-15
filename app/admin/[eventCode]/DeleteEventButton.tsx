"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Dialog } from "@/app/components/ui/Dialog";
import { deleteEvent } from "@/app/admin/actions";

export function DeleteEventButton({
  eventCode,
  eventName,
}: {
  eventCode: string;
  eventName: string;
}) {
  return (
    <Dialog
      size="sm"
      title="Delete event"
      description={`"${eventName}" and all its data will be permanently removed.`}
      trigger={(open) => (
        <Button type="button" variant="danger" size="md" onClick={open}>
          <Trash2 size={14} /> Delete
        </Button>
      )}
    >
      {(close) => (
        <form
          action={deleteEvent.bind(null, eventCode)}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-zinc-600">
            This cannot be undone. Players, survey responses, cards, claims, and
            bingo records will all be deleted.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Delete event
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
