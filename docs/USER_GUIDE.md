# PSITS Region XII Web-Based Management System
## Comprehensive User & Operations Manual

---

### Executive Overview & Technology Architecture
The **PSITS Region XII Web-Based Management System** is an enterprise management, reporting, and engagement portal engineered for the Philippine Society of Information Technology Students (Region XII Chapter). The system integrates academic institution delegations, student member records, real-time digital elections, payment audit trails, event logistics with live streaming, partner contributions, and institutional analytics.

- **Frontend Presentation Layer**: React 19 Single Page Application (SPA) with TypeScript, Tailwind CSS (with Dual Light & Obsidian Dark `#0B1326` themes), Lucide Icons, and responsive table views.
- **Backend Application Layer**: Node.js & Express REST API with JSON Web Token (JWT) stateless authorization, bcrypt credential hashing, role-based access control (RBAC), and query profiling.
- **Database Storage Layer**: MySQL relational engine featuring indexed foreign keys, connection pooling, and ACID transactional guarantees for financial mutations.

---

## 1. User Roles & Access Hierarchy

The system defines five primary operational role tiers:

| Role Title | Target Users | Scope of Access |
| :--- | :--- | :--- |
| **Super Admin** | Regional Director / Adviser / Head Administrator | Full administrative governance: system settings, officer management, database logs, financial auditing, reporting, and user account overrides. |
| **Admin** | Senior Executive Officers / System Administrators | Elevated operational privileges: manage members, review payments, configure events, publish announcements, manage elections, and generate reports. |
| **Officer** | Regional Student Officers & Committee Heads | Daily event logistics, manual payment verification, receipt inspection, attendance check-ins, candidate platform curation, and forum moderation. |
| **Member (Individual)** | Enrolled IT/CS Students & Educators | Profile management, membership renewal, personal event registration, guidelines download, voting in elections, forum engagement, and payment history tracking. |
| **Member (Institution)** | School Chapter Presidents & Department Chairs | Batch collegiate roster management, team-based event registration, multi-slot payment remittances, and institutional leaderboard tracking. |
| **Industry Partner** | Corporate Sponsors, Tech Companies & Vendors | Sponsor profile management, memorandum of agreement (MOA) tracking, and partnership contribution monitoring. |

---

## 2. User / Member Guide (User Side)

### 2.1 Account Registration & Onboarding
1. **Navigating to Registration**: On the landing page or login screen, click **"Register as Member"**.
2. **Selecting Membership Type**:
   - **Individual Member**: For independent students or educators registering on their own. Requires Full Name, Institutional Affiliation, Student/ID Number, Email, and Password.
   - **Institution Representative**: For official school department heads or council leaders. Requires School/University Name, Campus Address, Contact Representative Details, and Head Count estimates.
3. **Accepting Terms**: Review the organizational Constitution & By-Laws and Data Privacy policy before submitting.
4. **Initial Account Status**: Upon submission, accounts are assigned a `pending` status awaiting membership payment verification.

### 2.2 Payment Submission & Membership Renewal
1. Navigate to the **Payments** page from the sidebar menu.
2. Review the **Dynamic Payment Instructions Card**:
   - **GCash**: Scan the regional QR code or copy the designated account number.
   - **Bank Transfer**: View bank name, account number, and depository branch.
   - **Through Officer**: Note authorized on-campus officer collection schedules.
3. Click **"Submit Payment Proof"** or **"Renew Membership"**:
   - Enter the exact amount paid (e.g., ₱250 for individual membership).
   - Select the payment method used.
   - **For GCash/Bank**: Upload the transaction screenshot and input the mandatory **Reference Number**.
   - **For Officer Payment**: Upload the scanned **Official Receipt (OR)** provided by the collecting officer.
4. **Tracking Status**: Your submission appears with a `pending` badge. Once an officer verifies the payment, your account transitions to `active`, extending validity by 1 calendar year.
5. **Handling Rejections**: If a receipt is rejected due to illegibility or incorrect amount, click **"Re-upload Receipt"** on the transaction record to resubmit without starting over.

