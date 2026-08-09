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

**It also has to be checked afterwards.** The pipeline was exercised end to end
with a throwaway self-signed certificate, and that turned up something worth
knowing: when the timestamp server could not be reached, signtool printed a
loud error, electron-builder carried on, and the build exited zero with signed
but *untimestamped* artifacts. So the release workflow verifies the signature
after packaging and fails if the status is not `Valid` or if no timestamp is
present. Without that check, a signing failure ships quietly.

To exercise the whole path yourself before buying a certificate:

```powershell
$c = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Signing test" `
     -CertStoreLocation Cert:\CurrentUser\My -NotAfter (Get-Date).AddDays(2)
Export-PfxCertificate -Cert $c -FilePath test.pfx `
     -Password (ConvertTo-SecureString "test" -Force -AsPlainText)
Remove-Item "Cert:\CurrentUser\My\$($c.Thumbprint)"

$env:CSC_LINK = "$PWD\test.pfx"; $env:CSC_KEY_PASSWORD = "test"; npm run dist
Get-ChildItem release\*.exe | ForEach-Object { Get-AuthenticodeSignature $_.FullName }
```

A self-signed certificate reports `UnknownError` rather than `Valid` — the
chain is untrusted, which is correct and expected. What you are checking is
that a signer certificate is attached at all. Delete `test.pfx` afterwards.

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
| `MAC_CERT_BASE64` | base64 of the `.p12` |
| `MAC_CERT_PASSWORD` | the `.p12` password |
| `APPLE_ID` | the Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password |
| `APPLE_TEAM_ID` | the ten-character Team ID |

The macOS certificate has its own secret names rather than sharing `CSC_LINK`
with Windows. Sharing them meant every platform received an empty `CSC_LINK`
when only one certificate was configured, and electron-builder reads an empty
value as a path rather than as absent — it resolved to the repository root and
failed the macOS build outright. The workflow now exports credentials only for
the platform they belong to, and only when they exist.

Setting `APPLE_TEAM_ID` is what switches notarisation on. The hardened runtime
and `build/entitlements.mac.plist` are already configured, and both are
required: notarisation demands the hardened runtime, and the hardened runtime
blocks the executable memory V8's JIT needs. Without the entitlements the app
signs and notarises cleanly and then crashes on launch.

### Linux

AppImages are not code-signed by convention. Nothing to configure.

---

---

## itch.io

Publishing is automated. Tagging a release pushes four channels — the playable
browser build plus Windows, macOS and Linux downloads — using butler.

Three settings, once:

| Where | Name | Value |
| --- | --- | --- |
| Secret | `ITCH_API_KEY` | from <https://itch.io/user/settings/api-keys> |
| Variable | `ITCH_USER` | your itch.io username |
| Variable | `ITCH_GAME` | the project's URL slug |

Variables live under Settings → Secrets and variables → Actions → *Variables*,
not Secrets — they are not sensitive and appear in the job summary as a link.

Without the API key the workflow skips rather than fails, so it is safe to
merge before the account is wired up. With the key but without the variables it
fails loudly, because that combination is always a mistake.

**Create the project on itch.io first**, as *HTML* kind, and set the embed to
1280 × 800 manually. Below 1240px the layout collapses to a single column,
which works but hides the side-by-side comparisons the game is built around.

[docs/itch-page.md](docs/itch-page.md) has the page copy, the settings table,
the tag list, and a screenshot shot-list.

To push only the browser build without tagging, run the workflow manually and
choose `web-only`.

---

## What is not automated

- **Playtesting with people rather than the bot.** The balance harness proves a
  disciplined bot beats a reckless one across thirty seeds. It cannot tell you
  whether the game is any good, whether the vocabulary lands, or where a
  beginner gets stuck. See [docs/playtesting.md](docs/playtesting.md) for a
  three-session protocol and what to do with the results.
- **Buying the signing identities.** Both require a real identity and a card.
