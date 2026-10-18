import { Button, Surface } from "@cladd-ui/react";

type SignInPageProps = {
  authLoading: boolean;
  authError: string | null;
  discordAuthEnabled: boolean;
};

export function SignInPage({
  authLoading,
  authError,
  discordAuthEnabled,
}: SignInPageProps) {
  return (
    <div className="grid min-h-screen place-items-center bg-cladd-bg p-6 text-white">
      <Surface
        as="main"
        className="w-full max-w-md rounded-2xl p-8 text-center"
        variant="solid"
        outline
      >
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">
          Banger Player
        </p>
        <h1 className="mt-4 text-3xl font-bold">Sign in to continue</h1>
        <p className="mt-3 text-white/65">
          Sign in with Discord to open the music controls and queue songs.
        </p>
        {authError && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {authError}
          </p>
        )}
        {!authLoading && !discordAuthEnabled && (
          <p role="status" className="mt-4 text-sm text-amber-200">
            Discord sign-in is not configured. Set the Discord OAuth
            credentials, session secret, and allowed Discord user IDs in the
            backend environment, then restart the backend.
          </p>
        )}
        <Button
          className="mt-6 w-full"
          color="brand"
          variant="gradient-fill"
          size="xl"
          type="button"
          disabled={authLoading || !discordAuthEnabled}
          onClick={() => window.location.assign("/api/auth/discord")}
        >
          {authLoading
            ? "Checking sign-in…"
            : discordAuthEnabled
              ? "Sign in with Discord"
              : "Discord sign-in unavailable"}
        </Button>
      </Surface>
    </div>
  );
}
