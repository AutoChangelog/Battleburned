import express from "express";
import { Webhooks } from "@octokit/webhooks";
import { handlePullRequestClosed } from "./webhooks.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const WEBHOOK_SECRET = process.env.GITHUB_APP_WEBHOOK_SECRET ?? "";

const webhooks = new Webhooks({
  secret: WEBHOOK_SECRET,
});

// Register event handlers
webhooks.on("pull_request.closed", handlePullRequestClosed);

webhooks.onError((error) => {
  console.error("Webhook error:", error.message);
});

const app = express();

// The webhooks middleware expects raw body (don't use express.json())
app.use("/webhook", express.raw({ type: "*/*" }), (req, res, next) => {
  // @octokit/webhooks middleware
  const id = req.headers["x-github-delivery"] as string | undefined;
  const name = req.headers["x-github-event"] as string;
  const signature = req.headers["x-hub-signature-256"] as string | undefined;

  if (!name || !signature) {
    res.status(400).json({ error: "missing headers" });
    return;
  }

  webhooks
    .verifyAndReceive({
      id: id ?? "",
      name,
      payload: typeof req.body === "string" ? req.body : req.body.toString("utf-8"),
      signature,
    })
    .then(() => {
      res.status(200).json({ ok: true });
    })
    .catch((err) => {
      console.error("Webhook verification failed:", err.message);
      res.status(400).json({ error: "verification failed" });
    });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", app: "autochangelog" });
});

app
  .listen(PORT, () => {
    console.log(`AutoChangelog running on port ${PORT}`);
  })
  .on("error", (err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
