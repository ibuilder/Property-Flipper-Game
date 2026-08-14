# Fonts

Barlow and Barlow Condensed, embedded as base64 woff2 in `src/ui/fonts.css`.

## Why embedded

The build is one self-contained file — no CDN, CSP-safe, works offline and in
Electron. A linked webfont would also flash fallback text on every load.

## Why it is worth 54KB

The handoff calls the mono/proportional split load-bearing rather than
decorative: every figure and formula is mono, everything else is not, and that
is how the eye learns where the numbers are. Condensed headings are half the
reason the interface reads as a drawing. The fallback stack got the proportions
roughly right and the texture wrong.

## Regenerating

Needs `fonttools` and `brotli` (`pip install fonttools brotli`).

1. Fetch the CSS with a browser user agent, or Google serves TTF instead of
   woff2:

   ```
   curl -A "Mozilla/5.0 ... Chrome/120" \
     "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600&display=swap"
   ```

2. Take only the `latin` blocks (the ones whose `unicode-range` starts
   `U+0000`) and download those five woff2 files.

3. Subset to the glyphs this game draws — ASCII plus the currency, dash, quote,
   arrow and triangle marks:

   ```
   pyftsubset in.woff2 --output-file=out.woff2 --flavor=woff2 \
     --unicodes="U+0020-007E,U+00A0,U+00B0,U+00D7,U+2010-2015,U+2018-201D,U+2022,U+2026,U+2032,U+2033,U+20AC,U+00A3,U+2212,U+2190,U+2192,U+25B2,U+25B8,U+25BC,U+25BE,U+2713,U+00F7" \
     --layout-features="kern,liga" --no-hinting --desubroutinize
   ```

   That is 110KB → 40KB across five weights. Google's `latin` subset carries
   accented characters nothing here renders.

4. Base64 each into an `@font-face` block.

**If you add a glyph to the UI that is outside that range it will render in the
fallback face and look subtly wrong rather than break.** Add it to the
`--unicodes` list and regenerate.

## Licence

SIL Open Font License 1.1, which expressly permits embedding. The licence
travels with the font: `FONT-LICENSE.txt`. Copyright 2017 The Barlow Project
Authors.

## One gotcha, already hit

`index.html`'s CSP had no `font-src`, so it fell back to `default-src 'self'`
and silently blocked every `data:` font. The faces registered and every one
reported `status: "error"`. `font-src 'self' data:` is now set.
