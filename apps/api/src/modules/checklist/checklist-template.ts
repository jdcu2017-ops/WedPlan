// Generic timeline-driven checklist per spec 3.5 — categories match the
// vendor category taxonomy loosely (spec 3.1) so a booked vendor can
// auto-complete the corresponding task. `monthsBefore`/`daysBefore` are
// relative to the wedding date; exactly one of them is set per entry.
export interface ChecklistTemplateItem {
  title: string;
  category: string | null;
  monthsBefore?: number;
  daysBefore?: number;
}

export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  { title: "Set overall wedding budget", category: null, monthsBefore: 12 },
  { title: "Draft initial guest list", category: null, monthsBefore: 12 },
  { title: "Book venue", category: "venue", monthsBefore: 12 },
  { title: "Book photographer", category: "photography", monthsBefore: 9 },
  { title: "Book caterer", category: "catering", monthsBefore: 9 },
  { title: "Choose wedding party", category: null, monthsBefore: 9 },
  { title: "Book florist", category: "florist", monthsBefore: 6 },
  { title: "Book DJ or band", category: "dj", monthsBefore: 6 },
  { title: "Order invitations", category: "invitations", monthsBefore: 6 },
  { title: "Book officiant", category: "officiant", monthsBefore: 6 },
  { title: "Send invitations", category: null, monthsBefore: 3 },
  { title: "Finalize catering menu", category: "catering", monthsBefore: 3 },
  { title: "Book hair and makeup", category: "hair_makeup", monthsBefore: 3 },
  { title: "Order wedding cake", category: "cake", monthsBefore: 3 },
  { title: "Arrange transportation", category: "transportation", monthsBefore: 1 },
  { title: "Final dress/suit fitting", category: null, monthsBefore: 1 },
  { title: "Confirm details with all vendors", category: null, monthsBefore: 1 },
  { title: "Create seating chart", category: null, monthsBefore: 1 },
  { title: "Confirm final guest count", category: null, daysBefore: 7 },
  { title: "Delegate day-of tasks", category: null, daysBefore: 7 },
  { title: "Pack for honeymoon", category: null, daysBefore: 7 },
];

export function computeDueDate(weddingDate: string, item: ChecklistTemplateItem): string {
  const date = new Date(`${weddingDate}T00:00:00Z`);
  if (item.monthsBefore) {
    date.setUTCMonth(date.getUTCMonth() - item.monthsBefore);
  } else if (item.daysBefore) {
    date.setUTCDate(date.getUTCDate() - item.daysBefore);
  }
  return date.toISOString().slice(0, 10);
}
