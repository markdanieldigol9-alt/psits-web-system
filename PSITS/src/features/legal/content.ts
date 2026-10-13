export interface LegalSection {
  id: string;
  title: string;
  badge?: string;
  paragraphs: string[];
  bulletPoints?: string[];
  warningNote?: string;
}

export const PRIVACY_POLICY_LAST_UPDATED = 'October 13, 2026';
export const TERMS_LAST_UPDATED = 'October 13, 2026';

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    id: 'commitment',
    title: '1. Institutional Commitment & Legal Framework',
    badge: 'RA 10173 Compliance',
    paragraphs: [
      'The Philippine Society of Information Technology Students Region XII (PSITS Region XII, "we", "us", or "our") is dedicated to protecting the confidentiality, integrity, and privacy of personal data entrusted to us by students, faculty advisers, academic partners, and organizational officers.',
      'This Privacy Policy is promulgated in strict adherence to Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012 (DPA), its Implementing Rules and Regulations (IRR), and relevant issuances of the National Privacy Commission (NPC) of the Republic of the Philippines.',
      'By creating an account, registering for regional events, utilizing payment facilities, participating in elections, or browsing the PSITS Web System (psits-web-system.vercel.app), you acknowledge that you have read, understood, and consented to the data collection and processing activities detailed herein.',
    ],
  },
  {
    id: 'data-collected',
    title: '2. Personal Data We Collect',
    badge: 'Data Categories',
    paragraphs: [
      'We collect personal data directly from you when you register an account, file membership applications, submit payments, register for events, cast election ballots, or interact with regional modules.',
    ],
    bulletPoints: [
      'Identity & Academic Information: Full legal name, official student ID / institutional identification number, enrolled higher education institution (HEI), academic degree program, year level, institutional email address, and mobile phone number.',
      'Financial & Payment Verification Records: GCash reference numbers, bank deposit slips, electronic fund transfer receipts, and official receipts (OR) issued by authorized PSITS officers. (Note: PSITS does not store credit card CVVs or bank credentials).',
      'Event & Competition Participation: Event registrations, attendee check-in timestamps, attendance QR codes, team rosters, and esports player identifiers (in-game IDs, server IDs).',
      'Electoral Participation & Ballot Audits: Voter eligibility verification status, cryptographic election voting tokens, and cast ballot records. Cast ballots are cryptographically separated from user profile identities to guarantee absolute secret balloting.',
      'Community & Interactive Features: Forum submissions, discussion replies, media attachments, and live stream chat interactions.',
      'Technical & Device Metadata: IP addresses, session tokens (JWT), browser user agents, access timestamps, and device diagnostics required for cyber defense and fraud detection.',
    ],
  },
  {
    id: 'purposes',
    title: '3. Legal Bases and Purposes of Processing',
    badge: 'Processing Mandates',
    paragraphs: [
      'We process your personal information exclusively for legitimate academic, organizational, and operational purposes pursuant to Section 12 and Section 13 of Republic Act No. 10173:',
    ],
    bulletPoints: [
      'Membership Administration: Verifying bona fide IT/CS/IS student status and institutional delegation eligibility across Region XII.',
      'Event Operations & Accreditation: Managing event capacity, issuing official registration badges, validating attendance check-ins, and distributing digital Certificates of Participation/Completion.',
      'Financial Transparency & Audit: Verifying payment authenticity, tracking organizational dues, preventing financial fraud, and maintaining audit-compliant financial registers.',
      'Democratic Process & Elections: Conducting secure, transparent, and uncompromised officer elections with verified one-person-one-vote enforcement.',
      'Cybersecurity & Platform Integrity: Detecting anomalous login attempts, mitigating DDoS or brute force attacks, and safeguarding the web system infrastructure against malicious cyber threats.',
      'Official Communication: Delivering institutional notices, event schedules, payment receipt confirmations, and important regional announcements.',
    ],
  },
  {
    id: 'security-measures',
    title: '4. Information Security & Technical Safeguards',
    badge: 'System Protection',
    paragraphs: [
      'PSITS implements stringent physical, technical, and organizational security measures to prevent unauthorized access, alteration, disclosure, or destruction of your personal data:',
    ],
    bulletPoints: [
      'Encryption Standards: High-grade TLS 1.3 encryption for all data in transit across web browsers and backend APIs.',
      'Cryptographic Password Storage: Passwords are salted and hashed using industry-standard bcrypt algorithms. Passwords are never stored in plaintext and cannot be read by administrators.',
      'Role-Based Access Control (RBAC): Principle of least privilege enforced across Super Admin, Admin, Officer, and Member roles, preventing unauthorized access across system boundaries.',
      'Ephemeral Session Tokens: Authentication uses cryptographically signed JWT tokens with expiration policies to guard against session hijacking.',
      'Persistent Cloud Storage Safeguards: Crucial static configurations and official payment QR codes are encrypted and stored in secure MySQL relational databases with automated backup hygiene.',
    ],
  },
  {
    id: 'data-sharing',
    title: '5. Data Disclosure & Third-Party Sharing',
    badge: 'Strict Non-Disclosure',
    paragraphs: [
      'PSITS Region XII DOES NOT sell, rent, monetize, or trade your personal information to commercial entities, advertisers, or unauthorized third parties.',
      'Limited disclosures are conducted exclusively in the following circumscribed situations:',
    ],
    bulletPoints: [
      'Institutional Coordination: Sharing participant delegation lists and attendance logs with designated Dean/Program Head/Advisers of your registered academic institution for academic clearance and excuse letters.',
      'Essential Service Providers: Encrypted cloud database and hosting providers (Vercel, Render) operating as data processors bound by stringent confidentiality agreements.',
      'Legal & Regulatory Directives: When strictly mandated by valid subpoena, lawful order of a competent Philippine court, or formal directive from the National Privacy Commission (NPC).',
    ],
  },
  {
    id: 'rights',
    title: '6. Your Rights Under Republic Act No. 10173',
    badge: 'Data Subject Rights',
    paragraphs: [
      'As a registered data subject under the Philippine Data Privacy Act, you are entitled to the following statutory rights:',
    ],
    bulletPoints: [
      'Right to be Informed: The right to know whether your personal data is being processed, why, and how.',
      'Right to Access: The right to view and obtain a reasonable copy of your personal data held in the system.',
      'Right to Rectification: The right to dispute any inaccuracy or error in your personal data and demand immediate correction through your Settings profile.',
      'Right to Erasure or Blocking: The right to suspend, withdraw, or order the removal of your personal data upon graduation or disaffiliation, subject to applicable accounting and auditing retention rules.',
      'Right to Damages: The right to be indemnified for any damages sustained due to inaccurate, incomplete, outdated, false, unlawfully obtained, or unauthorized use of your personal data.',
      'Right to File a Complaint: The right to seek redress with the National Privacy Commission (NPC) if your privacy rights have been violated.',
    ],
  },
  {
    id: 'retention',
    title: '7. Data Retention and Disposal Schedules',
    badge: 'Retention Policy',
    paragraphs: [
      'Your personal data is retained for the duration of your active membership and academic residency within Region XII higher educational institutions.',
      'Financial records and event attendance archives are kept for a standard audit duration of three (3) years to satisfy organizational accounting obligations and verify past certificate issuance.',
      'Upon expiration of the retention schedule or upon verified account deletion request, digital records undergo secure digital shredding and database de-identification.',
    ],
  },
  {
    id: 'contact-dpo',
    title: '8. Data Protection Officer (DPO) Inquiries',
    badge: 'Contact & Support',
    paragraphs: [
      'If you have questions, concerns, requests for data access or rectification, or wish to exercise your data subject rights, please contact our Data Protection Committee:',
      'Data Protection Officer (DPO)\nPhilippine Society of Information Technology Students - Region XII\nEmail: dpo@psits12.org | admin@psits.com\nRegional Secretariat: SOCCSKSARGEN, Philippines',
    ],
  },
];

