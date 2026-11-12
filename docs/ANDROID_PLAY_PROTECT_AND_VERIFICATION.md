# Android app: Play Protect appeal and developer verification

Reference data and step-by-step for the two Google-side tasks that keep the sideloaded
ASSDI Portal APK installable. Both must be done by a person signed in to the organization's
Google account; neither can be done from the codebase.

## App identity (do not change)

| Field | Value |
|---|---|
| Package name | `bd.asf.tasmskill.portal` |
| Current release | 1.2.0 (versionCode 3) |
| APK file SHA-256 (`public/downloads/asm-portal.apk`) | `5775001b7e1d9d4d6884c8dad28bc30532daf591b3642c65079a1f9bb9577dae` |
| Signing certificate DN | `CN=ASSDI Portal, O=ASF, C=BD` (RSA 4096, APK Signature Scheme v2) |
| Signing certificate SHA-256 | `B7:DE:2B:A7:6E:21:96:C0:11:03:A3:DE:4E:1B:61:7E:0F:8C:7E:85:34:4B:32:FD:E1:35:B3:FE:20:07:69:DC` |
| Signing certificate SHA-1 | `56:A0:BF:93:35:15:A2:8F:62:1E:DD:51:B1:63:A4:29:FD:B3:BC:D9` |
| Download page | https://tasm-skill.asf.bd/app |

The APK file hash changes with every release; the certificate fingerprint never changes as long
as `release.jks` is used. **Losing `release.jks` means the package can never be registered or
updated again** — keep the `signing-backup` copy safe and off the repo.

To recompute after a new release:

```
sha256sum public/downloads/asm-portal.apk
"%LOCALAPPDATA%\Android\Sdk\build-tools\35.0.0\apksigner.bat" verify --print-certs public\downloads\asm-portal.apk
```

## 1. Play Protect appeal

Form: https://support.google.com/googleplay/android-developer/contact/protectappeals
(guidance: https://developers.google.com/android/play-protect/warning-dev-guidance)

1. Upload `public/downloads/asm-portal.apk` to https://www.virustotal.com (File tab). Wait for the
   scan; the SHA-256 shown must match the APK file SHA-256 above.
2. Open the appeal form signed in with the organization's Google account and fill:
   - **Email:** organization contact email (verify it via the confirmation email afterwards).
   - **Developer name:** As-Sunnah Foundation (ASSDI)
   - **Package name:** `bd.asf.tasmskill.portal`
   - **SHA256 hash (VirusTotal):** the APK file SHA-256
   - **Additional information:** the text below.
3. Click the confirmation link in the email. Google sends **no decision reply**; check by
   installing on a fresh phone after 1–2 weeks.
4. Re-appeal with the new hash after each new APK release if warnings come back.

Note: the "Send app for a security check" prompt for unknown apps is not removed by an appeal;
only the "harmful / unsafe app blocked" classification is.

### Appeal text (paste into "Additional information")

> ASSDI Portal (bd.asf.tasmskill.portal) is the official Android app of As-Sunnah Skill
> Development Institute (As-Sunnah Foundation, Bangladesh), distributed only from our own website
> https://tasm-skill.asf.bd/app to our own students, trainers and staff. It is a WebView client for
> our learning portal plus a field-attendance feature.
>
> We believe the app is being flagged because of its location permissions. Their use is
> transparent and consent-based:
> - Location (including background location, via a foreground service of type "location") is
>   collected only after the user personally starts a field session in the app ("going to field" /
>   business-incubation check-in) and stops when they end it. It is never collected otherwise.
> - Before the background-location permission is requested, the app shows an in-app disclosure
>   dialog explaining what is collected and why. A persistent notification is visible the whole
>   time tracking runs, and the user can stop it at any time.
> - Location is sent only over HTTPS to our own server (tasm-skill.asf.bd) and is visible only to
>   the user's course administrators.
> - RECEIVE_BOOT_COMPLETED only resumes a session the user had already started.
>   REQUEST_INSTALL_PACKAGES is used only to install our own signed updates, after the user taps
>   "Update", and the downloaded file is checked against a SHA-256 published by our server.
>
> The app requests no SMS, call-log, contacts, accessibility or notification-listener
> permissions, contains no third-party ad or analytics SDKs, targets API 35, and is signed with a
> single organization key (certificate SHA-256
> B7:DE:2B:A7:6E:21:96:C0:11:03:A3:DE:4E:1B:61:7E:0F:8C:7E:85:34:4B:32:FD:E1:35:B3:FE:20:07:69:DC).
> Users are being blocked from installing it. We ask you to review the classification.

## 2. Android developer verification

Guide: https://developer.android.com/developer-verification/guides

**Timeline (as of 2026-11):** enforcement started 30 Sep 2026 in Brazil, Indonesia, Singapore
and Thailand only. Bangladesh is not in that wave and falls under the global rollout in 2027,
after which unregistered packages will not install on certified Android devices. Register now so
there is no break.

**Which console:** if the organization will publish on Google Play later, register through the
**Play Console** — Google says it can also register apps distributed outside Play, so one account
covers both. If Play is not planned, use the standalone **Android Developer Console**. Do not
create both for the same organization.

### Account (organization, full distribution)

Prepare before starting (Google says verification takes about 10 minutes once these are ready):

- Google account for the organization (not personal), with 2-Step Verification on.
- **D-U-N-S number** for As-Sunnah Foundation — free from Dun & Bradstreet; it can take a few
  weeks to be issued, so request it first. Organization name and address must match it exactly.
- **Verified website** in Google Search Console (asf.bd or tasm-skill.asf.bd).
- Official registration document of the organization (registration certificate / NGO
  registration), plus a contact email and phone number (OTP-verified).

### Register the package and key

1. Packages → Register package → package name `bd.asf.tasmskill.portal`.
2. Add the signing certificate SHA-256 from the table above. Status becomes "In review".
3. Proof of ownership: the console gives a small snippet file to put in the app's `assets`
   folder. Add it under `android/app/src/main/assets/`, build `gradlew.bat assembleRelease` with
   `release.jks`, and upload that APK. This build does not need to be published to users.
4. On success the status changes to "Registered" and an email is sent.
