# Storefront checklist

What this repository can ship, and what still needs an account. The game is
offline; none of these stores need a live backend.

Do **not** upload a different binary than the GitHub Release for that tag.
`npm run steam:package` and the itch workflow both start from those artifacts
on purpose.

## Order

1. Tag a release (`git tag vX.Y.Z && git push origin vX.Y.Z`). CI builds,
   launches, and attaches Windows NSIS + portable, macOS DMG + zip, Linux
   AppImage.
2. itch.io, once `ITCH_*` is set — five butler channels, same userversion.
3. Steam, from the same tag: `gh release download` then `npm run steam:package`.

## itch.io

Settings and page copy: [itch-page.md](itch-page.md). Secrets: [RELEASING.md](../RELEASING.md).

```bash
npm run itch:status -- --expect vX.Y.Z --require
```

That is the check CI runs after butler push. Mixed channels (installer on 2.1,
portable on 2.2) fail it.

## Steam

Capsules: `docs/marketing/steam-*.png` from `npm run marketing`. Copy, do not recrop.
Store text can start from [itch-page.md](itch-page.md). Do not use the Flip Empire mockups.

```bash
gh release download vX.Y.Z --dir desktop
STEAM_APP_ID=1234567 npm run steam:package
# If Steamworks did not assign appId+1/+2/+3:
# STEAM_DEPOT_WINDOWS=… STEAM_DEPOT_MACOS=… STEAM_DEPOT_LINUX=…
steamcmd +login <user> +run_app_build dist-steam/app_build.vdf +quit
```

`dist-steam/LAUNCH.md` names the executable this run actually staged. Prefer
`win-unpacked` / Portable.exe, the macOS `.app` or zip, and `linux-unpacked` /
AppImage. An NSIS installer or a DMG in the depot is a warning, not a launch.

After the first upload: tutorial deal on Windows, macOS, Linux; quit; relaunch;
save still there. Steam Deck: Big Picture at 1280×800 and 800×1280. If it is
not playable, leave Deck unsupported on the store page.

Steam Cloud, achievements, and a Steamworks SDK are not in v1.

## GitHub Releases / signing

Unsigned builds run. They look like malware on first launch. Certs and the
secret names are in [RELEASING.md](../RELEASING.md).

## Later, not this week

| Store | Why it waits |
| --- | --- |
| Microsoft Store | Needs Windows signing, then an `appx` target. Different identity. |
| Mac App Store | MAS cert and sandbox; those certs will not sign the DMG. |
| GOG / Epic | Same Electron builds in principle; no pipeline here yet. |
| Google Play / App Store | Wrong UI. Browser + Add to Home Screen is the phone path. |
| Flathub / .deb / Snap | AppImage is what CI already launches. |

## Trailer

Still a human file. Hook: analyzer with the two maximums disagreeing, then a
flip going wrong and the deal card naming why. `npm run clips` GIFs are for
forums, not Steam's trailer slot.
