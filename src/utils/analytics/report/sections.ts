/** The four Analytics sections and their sub-tabs (UI revamp spec §5). Every report of insights v3 appears once. */
export type SectionKey = "overview" | "customer" | "rehan" | "lenden";
export type ViewKey =
  | "overview/findings"
  | "overview/together"
  | "overview/quality"
  | "customer/rehan"
  | "customer/lenden"
  | "rehan/book"
  | "rehan/items"
  | "lenden/summary"
  | "lenden/sales"
  | "lenden/metal"
  | "lenden/trends";
/** Which control row a view shows: the pledge filters, the billing time frame, or nothing. */
export type Controls = "pledge" | "timeframe" | "none";

export interface SubTab {
  key: ViewKey;
  label: string;
  controls: Controls;
}

export interface Section {
  key: SectionKey;
  label: string;
  /** Ionicons glyph name. */
  icon: string;
  subTabs: SubTab[];
}

export const SECTIONS: Section[] = [
  {
    key: "overview",
    label: "Overview",
    icon: "pie-chart-outline",
    subTabs: [
      { key: "overview/findings", label: "Findings", controls: "pledge" },
      { key: "overview/together", label: "Together", controls: "pledge" },
      { key: "overview/quality", label: "Data quality", controls: "none" },
    ],
  },
  {
    key: "customer",
    label: "Customer",
    icon: "people-outline",
    subTabs: [
      { key: "customer/rehan", label: "Rehan", controls: "pledge" },
      { key: "customer/lenden", label: "Lenden", controls: "timeframe" },
    ],
  },
  {
    key: "rehan",
    label: "Rehan",
    icon: "lock-closed-outline",
    subTabs: [
      { key: "rehan/book", label: "Book", controls: "pledge" },
      { key: "rehan/items", label: "Items", controls: "pledge" },
    ],
  },
  {
    key: "lenden",
    label: "Lenden",
    icon: "receipt-outline",
    subTabs: [
      { key: "lenden/summary", label: "Summary", controls: "timeframe" },
      { key: "lenden/sales", label: "Sales", controls: "timeframe" },
      { key: "lenden/metal", label: "Metal", controls: "timeframe" },
      { key: "lenden/trends", label: "Trends", controls: "timeframe" },
    ],
  },
];

export const DEFAULT_VIEW: ViewKey = "overview/findings";

/** The sub-tab each section shows the first time it is opened. */
export const FIRST_VIEWS = Object.fromEntries(SECTIONS.map((s) => [s.key, s.subTabs[0].key])) as Record<
  SectionKey,
  ViewKey
>;

export const sectionOf = (view: ViewKey): SectionKey => view.slice(0, view.indexOf("/")) as SectionKey;

export const controlsFor = (view: ViewKey): Controls => {
  for (const s of SECTIONS) for (const t of s.subTabs) if (t.key === view) return t.controls;
  return "none";
};
