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
