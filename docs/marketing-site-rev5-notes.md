# Unmute Labs — Site, revision 2

Seven linked static pages: Homepage, Try a Moment, A Round, The Research, The Season,
Our Team, Contact. No build step. Open `index.html` directly, or deploy the whole
folder as-is (drag onto Vercel or Netlify).

## What changed in this revision

### Two CSS bugs behind the white space
Both were the same failure: a `padding` shorthand out-specifying the element-level
rule it sat next to, and silently zeroing padding on the other axis.

1. `.page-hero` used a `padding` shorthand, which cancelled `.wrap`'s horizontal
   padding. Every page hero rendered 40px left of the nav and of the content below it.
2. `.wrap` used a `padding: 0 40px` shorthand, which out-specifies `nav`, `section`
   and `header` and cancelled their vertical padding sitewide. Headings butted
   against the section rules.

Both now use longhand so the rules compose. Comments in the stylesheet mark why —
worth keeping if anyone edits these rules later.

### Layout
- New editorial scaffold (`.editorial`): a 200px label rail against a wide content
  column, so the right third of each section is occupied on purpose. Applied to all
  seven pages.
- `.hero-split` and `.hero-grid` do the same for page heroes.
- Footer rhythm tightened; the hardcoded 90px gap before the footer nav is gone.
- Mobile: nav CTA no longer disappears with the collapsed nav links; the 13-node
  Season timeline scrolls instead of breaking the page. No horizontal overflow on
  any page at 390px.

### Copy — Matt
- "Every Moment ends the same way" replaced with **"Closing the gap between a group
  of individuals and a team"** — impact rather than mechanic. The parallel line on
  The Research was softened to match.
- Research promoted: a credibility panel of named primary sources sits in the
  homepage hero, and "Built on real research, not icebreakers" leads its section.
- The Season screenshot: surname removed. The word was cut and the line reflowed
  from the original pixels, so kerning and centring are intact.
- Headshot re-framed wider (see Images below).
- A Round's buy button points at Contact as a front door until Stripe is wired.

### Copy — Alex
- Nav reads "Our Team".
- Hero subhead made specific: "Build a weekly practice that grows connection
  without you driving it."
- "Wider spans and flatter layers" → "bigger teams and fewer layers of management";
  "the old rituals" → "old rituals"; "what breaks down **for** a team".
- Try a Moment gains a "what a Moment actually creates" section — play, laughter,
  honest disclosure, collective problem-solving.
- The Season gains a reflection-and-continuity item in What's Included, and a
  "Connection is the mechanism, behavior is the outcome" section.
- Bio: "designing and running workshops" (the *the* is gone).

### The Research, rebuilt
No longer a wall of text. Findings are now stat rows with named sources — Gallup's
7×, BetterUp's 50% and 51%, the 25% collapse in cross-group collaboration from the
61,000-employee *Nature Human Behaviour* study, Bernstein & Turban on the proximity
paradox, Qualtrics on the insights-to-action gap. A dedicated section covers why
play works (Huizinga's magic circle, Edmondson on psychological safety, Aron on
escalating disclosure, the spacing effect). Klein et al. is framed honestly as a
moderate effect rather than oversold.

When Matt's research revision lands, it drops into this structure without a rebuild.

### Images
- **Session photography** (4 photos): navy duotone, which resolves the palette clash
  and unifies quality. Feathered blur applied over client notebook branding, name
  badges, flipchart text and legible clinical handwriting. Sources are phone
  snapshots — fine at the sizes used here, worth replacing after a real shoot.
  The redaction is baked into the image files, not a caption — the photos carry no
  explanatory text on the page.
- **All three headshots normalised.** Face height was measured in each and the three
  brought to a common ratio (~0.65 of frame height) so they read as a set:

      before          after
      Matt     0.586   0.647
      Claudia  0.323   0.658
      Alex     0.570   0.647

  Nothing is reconstructed. Matt's photo stops at his chest, so shrinking him to match
  the others would have meant inventing a torso — replication streaked, mirroring
  produced a chevron in his collar, and blurring it was visible. So the set was
  normalised UP to his natural size instead: he is untouched in scale, and the other
  two are straight crops. He was recentred horizontally (his face sat at 0.33 across
  the frame) and his background replaced with a plain warm neutral, neither of which
  invents pixels.

  The cost of that choice: all three are tighter than they would be with a proper
  shoot. Matt's and Alex's hair is clipped at the top of their source files, so both
  crops sit flush to the top edge. Claudia's crop now works from ~198px of a 400px
  original — fine at display size, soft if used larger.

- The 320×240 photo was not used — too low-resolution for any slot on the site.

## Still open

- **Wild Cards PDF** — `assets/wild-cards-guide-STANDIN.pdf` is still the labelled
  stand-in. Swap Matt's real file in at that path, or update the link in
  `try-a-moment.html`.
- **Forms** — both forms are wired and working, but need one value filled in.
  Open `assets/forms.js` and replace `UNMUTE_FORM_ENDPOINT` with a Formspree
  endpoint (formspree.io → New Form → point it at the address that should receive
  submissions). That's the only change needed, and it covers both forms.
  Formspree sends a confirmation email on the first submission. Until it's set,
  the forms show an error rather than silently dropping a lead.
- **Payment** — Stripe deferred per Matt. A Round's button front-doors to Contact.
- **"A Round"** — informal check found no direct collision, but a formal trademark
  search still needs to run.
- **Bios** — first-pass, drafted from real LinkedIn exports. All three should review
  their own before this goes live.
- **Matt's research revision** — his newer draft isn't reflected here.
- **Image Reveal** — a third Moment type visible in product screenshots, still not
  described anywhere in site copy.
- **Team photos** — personal snapshots, not a shoot. Usable now; revisit after
  the September session.
