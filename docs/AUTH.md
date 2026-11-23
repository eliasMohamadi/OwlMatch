# Sign-in

OwlMatch has two ways in:

| Who | How | Acts as |
|---|---|---|
| **Students** | *Sign in with Microsoft* using their KSU account (`@students.kennesaw.edu` or `@kennesaw.edu` by default) | Their own student record, created on first sign-in |
| **Admin** (for testing) | Password from `ADMIN_PASSWORD` | Any **demo** student, chosen per tab. Never a real student |

## How Microsoft Authenticator fits in

OwlMatch never handles passwords or second factors. The browser goes to Microsoft's sign-in page for the university tenant. There Microsoft checks the password and runs the multi-factor prompt (the Microsoft Authenticator approval) according to the university's MFA policy. KSU requires MFA for its accounts, so students approve the sign-in in Authenticator as they do for Outlook or D2L. Microsoft then sends OwlMatch an ID token, and the server verifies it:

- **Signature:** RS256 against Microsoft's published signing keys for the tenant (refreshed when keys rotate).
- **Tenant:** `iss` and `tid` must equal `ENTRA_TENANT_ID`. This matters because any Microsoft tenant can put any address in its users' email fields. Pinning the university tenant means only accounts the university manages can sign in.
- **Audience, expiry and nonce:** the token must be for this app, current, and tied to this browser's sign-in attempt (the nonce and PKCE verifier are kept in a short-lived signed cookie).
- **Email domain:** the account's university sign-in name must end in one of `ALLOWED_EMAIL_DOMAINS` (exact match).

Students are identified by tenant + Entra object id, not by email, so a renamed address keeps the same OwlMatch profile.

> MFA enforcement belongs to the university tenant: OwlMatch can't make Microsoft show an Authenticator prompt that the tenant's policy doesn't require. If you test against a tenant without MFA (e.g. a personal developer tenant), you'll get a password-only sign-in. Turn on *Security defaults* or a Conditional Access MFA policy there to see the Authenticator step.

## Set up Microsoft sign-in

1. In the [Microsoft Entra admin center](https://entra.microsoft.com) go to **App registrations → New registration**.
   - Name: `OwlMatch`
   - Supported account types: **Accounts in this organizational directory only** (single tenant)
   - Redirect URI: platform **Web**, `http://localhost:5173/api/auth/microsoft/callback` for development. Add your production URL, e.g. `https://owlmatch.example.com/api/auth/microsoft/callback`, as a second redirect URI.
2. On the app's **Overview**, copy the **Application (client) ID** and **Directory (tenant) ID**.
3. **Certificates & secrets → New client secret**. Copy the secret *value*.
4. **API permissions:** the default `User.Read` delegated permission is enough (OwlMatch requests only `openid profile email`).
5. Put the values in `.env`:

   ```bash
   ENTRA_TENANT_ID=<directory (tenant) id GUID>
   ENTRA_CLIENT_ID=<application (client) id>
   ENTRA_CLIENT_SECRET=<client secret value>
   APP_BASE_URL=http://localhost:5173      # the URL students open; must match the redirect URI
   SESSION_SECRET=<random string, 32+ characters>
   ```

   Generate a session secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

6. Restart the server. It logs `Microsoft sign-in enabled for students.kennesaw.edu, kennesaw.edu`.

**Using KSU's tenant.** For real KSU students, the app registration must live in (or be consented to by) KSU's Entra tenant, and `ENTRA_TENANT_ID` must be KSU's tenant id. Many universities block students from consenting to third-party apps, so KSU IT may need to register or approve the app. Until then you can develop against your own Entra tenant: set `ALLOWED_EMAIL_DOMAINS` to that tenant's domain (for example `yourtenant.onmicrosoft.com`).

## Admin sign-in

Set `ADMIN_PASSWORD` (at least 12 characters in production). The sign-in page then shows **Admin sign-in (demo students)**. An admin:

- acts as one demo student per tab, chosen with the avatar menu or `?as=<studentId>` in the URL (so two tabs can be two students),
- can reset the data (Profile → Reset demo data). In production the reset also needs `OWLMATCH_ALLOW_RESET=1`,
- can't act as, list or read real students.

After 5 wrong passwords from the same address, admin sign-in locks for 15 minutes.

## Sessions

Sessions are HttpOnly, `SameSite=Lax` cookies signed with `SESSION_SECRET` (HMAC-SHA256). They're `Secure` when `APP_BASE_URL` is https or `NODE_ENV=production`. Students stay signed in for 7 days and admins for 12 hours. Without `SESSION_SECRET`, a development server uses a random secret, so everyone is signed out when it restarts. A production server refuses to start without one.

The server never trusts a student id sent by the browser. Every event action, profile read and upload acts as the session's student (or the admin's chosen demo student), and `/api/students/:id/...` returns 403 for any other id.
