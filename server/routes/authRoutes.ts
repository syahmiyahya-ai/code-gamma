import { Router } from "express";
import { google } from "googleapis";
import { db } from "../db/db.ts";

const router = Router();

router.get("/auth/google/url", (req, res) => {
  const userId = req.query.userId as string;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/auth/google/callback`
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent',
    state: userId
  });

  res.json({ url });
});

router.get("/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const userId = state as string;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/auth/google/callback`
  );

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    
    if (userId) {
      db.prepare("UPDATE users SET google_access_token = ?, google_refresh_token = ? WHERE id = ?")
        .run(tokens.access_token, tokens.refresh_token || null, userId);
    }

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error in Google OAuth callback:", error);
    res.status(500).send("Authentication failed");
  }
});

router.post("/users/sync-tokens", (req, res) => {
  const { user_id, access_token, refresh_token } = req.body;
  db.prepare("UPDATE users SET google_access_token = ?, google_refresh_token = ? WHERE id = ?")
    .run(access_token, refresh_token || null, user_id);
  res.json({ success: true });
});

export default router;
