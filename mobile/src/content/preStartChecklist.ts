/**
 * Digital pre-start walkaround checklist — CLAUDE.md §2.1 Rule 5 / section 6. Items
 * mirror the "Pre-Start Walkaround Checklist" training lesson so the two stay
 * consistent. Completing every item sets `pre_start_checklist_completed` and feeds
 * `ppe_compliance_flag` (section 5.1) from a real operator action, not a synthetic label.
 */

export type ChecklistItem = {
  id: string;
  label: string;
};

export const PRE_START_CHECKLIST: ChecklistItem[] = [
  { id: "perimeter", label: "Walk the perimeter — no visible leaks, damage, or loose parts" },
  { id: "tracks", label: "Tracks/tyres condition and pressure checked" },
  { id: "attachment", label: "Attachment and guards secure" },
  { id: "lights_alarms", label: "Lights, horn, and reverse alarm tested" },
  { id: "fluids", label: "Fluid levels checked (engine oil, hydraulic, coolant, DEF)" },
  { id: "seatbelt_rops", label: "Seatbelt and ROPS structure intact" },
  { id: "ppe", label: "PPE worn (hi-vis, hard hat, boots)" },
  { id: "work_area", label: "Work area scanned for hazards (people, utilities, slopes)" },
];
