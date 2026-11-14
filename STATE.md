# Ivy's Birthday invite site: STATE

## Goal and constraints
- Static one-page invite (index.html, styles.css, script.js) plus Vercel API routes in api/ for Paystack M-Pesa payment.
- Event: Saturday 28 November 2026, 3:00 PM, Zonetria, all white dress code, Ksh 1,000 reservation by 18 November.

## Current status
- Hero portrait uses the "Hat's off" photo (lakiyo-10) as an unframed cutout, background removed.
  - Files: images/lakiyo-10-cutout.webp (served, about 150 KB) and images/lakiyo-10-cutout.png (lossless fallback).
  - Made from generated/lakiyo-10.png with rembg model isnet-general-use (BiRefNet failed: C: drive nearly full, out of memory).
  - CSS: .hero__frame in styles.css has no border/arch; a mask fades the bottom 22% where the photo is cropped.
- Replaced: hero previously showed images/lakiyo-04.jpg inside an arched frame.

## Data
- images/ = white-outfit edited photos used on the site; generated/ = PNG masters; originals/ = untouched source photos.

## Open questions
- None.

## Local preview
- `python -m http.server 5173 --bind 127.0.0.1` from the project root, then open http://localhost:5173/.