### 2.3 Event Registration & Roster Participation
1. Browse upcoming activities on the **Events** page.
2. Click an event card to open the **Event Details & Guidelines Modal**.
3. **Review Rules**:
   - Read the embedded guideline markdown text.
   - Click the attachment link to download the official guidelines document (`PDF`, `DOCX`, etc.).
   - For Esports events, inspect the game rules, match brackets, and squad constraints.
4. Click **"Register for Event"**:
   - **Individual Registration**: Confirm your attendance and upload event registration fee proof if applicable.
   - **Institutional Batch Registration**: School representatives can select registered student participants from their collegiate roster to register them in batch.

### 2.4 Digital Elections & Secret Ballot Voting
1. Navigate to the **Elections** page during an active voting period.
2. Ensure your account is **Active** (expired or pending members cannot cast ballots).
3. Review Candidate Profiles, party affiliations, and submitted candidate platforms.
4. Select your preferred candidate for each executive position (President, VP, Secretary, etc.).
5. Click **"Cast Official Ballot"** and confirm your selection.
6. The system records your vote through a cryptographic one-way transaction preventing double-voting, while immediately anonymizing the ballot to protect voter privacy.

### 2.5 Community Forum & Live Event Streams
- **Forum**: Create discussions, filter by categories (Tech Talk, Academics, Announcements), like insightful posts, and reply to peer threads.
- **Live Streams**: Open the **Live Events** portal during regional conventions to view real-time broadcasts, ask questions in the moderated chat, or watch archived seminar recordings.

---

## 3. PSITS Officer Guide (Officer Side)

### 3.1 Financial Audit & Payment Verification Workflow
Officers are responsible for ensuring that all remitted dues and event fees match verified financial inflows.

1. Navigate to the **Payments** module (`/payments`).
2. Filter the table by **Status: Pending Verification**.
3. Click the **View / Audit** button on any record:
   - Inspect the uploaded **Official Receipt (OR)**, GCash transfer screenshot, or bank deposit slip.
   - Verify that the reference number matches official bank/wallet SMS confirmations.
4. **To Verify**:
   - Click **"Verify Payment"**.
   - The system initiates an ACID database transaction: marks payment `verified`, updates member status to `active`, extends membership expiration by 365 days, generates an immutable entry in `payment_status_logs`, and dispatches an automated in-app confirmation notification to the student.
5. **To Reject / Flag**:
   - Click **"Reject Payment"**.
   - Input a clear, specific rejection reason (e.g., *"Reference number not found in GCash merchant statement"*, *"Blurry receipt image"*).
   - Confirm rejection. The student receives an immediate alert prompting them to upload a corrected receipt.

### 3.2 Recording Manual Officer Cash Remittances
When collecting physical cash on school campuses:
1. On the Payments page, click **"Record Payment / Remittance"**.
2. Select the member from the dropdown search.
3. Input the cash amount collected and specify payment kind (`Membership Fee` or `Event Registration`).
4. Select `Through Officer` as payment method.
5. In compliance with financial guidelines, **no file upload is required for direct officer cash recording**, as cash is collected face-to-face and automatically reconciled into the officer's remittance ledger.

### 3.3 Event Management & Participant Rosters
1. Navigate to **Events** -> **"Create New Event"**.
2. Enter Event Title, Category, Location/Platform, and Schedule:
   - **Start Date / Time** and **End Date / Time** automatically compute whether the event is `Upcoming`, `Ongoing`, or `Completed`.
   - **Registration Schedule**: Set `registration_start_at` and `registration_end_at` to naturally open/close student sign-ups.
3. Guidelines Setup:
   - Type markdown rules in the text editor.
   - Attach the official guidelines file (`PDF`/`DOCX`/`PNG`) via the document upload zone.
4. Esports Configuration:
   - When Category is set to `Esports`, tournament bracket configurations (Game Title, Single/Double Elimination, Max Teams) activate automatically.
