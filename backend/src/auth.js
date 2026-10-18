import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "banger_session";
const STATE_COOKIE = "banger_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator === -1 || cookie.slice(0, separator).trim() !== name) {
      continue;
    }

    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

export function createDiscordAuth({ clientOrigin }) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const sessionSecret = process.env.SESSION_SECRET;
  const allowedUserIds = new Set(
    (process.env.DISCORD_USER_ALLOWLIST ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
  for (const userId of allowedUserIds) {
    if (!/^\d{17,20}$/.test(userId)) {
      throw new Error(
        "DISCORD_USER_ALLOWLIST must contain comma-separated Discord user IDs",
      );
    }
  }
  const secureCookies =
    process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  const enabled = Boolean(
    clientId &&
      clientSecret &&
      redirectUri &&
      sessionSecret &&
      Buffer.byteLength(sessionSecret) >= 32 &&
      allowedUserIds.size > 0,
  );

  function cookieOptions(maxAge, path = "/api") {
    return [
      "HttpOnly",
      "SameSite=Lax",
      `Path=${path}`,
      `Max-Age=${maxAge}`,
      ...(secureCookies ? ["Secure"] : []),
    ].join("; ");
  }

  function sign(value) {
    return createHmac("sha256", sessionSecret).update(value).digest("base64url");
  }

  function readUser(request) {
    if (!enabled) {
      return null;
    }

    const cookie = readCookie(request, SESSION_COOKIE);
    if (!cookie) {
      return null;
    }

    const separator = cookie.lastIndexOf(".");
    if (separator === -1) {
      return null;
    }

    const payload = cookie.slice(0, separator);
    const signature = cookie.slice(separator + 1);
    const expectedSignature = sign(payload);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return null;
    }

    try {
      const user = JSON.parse(Buffer.from(payload, "base64url").toString());
      if (
        typeof user.id !== "string" ||
        typeof user.username !== "string" ||
        typeof user.expiresAt !== "number" ||
        user.expiresAt <= Date.now()
      ) {
        return null;
      }

      return { id: user.id, username: user.username };
    } catch {
      return null;
    }
  }

  return {
    enabled,
    getUser(request, response) {
      const user = readUser(request);
      response.json({
        enabled,
        user: user && allowedUserIds.has(user.id) ? user : null,
      });
    },
    start(request, response) {
      if (!enabled) {
        throw createHttpError(
          "Configure Discord OAuth credentials, a SESSION_SECRET of at least 32 characters, and DISCORD_USER_ALLOWLIST",
          503,
        );
      }

      const state = randomBytes(32).toString("base64url");
      response.setHeader(
        "Set-Cookie",
        `${STATE_COOKIE}=${state}; ${cookieOptions(600, "/api/auth/discord")}`,
      );

      const authorizationUrl = new URL(
        "https://discord.com/oauth2/authorize",
      );
      authorizationUrl.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "identify",
        state,
      }).toString();
      response.redirect(authorizationUrl.toString());
    },
    async callback(request, response) {
      const stateCookie = readCookie(request, STATE_COOKIE);
      response.setHeader(
        "Set-Cookie",
        `${STATE_COOKIE}=; ${cookieOptions(0, "/api/auth/discord")}`,
      );

      const { code, state, error: oauthError } = request.query;
      if (oauthError) {
        throw createHttpError("Discord sign-in was cancelled", 400);
      }
      if (
        typeof code !== "string" ||
        typeof state !== "string" ||
        !stateCookie ||
        state !== stateCookie
      ) {
        throw createHttpError("Discord sign-in state is invalid; please retry", 400);
      }

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });
      if (!tokenResponse.ok) {
        console.error(
          "Discord OAuth token exchange failed:",
          tokenResponse.status,
        );
        throw createHttpError("Could not complete Discord sign-in", 502);
      }

      const token = await tokenResponse.json();
      if (typeof token.access_token !== "string") {
        throw createHttpError("Discord sign-in returned an invalid token", 502);
      }

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!userResponse.ok) {
        console.error("Discord OAuth profile request failed:", userResponse.status);
        throw createHttpError("Could not retrieve your Discord profile", 502);
      }

      const profile = await userResponse.json();
      if (typeof profile.id !== "string" || typeof profile.username !== "string") {
        throw createHttpError("Discord returned an invalid user profile", 502);
      }
      if (!allowedUserIds.has(profile.id)) {
        throw createHttpError(
          "This Discord account is not on the access allowlist",
          403,
        );
      }

      const payload = Buffer.from(
        JSON.stringify({
          id: profile.id,
          username: profile.global_name || profile.username,
          expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
        }),
      ).toString("base64url");
      response.setHeader("Set-Cookie", [
        `${STATE_COOKIE}=; ${cookieOptions(0, "/api/auth/discord")}`,
        `${SESSION_COOKIE}=${payload}.${sign(payload)}; ${cookieOptions(SESSION_MAX_AGE)}`,
      ]);
      response.redirect(clientOrigin);
    },
    requireUser(request, _response, next) {
      const user = readUser(request);
      if (!user) {
        next(createHttpError("Sign in with an allowed Discord account", 401));
        return;
      }
      if (!allowedUserIds.has(user.id)) {
        next(createHttpError("This Discord account is not allowed", 403));
        return;
      }

      request.user = user;
      next();
    },
    logout(_request, response) {
      response.setHeader(
        "Set-Cookie",
        `${SESSION_COOKIE}=; ${cookieOptions(0)}`,
      );
      response.json({ user: null });
    },
  };
}
