import { Button, Chip } from "@cladd-ui/react";
import type { DiscordUser } from "../types";

type DashboardHeaderProps = {
  user: DiscordUser;
  signingOut: boolean;
  onSignOut: () => void;
};

export function DashboardHeader({
  user,
  signingOut,
  onSignOut,
}: DashboardHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-cladd-bg/95 px-4 py-4 text-white shadow-lg backdrop-blur sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-indigo-400/15 text-xl font-black text-indigo-200">
            B
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Banger Player
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Chip color="brand" variant="solid" size="md" rounded>
            {user.username}
          </Chip>
          <Button
            className="shrink-0"
            variant="solid"
            size="md"
            type="button"
            disabled={signingOut}
            onClick={onSignOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </header>
  );
}
