import { Router } from "express";
import { env } from "./config.ts";

// Google sign-in and the Drive mirror arrive with the Google module.
// This file is the whole seam: the sign-in page already calls GET /auth/google,
// and the module replaces the handlers below. Use startSession() from auth.ts
// once Google has confirmed who the person is.

export function googleConfig() {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  return { clientId, clientSecret, configured: Boolean(clientId && clientSecret) };
}

export const googleRouter = Router();

googleRouter.get("/auth/google/status", (_req, res) => {
  const { configured } = googleConfig();
  res.json({
    configured,
    ready: false,
    message: configured
      ? "Google credentials were found, but Google sign-in is not switched on in this build yet."
      : "Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the environment or in ~/.deskmate-google.env.",
  });
});

googleRouter.get("/auth/google", (req, res) => {
  const { configured } = googleConfig();
  const reason = configured ? "pending" : "not-configured";
  if (req.accepts(["html", "json"]) === "html") {
    res.redirect(`/signin?google=${reason}`);
    return;
  }
  res.status(501).json({
    error: "google_sign_in_not_configured",
    configured,
    message: configured
      ? "Google credentials were found, but Google sign-in is not switched on in this build yet. Use a username and password."
      : "Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or use a username and password.",
  });
});
