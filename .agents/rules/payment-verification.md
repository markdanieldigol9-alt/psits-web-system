---
trigger: always_on
description: Verification requirements and proof upload rules for event and fee payments.
---

# Payment Verification Rules

When implementing or modifying payment flows, forms, or admin verification for PSITS:

1. **Accepted Payment Methods**:
   - `Through Officer`: Requires uploading an Official Receipt (OR).
   - `Bank Transfer`: Requires uploading the bank deposit/transfer receipt.
   - `Cheque`: Requires uploading the cheque payment receipt.
   - `GCash`: Requires uploading both the GCash transaction receipt AND the reference number.

2. **Form Validation**:
   - Ensure the receipt upload field label dynamically specifies "Official Receipt (OR)" for officer payments vs "Receipt" for electronic/bank/cheque payments.
   - When GCash is selected, the Reference Number input must be mandatory.

3. **Admin & Officer Cash Remittance / Ledger Recording**:
   - In the "Record Payment / Remittance (Admin & Officer Tracking)" modal, do NOT show a receipt attachment or file upload field.
   - Cash remittances and manual offline payments logged directly by officers/admins do not require file or receipt attachments because payment is collected in cash.

