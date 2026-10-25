# Output Commands — 1-Minute Demo Video (Final Minute of 3-Min Video)

Purpose: run these commands to produce the 1-minute screen-capture video showing CascadeGuard's output, to be appended after the 2-minute PPT+voice segment with a classical music overlay.

Prerequisites:
- The PPT (2 min) has been recorded with voice-over.
- The live site https://cascadeguard-ten.vercel.app/ is open in a browser (or use the deployed link).
- A screen recorder (e.g., OBS Studio, QuickTime, or the browser's built-in screen capture) is ready.
- A classical track (e.g., Bach Cello Suite No. 1 Prelude, or any 60-second classical piece) is ready as an audio layer.

---

COMMAND SEQUENCE (run in order; total ~60 seconds of screen time):

1. OPEN THE LIVE DASHBOARD (record 5 s)
   URL: https://cascadeguard-ten.vercel.app/
   Show the header: "ALL SYSTEMS NOMINAL" · topology with 9 services.

2. SELECT THE FLAGSHIP SCENARIO (record 8 s)
   Click the scenario dropdown / banner -> choose "Pool-Exhaustion".
   Press the "2x" speed button (keyboard: press 2).
   Point briefly at the topology: orders-db saturation climbing.

3. SHOW THE PREDICTION (record 15 s)
   Wait for the violet PREDICTION halo to appear (~30 s into the 2x playback; or jump ahead in the timeline if using the dashboard's time slider).
   Highlight the Prediction Ledger row turning green: "✓ HIT · 120s early".
   Point at the SEV-1 alert banner that opens.

4. INCIDENT + ROOT CAUSE (record 10 s)
   Click the incident card / banner -> the Root Cause panel opens.
   Highlight: "orders-db — 95% confidence · cascade evidence shown".
   Point at the dependency graph showing the chain: gateway → orders-api → orders-db.

5. RECOVERY STRATEGY (record 10 s)
   Click the Recovery Optimizer tab/panel.
   Highlight the top row: "failover:orders-db · 100% · recommended".
   Highlight the contrast: "no-action · 0% · not-recommended".

6. APPLY ACTION + REPORT EXPORT (record 7 s)
   Click the "APPLY" button on the recommended strategy.
   Click the "⌘ E" (EXPORT) button in the header.
   Show the Markdown download prompt / file named "incident-report.md".

7. BUSINESS IMPACT PANEL (record 5 s)
   Click/open the Business Impact tab (or point at the panel already visible).
   Read out: "SLO burn 11.37× · User flow 100% degraded · Revenue at risk $34.2k/min".

---

AUDIO LAYER (post-production):
- Over the 60-second screen recording, layer a classical instrumental track at ~30% volume so voice is not needed (the PPT voice already covered the explanation; this minute is visual proof).
- Recommended: Bach Cello Suite No. 1 Prelude (calm, authoritative) or Vivaldi Four Seasons "Spring" (energetic, optimistic) — 60-second clip, cross-faded at start/end.

FINAL ASSEMBLY (3-minute video):
- Minute 0:00–2:00 -> PPT slides + 2-minute voice track (audio-prompt.md / ElevenLabs output).
- Minute 2:00–3:00 -> 1-minute output video (commands above) + classical overlay + brief text caption: "Live verified output — https://cascadeguard-ten.vercel.app/".

EXPORT FORMAT:
- 1080p (1920×1080), MP4 or MOV.
- File name: CascadeGuard-Demo-3min.mp4
- Include a brief title card at very end: "ORCATHON 2026 · Jay Ghevariya · CascadeGuard · GitHub: pal-123456789/cascadeguard"
