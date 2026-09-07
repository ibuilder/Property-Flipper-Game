# Shipping on Steam

The game is already an offline Electron app. Steam does not need Steamworks
for the first listing: no accounts, no cloud, no achievements. Upload the
**same binaries** GitHub Releases already smoke-tested. The owner checklist
sits in [storefronts.md](storefronts.md).

## Once

1. Join Steamworks and create an app. Put the numeric app ID in the
   repository variable `STEAM_APP_ID` (and in the store page). Depot IDs default
   to app ID + 1 (Windows), + 2 (macOS), + 3 (Linux); override with
   `STEAM_DEPOT_WINDOWS` / `STEAM_DEPOT_MACOS` / `STEAM_DEPOT_LINUX` when
   Steamworks assigned different numbers.
2. Capsules come from `npm run marketing` — `docs/marketing/steam-*.png`.
   Copy, do not recrop.
3. Store copy can start from [itch-page.md](itch-page.md). Do not upload the
   Flip Empire mockups ([marketing/README.md](marketing/README.md)).
4. Trailer: two to three minutes. Hook: the deal analyzer with the two
   maximum offers disagreeing, then a flip going wrong and the deal card
   naming why. The GIFs from `npm run clips` are for forums, not this slot.

## Each release

```bash
# After the GitHub Release workflow has published:
gh release download vX.Y.Z --dir desktop
STEAM_APP_ID=... npm run steam:package
```

That stages `dist-steam/{windows,macos,linux}/` and writes `app_build.vdf`
plus `LAUNCH.md` (the executable names to paste into Steamworks).

Steam launches the depot. This script prefers, in order:

| OS | First choice | Then | Last (warns) |
| --- | --- | --- | --- |
| Windows | `win-unpacked/` | `*Portable.exe` | `*Setup.exe` |
| macOS | `*.app` | `*.zip` | `*.dmg` |
| Linux | `linux-unpacked/` | `*.AppImage` | — |

A build that is not the tagged GitHub artifact is a different game than the
one CI launched. Do not package from a dirty working tree.

Then:

```
steamcmd +login <user> +run_app_build dist-steam/app_build.vdf +quit
```

## Deck

The UI is dense tables at 1280×800. After the first upload, play the tutorial
deal in Big Picture with mouse emulation, at 1280×800 and at 800×1280. If it
is not actually playable, leave Steam Deck unsupported on the store page
rather than claiming it.

## Not in v1

Steam Cloud (saves already live in userData / localStorage), achievements,
overlay invites, a Steamworks SDK in the renderer.
