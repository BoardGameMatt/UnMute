# Marketing site — unmutelabs.com

The public marketing site is a seven-page static site. It lives at the **repo root**, not in `app-platform/`.

| Domain | What it is | Where it lives |
| --- | --- | --- |
| [unmutelabs.com](https://unmutelabs.com) | Marketing site | Repo root (`index.html`, `*.html`, `assets/`) |
| [app.unmutelabs.com](https://app.unmutelabs.com) | Product (Next.js) | `app-platform/` (Vercel project `unmute-app`) |

Do not point the `unmute-app` Vercel project at the repo root. That project is the product. The marketing domain is a separate hosting target that currently serves this repo's root files (the previous homepage was the centered logo in `index.html`).

## Pages

| File | URL path |
| --- | --- |
| `index.html` | `/` |
| `try-a-moment.html` | `/try-a-moment.html` |
| `a-round.html` | `/a-round.html` |
| `the-season.html` | `/the-season.html` |
| `the-research.html` | `/the-research.html` |
| `team.html` | `/team.html` |
| `contact.html` | `/contact.html` |

No build step. Open `index.html` locally, or serve the repo root:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## How this landed in the repo

Source: `~/Downloads/unmute-site-rev5.zip` (extracted folder name `unmute-full-site`).

The zip filename says rev5. The included `README.md` is titled **revision 2** and the files inside are dated 17 Aug 2026. Treat this as the copy we were given, not as confirmation that later revisions exist on disk.

Colleague notes (copy, CSS fixes, open items) are preserved in [marketing-site-rev5-notes.md](./marketing-site-rev5-notes.md).

The previous logo-only homepage is archived at [archive/unmutelabs-logo-placeholder.html](./archive/unmutelabs-logo-placeholder.html).

## Go live

1. Confirm you are ready for the logo placeholder on unmutelabs.com to be replaced.
2. Connect the contact / Wild Cards forms (see below) if you want those to work on day one.
3. Commit the root HTML + `assets/` (and this doc) and push to `main`.
4. Confirm the host that already serves unmutelabs.com picks up the new root files. If the logo page is still live after the push, the domain is not following this repo's `main` branch — check GitHub Pages settings, or a separate Vercel/Netlify project attached to the apex domain.

Rollback: restore `docs/archive/unmutelabs-logo-placeholder.html` to `index.html` and remove the extra `*.html` pages if you need the logo-only homepage back.

## Must-fix before treating the site as finished

### Forms (blocking)

Both forms post through `assets/forms.js`. The endpoint is still a placeholder:

```js
const UNMUTE_FORM_ENDPOINT = "https://formspree.io/f/REPLACE_ME";
```

Until that is a real Formspree (or equivalent) URL:

- Contact (`contact.html`) shows an error instead of sending the lead.
- Wild Cards download (`try-a-moment.html`) will not email you the lead or start the PDF download.

Setup: formspree.io → New Form → point it at the inbox that should receive submissions → paste the `https://formspree.io/f/...` URL into `UNMUTE_FORM_ENDPOINT`. Formspree emails that address to confirm on the first live submission.

### Wild Cards PDF (content)

`try-a-moment.html` downloads `assets/wild-cards-guide-STANDIN.pdf`. Replace that file with the real guide (keep the filename, or update the `data-download` attribute).

## Known gaps (from the source README)

- **A Round / Stripe** — the $27 button goes to Contact until payment is wired.
- **A Round name** — informal trademark check only; formal search still needed.
- **Bios** — first-pass from LinkedIn exports; each person should review.
- **Team photos** — personal snapshots; revisit after a real shoot.
- **Image Reveal** — visible in product screenshots, not described in copy.
- `assets/wao-join-qr.png` is unused (leftover asset, harmless).

## What not to change from here

- Do not move these files into `app-platform/`.
- Do not add a root `vercel.json` that would reconfigure the product app.
- - Keep `images/unmute_labs_dark.svg` and `images/unmute_labs_light.svg`; the favicon points at the dark mark.
- Header uses `images/logo-dark.png` (navy wordmark, for light backgrounds). Footer uses `images/logo-light.png` (white wordmark, for the navy footer).
