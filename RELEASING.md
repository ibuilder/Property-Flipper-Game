# Releasing

```bash
git tag v2.1.0 && git push origin v2.1.0
```

That is the whole process. The workflow builds on Windows, macOS and Linux,
runs the typecheck and the full test suite, **launches the app on each of those
operating systems and asserts the renderer mounts**, packages, and publishes a
GitHub release. A platform that cannot start the app fails the release rather
than shipping it.

To try a release build without tagging, run the workflow manually from the
Actions tab.

## Verifying a build locally

```bash
npm run build && npm run smoke
```

`smoke` launches Electron against the production build, waits for the renderer
to mount, and exits non-zero if it does not. On headless Linux it runs under
`xvfb-run`.

---

## Code signing

Builds ship unsigned unless the credentials below are present as repository
secrets. Unsigned is not broken — it means Windows SmartScreen shows a warning
on first launch, and macOS Gatekeeper refuses to open the app until the user
right-clicks and chooses Open. Both are surmountable; neither is a good first
impression.

Signing cannot be set up from this repository alone, because both platforms
require a paid identity issued to a real person or company. What the repository
*can* do — and does — is use them automatically the moment they exist.

### Windows

Requires a code signing certificate from a CA (DigiCert, Sectigo, SSL.com and
others). Roughly $200–$400/year for an OV certificate; an EV certificate costs
more and additionally clears SmartScreen immediately rather than after the
build accumulates reputation.

Modern OV and EV certificates are usually issued on hardware tokens or through
a cloud signing service, which cannot be exported to a `.pfx`. If yours is one
of those, the workflow's `CSC_LINK` approach will not work and you will need
your provider's signing action instead.

For an exportable `.pfx`:

```bash
base64 -w 0 certificate.pfx > cert.txt   # macOS/Linux
```

Then set two repository secrets:

| Secret | Value |
| --- | --- |
| `WINDOWS_CERT_BASE64` | the contents of `cert.txt` |
| `WINDOWS_CERT_PASSWORD` | the password protecting the `.pfx` |

The timestamp server is already configured. It matters: without a timestamp, a
signature stops verifying the day the certificate expires rather than remaining
valid for everything signed while it was live.

### macOS

Requires membership of the Apple Developer Program ($99/year) and a **Developer
ID Application** certificate — not a Mac App Store one, which will not work for
software distributed outside the store.

1. In Xcode or the developer portal, create a Developer ID Application
   certificate and export it as a `.p12`.
2. Create an app-specific password at appleid.apple.com.
3. Find your Team ID in the membership section of the developer portal.

| Secret | Value |
| --- | --- |
| `CSC_LINK` | base64 of the `.p12` |
| `CSC_KEY_PASSWORD` | the `.p12` password |
| `APPLE_ID` | the Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password |
| `APPLE_TEAM_ID` | the ten-character Team ID |

Setting `APPLE_TEAM_ID` is what switches notarisation on. The hardened runtime
and `build/entitlements.mac.plist` are already configured, and both are
required: notarisation demands the hardened runtime, and the hardened runtime
blocks the executable memory V8's JIT needs. Without the entitlements the app
signs and notarises cleanly and then crashes on launch.

### Linux

AppImages are not code-signed by convention. Nothing to configure.

---

## What is not automated

- **Playtesting with people rather than the bot.** The balance harness proves
  a disciplined bot beats a reckless one across thirty seeds. It cannot tell
  you whether the game is any good.
- **itch.io.** Publishing there is a manual upload; the release artifacts are
  what you would upload.