5. **Monitoring Turnout**:
   - Open the **Participant Roster Modal** to view both individual self-registrations and institutional batch rosters.
   - Mark in-venue attendance check-ins using the rapid toggle switch.

### 3.4 Publishing News & Official Announcements
1. Navigate to **Announcements** -> **"New Post"**.
2. Select priority level (`Normal`, `Urgent`, `Critical Banner`).
3. Set audience visibility (`All Members`, `Officers Only`, `Institution Heads`).
4. Attach relevant graphic banners and publish.

---

## 4. Administrator & Super Admin Guide (Admin Side)

### 4.1 Officer Roster & Dynamic Position Governance
1. Navigate to the **Officers** module.
2. Click **"Manage Leadership Positions"**:
   - Create, edit, or reorder executive positions (e.g., Regional Governor, VP for Internal Affairs, Committee Chair on Academics).
   - Define custom access permission flags per position.
3. Appoint officers by selecting active registered members, assigning their executive title, term period, and campus representation.

### 4.2 Membership Governance & Disciplinary Controls
1. Open the **Members Directory** (`/members`).
2. Search members across institutions, member types, or validation statuses.
3. Member Management Actions:
   - **Manual Activation**: Overwrite status for special sponsored delegations.
   - **Suspension / Ban**: Temporarily suspend or indefinitely ban accounts violating organization bylaws, automatically revoking system login sessions.
   - **Reset Password**: Generate a secure temporary recovery credential for locked-out members.

### 4.3 Election Administration & Candidate Slates
1. Navigate to **Elections** -> **"Create Election"**.
2. Set the election Title, Description, and strict Ballot Opening / Closing timestamps.
3. Define Allowed Positions on the digital ballot.
4. **Vetting Candidates**: Review candidate application profiles, approve qualified candidates, and upload official campaign platforms and photos.
5. **Live Monitoring & Results Certification**:
   - Monitor real-time voter turnout rates per university chapter.
   - When the voting window expires, review final automated tallies and click **"Certify & Publish Official Results"**.

### 4.4 Financial Reports, Document Previews & Data Exports
In accordance with standard reporting guidelines:
1. Navigate to **Reports** (`/reports`).
2. Select report category:
   - **Executive Dashboard KPI Summary**
   - **Membership Collections & Delinquency Report**
   - **Event Attendance & Institution Delegation Roster**
   - **Partner Contributions & Resource Utilization**
3. **Structured Table Previews**: Review structured data grids equipped with column headers, formatted currency values (`₱`), and normalized dates.
4. **Export to Excel (`Export Excel` / CSV)**:
   - Click **"Export Excel"**. The system dynamically loads `xlsx` and extracts the active filtered dataset into a clean spreadsheet file with human-readable headers.
5. **Print Report (`Print Report`)**:
   - Click **"Print Report"**. Automatically renders the complete, unpaginated table dataset inside `#printable-report-area`, hiding all navigational sidebars and buttons via `@media print`.
6. **Save to PDF (`Save PDF`)**:
   - Generates an institutional-grade PDF document containing organizational headers, generated timestamp, active filters, and authorized officer signature blocks.

### 4.5 System Settings, Theme & Performance Monitoring
1. Navigate to **Settings** (`/settings`):
   - **GCash Payment QR Code**: Upload updated merchant QR code image for automatic display across all member billing portals.
   - **Theme Configuration**: Toggle between **Light Mode** and **Obsidian Dark Mode** (`#0B1326`), or let the system follow OS device preference.
   - **Database & Query Performance**: Review query latency stats in `slow_query_logs` to maintain peak system responsiveness during major regional events.

---

## 5. Security & Maintenance Best Practices
1. **Password Integrity**: Use passwords with a minimum of 8 characters, including uppercase, lowercase, numbers, and symbols.
2. **Session Security**: Always log out when using public campus computer laboratories or kiosk workstations.
3. **Receipt Authenticity**: Tampered or fabricated transaction screenshots will result in immediate account suspension and notification of the respective dean's office.
4. **Regular Database Optimization**: Run periodic index maintenance and verify backups before major regional events and elections.
