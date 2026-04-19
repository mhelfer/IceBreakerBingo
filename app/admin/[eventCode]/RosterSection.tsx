"use client";

import { CheckCircle2, Clock, Download, Plus, Shuffle, Upload, Users } from "lucide-react";
import { Banner } from "@/app/components/ui/Banner";
import { buttonClass, Button } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { Dialog } from "@/app/components/ui/Dialog";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Label, Textarea } from "@/app/components/ui/Input";
import {
  addPlayers,
  clearRoster,
  remintAccessCode,
  seedRemainingResponses,
  uploadRoster,
} from "./actions";
import { CopyButton } from "@/app/components/ui/CopyButton";
import type { EventState } from "@/app/components/ui/StatePill";

export type PlayerRow = {
  id: string;
  display_name: string;
  contact_handle: string | null;
  survey_submitted_at: string | null;
  access_code: string;
};

export function RosterSection({
  eventCode,
  state,
  players,
  origin,
}: {
  eventCode: string;
  state: EventState;
  players: PlayerRow[];
  origin: string;
}) {
  const canEdit = state === "draft";
  const showLinks = state !== "draft";
  const canRemint = state !== "ended";
  const pendingCount = players.filter((p) => !p.survey_submitted_at).length;

  if (players.length === 0) {
    return (
      <EmptyState
        icon={<Users size={18} />}
        title="Roster is empty"
        body={
          canEdit
            ? "Paste a CSV of display names and handles to get started."
            : "No players were added before this event moved past draft."
        }
        action={canEdit ? <ImportCsvDialog eventCode={eventCode} replace={false} /> : null}
      />
    );
  }

  const allLinksBlock = players
    .map((p) => `${p.display_name} — ${origin}/p/${eventCode}/${p.access_code}`)
    .join("\n");
  const csvHref =
    "data:text/csv;charset=utf-8," +
    encodeURIComponent(
      "display_name,handle,link\n" +
        players
          .map(
            (p) =>
              `${csvCell(p.display_name)},${csvCell(p.contact_handle ?? "")},${csvCell(
                `${origin}/p/${eventCode}/${p.access_code}`,
              )}`,
          )
          .join("\n"),
    );

  return (
    <div className="flex flex-col gap-3">
      {showLinks ? (
        <Banner tone="info">
          Each link is one person&rsquo;s private entry point. DM them
          individually — do not share the block publicly.
        </Banner>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {players.length} {players.length === 1 ? "player" : "players"}
          {showLinks
            ? ` · ${players.filter((p) => p.survey_submitted_at).length} submitted`
            : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {showLinks ? (
            <>
              <CopyButton
                value={allLinksBlock}
                label={`Copy all links (${players.length})`}
                doneLabel="Copied"
                variant="secondary"
                size="sm"
              />
              <a
                href={csvHref}
                download={`${eventCode.toLowerCase()}-player-links.csv`}
                className={buttonClass("ghost", "sm")}
              >
                <Download size={13} /> Export CSV
              </a>
            </>
          ) : null}
          {state === "survey_open" ? (
            <>
              <AddPlayersDialog eventCode={eventCode} />
              {pendingCount > 0 ? (
                <SeedRemainingDialog eventCode={eventCode} count={pendingCount} />
              ) : null}
            </>
          ) : null}
          {canEdit ? (
            <>
              <ImportCsvDialog eventCode={eventCode} replace />
              <form action={clearRoster.bind(null, eventCode)}>
                <button type="submit" className={buttonClass("ghost", "sm")}>
                  Clear roster
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50/60 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Handle</th>
              <th className="px-4 py-2.5">Survey</th>
              {showLinks ? <th className="px-4 py-2.5">Access link</th> : null}
              {canRemint && showLinks ? (
                <th className="px-4 py-2.5 text-right">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {players.map((p) => {
              const link = `${origin}/p/${eventCode}/${p.access_code}`;
              return (
                <tr key={p.id} className="hover:bg-zinc-50/60">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">
                    {p.display_name}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">
                    {p.contact_handle ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.survey_submitted_at ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 size={13} /> Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                        <Clock size={13} /> Pending
                      </span>
                    )}
                  </td>
                  {showLinks ? (
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-[11px] text-zinc-500">
                          {link}
                        </span>
                        <CopyButton value={link} iconOnly />
                      </div>
                    </td>
                  ) : null}
                  {canRemint && showLinks ? (
                    <td className="px-4 py-2 text-right">
                      <form
                        action={remintAccessCode.bind(null, eventCode, p.id)}
                        className="inline"
                      >
                        <button
                          type="submit"
                          className={buttonClass("ghost", "sm")}
                          title="Rotate access code — old link stops working"
                        >
                          Re-mint
                        </button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function csvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function SeedRemainingDialog({
  eventCode,
  count,
}: {
  eventCode: string;
  count: number;
}) {
  return (
    <Dialog
      title="Seed remaining surveys"
      description={`Auto-fill random survey responses for ${count} player${count === 1 ? "" : "s"} who haven\u2019t submitted. This is a testing aid \u2014 responses are randomized.`}
      trigger={(open) => (
        <Button type="button" variant="secondary" size="sm" onClick={open}>
          <Shuffle size={13} /> Seed remaining ({count})
        </Button>
      )}
    >
      {(close) => (
        <form
          action={seedRemainingResponses.bind(null, eventCode)}
          className="flex flex-col gap-3"
          onSubmit={() => setTimeout(close, 0)}
        >
          <p className="text-xs text-amber-700">
            This fills in random answers for {count} player{count === 1 ? "" : "s"} and
            marks them as submitted. Real submissions won&rsquo;t be overwritten.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Seed {count} survey{count === 1 ? "" : "s"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function AddPlayersDialog({ eventCode }: { eventCode: string }) {
  return (
    <Dialog
      title="Add players"
      description="Paste a CSV to add more players to the roster. Existing players are not affected."
      size="lg"
      trigger={(open) => (
        <Button type="button" variant="secondary" size="sm" onClick={open}>
          <Plus size={13} /> Add players
        </Button>
      )}
    >
      {(close) => (
        <form
          action={addPlayers.bind(null, eventCode)}
          className="flex flex-col gap-3"
          onSubmit={() => setTimeout(close, 0)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-csv">
              CSV <span className="text-zinc-400">(display_name, contact_handle)</span>
            </Label>
            <Textarea
              id="add-csv"
              name="csv"
              rows={8}
              required
              placeholder={"Alice Chen, @alice\nBob Park, @bpark"}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add players
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function ImportCsvDialog({
  eventCode,
  replace,
}: {
  eventCode: string;
  replace: boolean;
}) {
  return (
    <Dialog
      title={replace ? "Replace roster" : "Import roster"}
      description="Paste a CSV with one player per line: display name, contact handle."
      size="lg"
      trigger={(open) => (
        <Button type="button" variant={replace ? "secondary" : "primary"} size="sm" onClick={open}>
          <Upload size={13} /> {replace ? "Replace CSV" : "Import CSV"}
        </Button>
      )}
    >
      {(close) => (
        <form
          action={uploadRoster.bind(null, eventCode)}
          className="flex flex-col gap-3"
          onSubmit={() => setTimeout(close, 0)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="roster-csv">
              CSV <span className="text-zinc-400">(display_name, contact_handle)</span>
            </Label>
            <Textarea
              id="roster-csv"
              name="csv"
              rows={8}
              required
              placeholder={"Alice Chen, @alice\nBob Park, @bpark"}
            />
          </div>
          {replace ? (
            <p className="text-xs text-amber-700">
              This replaces the current roster entirely.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {replace ? "Replace roster" : "Import roster"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
