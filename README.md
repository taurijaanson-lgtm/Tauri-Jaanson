# Triple A Advisory — financial advisory website

A static marketing website for a financial advisory practice that provides **business
plans, financial models, funding applications and project management**.

No build step, no framework, no dependencies: plain HTML, one stylesheet and one small
JavaScript file. Open `index.html` in a browser and it works.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home — positioning, services overview, process, track record, testimonials |
| `services.html` | The four services in detail, comparison table, FAQ |
| `business-plans.html` | Packages and pricing, interactive scope estimator, what's included, FAQ |
| `projects.html` | Anonymised case studies with results, sectors covered |
| `about.html` | The practice, principles, engagement model, practicalities |
| `contact.html` | Enquiry form, direct contact details, what happens next |
| `404.html` | Not-found page (used automatically by GitHub Pages and Netlify) |

Supporting files: `assets/css/styles.css`, `assets/js/main.js`, `assets/img/` (SVG logo and
favicon), `robots.txt`, `sitemap.xml`, `.nojekyll`.

## Running it locally

```bash
# any static server works; this one needs nothing installed beyond Python
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening the files directly with `file://` also works — nothing depends on a server.

## Deploying

**GitHub Pages:** Settings → Pages → *Deploy from a branch*, pick this branch and the root
folder. `.nojekyll` is already present so the `assets/` directory is served as-is.

**Netlify / Vercel / any static host:** publish the repository root. There is no build
command.

After deploying to a custom domain, update the absolute URLs in `sitemap.xml`,
`robots.txt` and the `<link rel="canonical">` tag at the top of each page.

## Things to change before going live

The copy is written as a complete, realistic site rather than lorem ipsum, but the
specifics are placeholders. Replace these:

1. **Contact details** — `hello@tripleaadvisory.com` and `+372 5000 0000` appear in the
   footer of every page, on `contact.html`, and in the JSON-LD block in `index.html`.
   ```bash
   grep -rn "tripleaadvisory.com\|5000 0000" --include="*.html" .
   ```
2. **Track record numbers** — the stats on `index.html` (180+ plans, €74M financed, 81%
   approval rate, 12 years) and the profile figures on `about.html`.
3. **Case studies** (`projects.html`) — the five anonymised projects and their result
   figures.
4. **Prices** (`business-plans.html`) — the three package prices, and the matching figures
   in the estimator's `BASE` and `EXTRAS` tables in `assets/js/main.js`.
5. **Testimonials** (`index.html`) — quoted with anonymised attributions; swap in real
   ones once you have written permission to publish them.

Design tokens (colours, spacing, radii, fonts) live in the `:root` block at the top of
`assets/css/styles.css`. Changing `--accent` and `--navy-900` there re-skins the whole site.

The header and footer are repeated in each page, so a nav change means editing all seven
files — `grep -l 'class="nav__list"' *.html` lists them.

## Contact form

The form on `contact.html` does not need a server. By default, submitting it validates the
fields and then opens the visitor's email client with the enquiry pre-filled (the address
comes from `data-mailto` on the form).

To collect submissions properly, add a `data-endpoint` attribute pointing at any form
backend that accepts a `POST` of form data and returns JSON — Formspree, Basin, Netlify
Forms, or your own handler:

```html
<form class="form" id="enquiry-form" method="post"
      data-endpoint="https://formspree.io/f/your-form-id"
      data-mailto="hello@tripleaadvisory.com" novalidate>
```

With that attribute present, the form posts in the background and shows a success or error
message in place. Without it, the mailto fallback is used, so an enquiry is never silently
lost.

Pricing buttons link through as `contact.html?package=growth`, which pre-selects the
matching service on the form.

## Accessibility and browser notes

- Skip link, visible focus rings, labelled form fields with inline error messages, and
  `aria-current` on the active nav item.
- Every page is fully readable with JavaScript disabled — the scroll animations only
  activate once JS adds a `js` class to `<html>`.
- `prefers-reduced-motion` disables animation; a print stylesheet strips the chrome.
- Verified with headless Chromium at 1280px and 390px: no horizontal overflow, mobile menu
  opens and closes, estimator and form behave as expected.

## Legal

The footer disclaimer states that the site is not investment, tax or legal advice. Keep it,
and add privacy-policy and terms pages before running any advertising that links here.
