# CareerOS AI — Chrome Extension

Save internships and jobs directly from job portals into CareerOS AI with one click.

## Supported portals
LinkedIn Jobs · Wellfound · Internshala · Naukri · Indeed · Glassdoor · Greenhouse · Lever · Ashby

## Features
- Auto-detect job postings on any supported portal
- Extract company, role, location, salary, description, skills, recruiter, apply URL, deadline
- One-click **Save to CareerOS** into your existing Applications database
- Duplicate detection by URL or (company + role)
- Auto-tagging by source portal + inferred skills
- Trigger AI Job Match and Resume Match on any saved job
- Recent saved jobs surfaced in the popup

## Build
```bash
bun run extension/build.mjs
```
Outputs an unpacked build at `extension/dist/` and a distributable zip at `public/careeros-extension.zip`.

## Install (unpacked)
1. Download and unzip `careeros-extension.zip`.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and pick the unzipped folder.
4. Visit CareerOS AI and click **Connect** in the popup — you'll be signed in automatically.
