# Ivy's Birthday invite site: STATE

## Goal and constraints
- Static one-page invite (index.html, styles.css, script.js) plus Vercel API routes in api/ for Paystack M-Pesa payment.
- Event: Saturday 28 November 2026, 3:00 PM, Zoneteria, all white dress code, Ksh 1,000 reservation by 18 November.

## Current status
- Hero portrait uses the "Hat's off" photo (lakiyo-10) as an unframed cutout, background removed.
  - Files: images/lakiyo-10-cutout.webp (served, about 150 KB) and images/lakiyo-10-cutout.png (lossless fallback).
  - Made from generated/lakiyo-10.png with rembg model isnet-general-use (BiRefNet failed: C: drive nearly full, out of memory).
  - CSS: .hero__frame in styles.css has no border/arch; a mask fades the bottom 22% where the photo is cropped.
- Replaced: hero previously showed images/lakiyo-04.jpg inside an arched frame.
- Hero no longer has the "Come celebrate with me" eyebrow or the "It's my birthday" pill (removed 2026-11-14).
- Dress code section shows the "Sitting pretty" photo (11) as an unframed medium shot (hat to knees), background removed, bottom fading out.
  - Served: images/lakiyo-11-medium.webp (.png fallback), 987x1210 (crop ends just below her resting hand; bottom mask fades only the last 4% so the hand is not darkened), full resolution, never resized. Shown about 494px wide on desktop, so it stays sharp on high-density screens.
  - Made from generated/lakiyo-11.png: `python .claude/notes/cutout-hq.py <src> <out.png> <out.webp>` (rembg isnet-general-use; its alpha matting runs out of memory here and falls back to a plain cut), then `python .claude/notes/firm-crop.py <cutout.png> <out.png> <out.webp> 1210` (makes half-transparent areas such as the shaded right cape panel solid, crops above the stool).
  - Full uncropped cutout kept at generated/lakiyo-11-cutout.png. Its raised hand was hand-fixed (rembg left it about 50% transparent, dark skin on the dark backdrop): in cutout box x760-960, y330-480 the alpha was firmed and RGB copied from generated/lakiyo-11.png at offset (+57, +94). Redo this if the cutout is ever regenerated.
  - CSS: .dress__grid columns 1.1fr / 1fr; picture max-width 640px (460px under 820px); glow filter on the picture wrapper so the bottom mask does not clip it into a box.
  - Replaced (2026-11-14): photo 01 "Sealed with a kiss" cutouts (too low resolution, files deleted), and before that images/lakiyo-02.jpg in an arched frame.
- C: drive is effectively full (tens of MB free). Write big temp files to D:\tmp-vercel\tmp.

## Data
- images/ = white-outfit edited photos used on the site; generated/ = PNG masters; originals/ = untouched source photos.

## Open questions
- None.

## Deploy
- Live: https://ivys-birthday.vercel.app (Vercel project ivys-birthday, linked in .vercel/).
- C: drive is nearly full, so deploy with npm cache and temp on D:: set npm_config_cache, TEMP and TMP to D:\tmp-vercel\cache / D:\tmp-vercel\tmp, then `npx -y vercel@latest deploy --prod --yes`.
- Last production deploy (2026-11-15) includes the Hat's off hero cutout, hero label removals and the dress code "Sitting pretty" cutout with the raised hand fix.

## Local preview
- `python -m http.server 5173 --bind 127.0.0.1` from the project root, then open http://localhost:5173/.

## Payments (updated 2026-11-15)
- Paystack live key is set in Vercel as `PAYSTACK_SECRET_KEY` (Production only, never in the repo). `GET /api/paystack-stk` returns `{"configured":true,"mode":"live"}`, so the pay modal opens on the "Instant PIN Prompt" tab.
- Still to do in the Paystack dashboard: set the webhook URL to `https://ivys-birthday.vercel.app/api/paystack-webhook`, and make sure Mobile Money (M-Pesa) is enabled under Settings > Preferences.
- Optional and not set: `RESEND_API_KEY`, `IVY_EMAIL`, `RESEND_FROM` for email receipts.
