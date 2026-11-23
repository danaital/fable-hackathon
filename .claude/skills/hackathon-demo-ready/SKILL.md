---
name: hackathon-demo-ready
description: Pre-demo checklist for a short hackathon build. Use when the user asks if the demo is ready, wants to present, deploy, or claims the product is done.
---

# Hackathon demo-ready checklist

Before anyone claims the demo is ready, work through this list in order. Do not skip a step. Quote the command you ran and its result.

## 1. The happy path works

- Identify the one flow the 2-minute demo will show.
- Run the app (npm run dev, or the project's dev command).
- Click through that flow in a browser or with Playwright. Record what you saw.
- If tests exist, run them (npm test, or the project's test command).

## 2. Deploy if time allows

- Prefer the Vercel plugin or MCP if connected: deploy and open the live URL in a fresh browser.
- If deploy is not possible, make sure localhost is ready to share on screen.

## 3. Demo script

Write a 2-minute script with four beats:

1. Problem (15 seconds)
2. Solution (20 seconds)
3. Live demo of the happy path (70 seconds)
4. One sentence on what the model made possible (15 seconds)

## 4. Docs and hygiene

- README.md says how to run and, if deployed, includes the URL.
- No secrets, API keys, or .env values in the repo or on screen.
- docs/CHANGELOG.md mentions what the slice does.

## 5. Definition of done

Only say ready if:

- The happy path was actually run and works
- A URL or a reliable local demo exists
- The 2-minute script is written
- Docs were updated

End with a short report: what passed, what is still broken, and whether to present now or fix one issue first.
