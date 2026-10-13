---
trigger: always_on
description: UX standards and lifecycle logic for event creation, editing, and guidelines.
---

# Event Management Standards

When designing or updating event forms and backend handlers:

1. **Automatic Event Status**:
   - Do NOT present a manual "Event Status" dropdown selector in the event create/edit modals.
   - Event status (`Upcoming`, `Ongoing`, `Completed`) must be automatically computed by the system based on `start_date` and `end_date`.

2. **Schedule-Driven Registration**:
   - Do NOT display a manual "Registration Override" dropdown in event forms.
   - Event registration openness must be naturally controlled by the event's registration schedule (`registration_start_at` and `registration_end_at`). Set `registration_override` to `null` by default.

3. **Dual Guidelines Format**:
   - Event guidelines must support both optional/markdown text guidelines and an uploaded document file (`PDF`, `DOCX`, `TXT`, `MD`, or image).
   - In event details and public view modals, provide clear download and preview links for any attached guidelines document alongside the text.

4. **Category-Driven Esports Configuration**:
   - Do NOT display a separate "This is for Esports Events" checkbox card.
   - Esports settings (game selection, tournament bracket format) are activated naturally when the user selects `Esports` in the Event Category dropdown.