export const TERMS_AND_CONDITIONS_SECTIONS: LegalSection[] = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms and Binding Agreement',
    badge: 'Terms of Use',
    paragraphs: [
      'These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User", "Member", or "Visitor") and the Philippine Society of Information Technology Students Region XII (PSITS Region XII) governing your access to and use of the PSITS Web System.',
      'By creating an account, authenticating credentials, registering for events, or accessing any module of this platform, you affirm that you are at least 15 years of age and agree to comply unconditionally with all provisions set forth herein.',
      'If you do not agree to these Terms, you must immediately cease accessing and using the platform.',
    ],
  },
  {
    id: 'account-integrity',
    title: '2. User Accounts and Credential Responsibility',
    badge: 'Account Security',
    paragraphs: [
      'To access membership privileges, event registrations, and community tools, you must register a personal user account.',
    ],
    bulletPoints: [
      'Truthful Representations: You agree to provide true, accurate, and current academic and institutional information. Impersonating other students, officers, or faculty members is strictly prohibited.',
      'Credential Confidentiality: You are solely responsible for maintaining the confidentiality of your login password and session security. Never share your password or two-factor access tokens with anyone.',
      'Account Lending Prohibited: Account sharing, selling, or unauthorized transfers are strictly prohibited. You are liable for all actions, registrations, and transactions conducted under your authenticated session.',
      'Notification of Breach: You must immediately notify the PSITS Regional Administration if you discover any unauthorized access or security breach involving your account.',
    ],
  },
  {
    id: 'system-protection',
    title: '3. Acceptable Use Policy & System Protection (Cybersecurity Clause)',
    badge: 'Strict Security Rules',
    paragraphs: [
      'To protect the system infrastructure, ensure 24/7 service availability, and prevent security breaches, users are strictly prohibited from engaging in any of the following activities:',
    ],
    bulletPoints: [
      'Unauthorized Penetration Testing: Probing, scanning, fuzzing, vulnerability assessment, or attempting to breach platform authentication mechanisms without explicit, prior written authorization from the PSITS Technical Team.',
      'Denial of Service (DoS/DDoS): Initiating automated request floods, resource exhaustion attacks, or actions designed to degrade system response times or crash backend servers.',
      'Automated Scraping & Bots: Utilizing automated crawlers, scrapers, data-mining scripts, or headless bots to extract membership rosters, event data, election information, or system source assets.',
      'Injection & Exploits: Submitting SQL injection, Cross-Site Scripting (XSS), remote code execution payloads, shell scripts, or malicious binaries through form fields, avatar uploads, or forum attachments.',
      'Election Tampering: Attempting to bypass ballot validation, vote multiple times, automate ballot submissions, spoof voting tokens, or manipulate election tallies.',
      'Reverse Engineering: Decompiling, reverse engineering, disassembling, or attempting to derive source code or proprietary architecture of the PSITS Web System.',
    ],
    warningNote: 'Violations of cybersecurity policies will result in immediate permanent account termination, reporting to the Dean/Student Affairs Office of your institution, and criminal prosecution under Republic Act No. 10175 (Cybercrime Prevention Act of 2012).',
  },
  {
    id: 'payments-verification',
    title: '4. Payments, Official Receipts, and Payment Verification',
    badge: 'Financial Terms',
    paragraphs: [
      'Payments for regional membership dues, institutional affiliations, and event registration fees must comply with official verification standards:',
    ],
    bulletPoints: [
      'Authentic Proof of Payment: Users must submit authentic, unaltered transaction receipts, bank deposit slips, GCash reference numbers, or Official Receipts (OR) issued by authorized PSITS officers.',
      'Fraudulent Submissions: Fabricating, forging, digitally manipulating screenshots, or submitting duplicate transaction reference numbers constitutes financial fraud. Any such attempt will trigger immediate account suspension and institutional investigation.',
      'Refund Policy: Due to advance reservation costs for regional venues, physical kits, and streaming licenses, registration fees and membership dues are non-refundable once an application or event registration has been approved.',
      'Officer Verifications: Payments made "Through Officer" must be accompanied by an official physical or digital OR number recorded in the regional ledger.',
    ],
  },
  {
    id: 'elections-integrity',
    title: '5. Democratic Process & Election Conduct',
    badge: 'Voting Standards',
    paragraphs: [
      'PSITS Region XII is dedicated to transparent, democratic officer elections:',
    ],
    bulletPoints: [
      'One Member, One Vote: Each active, verified member is entitled to exactly one ballot during active election cycles.',
      'Ballot Secrecy: Voting decisions are secret. Any coercion, vote trading, proxy voting, or programmatic harvesting of ballots is strictly forbidden.',
      'Candidate Conduct: Candidates must adhere to regional campaign guidelines. Slander, defamation, or unauthorized campaign spam across platform modules is ground for disqualification.',
    ],
  },
  {
    id: 'community-standards',
    title: '6. Community Forums & Live Stream Conduct',
    badge: 'Community Standards',
    paragraphs: [
      'The PSITS Community Forum and Live Stream chat are collaborative, professional academic spaces:',
    ],
    bulletPoints: [
      'Prohibited Content: Uploading pornography, obscenity, hate speech, cyberbullying, harassment, intellectual property infringements, or commercial advertisements is strictly forbidden.',
      'Moderation Authority: PSITS moderators reserve the right to review, edit, unpublish, or permanently delete any content that violates regional policies without prior notice.',
      'User Liability: Users retain full legal liability for any defamatory or unlawful content posted under their authenticated profile.',
    ],
  },
  {
    id: 'intellectual-property',
    title: '7. Intellectual Property Rights',
    badge: 'Proprietary Assets',
    paragraphs: [
      'All intellectual property rights associated with the PSITS Web System, including but not limited to the PSITS Region XII logos, branding, user interface design, tournament bracket frameworks, certificates, documentation, and source code, are the sole property of PSITS Region XII.',
      'Users are granted a limited, revocable, non-exclusive, non-transferable license to access the platform for legitimate educational and organizational purposes.',
    ],
  },
  {
    id: 'suspension-termination',
    title: '8. Account Suspension, Termination & Appeals',
    badge: 'Enforcement',
    paragraphs: [
      'PSITS Region XII reserves the right to suspend or terminate accounts that breach these Terms or the Data Privacy Act.',
      'Suspended members will have their access restricted to the account reactivation request desk, where they may submit official clarification to the Regional President and Committee of Officers.',
    ],
  },
  {
    id: 'disclaimer-liability',
    title: '9. Disclaimer of Warranties & Limitation of Liability',
    badge: 'Legal Disclaimers',
    paragraphs: [
      'The PSITS Web System is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied.',
      'While we implement enterprise-grade security, PSITS Region XII shall not be liable for indirect, incidental, special, or consequential damages resulting from upstream cloud outages (such as Render or Vercel infrastructure downtime), ISP connectivity failures, or user failure to safeguard account credentials.',
    ],
  },
  {
    id: 'governing-law',
    title: '10. Governing Law and Dispute Resolution',
    badge: 'Jurisdiction',
    paragraphs: [
      'These Terms shall be governed by and construed in accordance with the laws of the Republic of the Philippines.',
      'Any legal disputes or proceedings arising out of or in connection with these Terms or the use of the platform shall be submitted to the exclusive jurisdiction of the competent courts of Region XII (SOCCSKSARGEN), Republic of the Philippines.',
    ],
  },
];
