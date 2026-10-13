# Data Privacy and Terms of Service Standards

When maintaining, updating, or extending user registration, authentication, profile data collection, or legal pages for PSITS Web System:

1. **Philippine Statutory Compliance**:
   - **Republic Act No. 10173 (Data Privacy Act of 2012)**: All personal and sensitive personal information (student IDs, full names, emails, academic programs, payment receipts) collected by PSITS Region XII must adhere to transparency, legitimate purpose, and proportionality.
   - **Republic Act No. 10175 (Cybercrime Prevention Act of 2012)**: Prohibit unauthorized access, system interference, scraping, automated bot submission, and account sharing. Violations must be subject to immediate disciplinary and legal referral.

2. **Explicit Consent & User Registration**:
   - The registration page (`/register`) must require explicit, active agreement checkbox acknowledgment for both the Privacy Policy and Terms and Conditions before submission.
   - Pre-checked consent boxes are strictly disallowed.
   - Users must be able to review the complete legal text via an in-app interactive modal (`LegalTermsModal`) or through dedicated public routes (`/privacy`, `/terms`) without losing their filled registration form data.

3. **Public Accessibility & Placement**:
   - Dedicated public pages `/privacy` and `/terms` must remain publicly accessible without requiring user authentication.
   - Direct clickable links to both policies must be maintained across key system surfaces:
     - Landing page footer (`LandingPage.tsx`)
     - Login page footer (`LoginPage.tsx`)
     - Register page agreement section (`RegisterPage.tsx`)
     - User settings & profile security section (`SettingsPage.tsx`)
     - Authenticated portal sidebar navigation (`Sidebar.tsx`)

4. **Security, Retention, and Data Subject Rights**:
   - Payment receipts (Official Receipts, GCash screenshots, bank slips) and voting records must be encrypted in transit and at rest.
   - Uphold data subject rights under RA 10173: right to be informed, right to access, right to rectification, right to erasure/blocking, and right to damages.
   - Direct inquiries and privacy grievances must provide a clear channel to the PSITS Region XII Data Protection Officer (DPO).

5. **In-App Legal Viewer Capabilities**:
   - The `LegalTermsModal` must support search filtering across sections, tab switching between Privacy Policy and Terms of Service, print capability, and responsive layout for mobile and desktop screens.
