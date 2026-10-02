import type { RootStackParamList } from "../types/entry";
import { colors } from "../ui/theme";

/** The owner's two businesses and their menus (UI revamp spec §4). Pure data, so it is unit-tested. */
type RouteName = keyof RootStackParamList;
/** Compile-time check that every listed name is a real route. */
type Routes<T extends RouteName> = T;

export type BusinessId = "aj" | "ssj";
export type HubRoute = Routes<"AshaHome" | "SsjHome">;
export type MenuRoute = Routes<
  "ExistingCustomers" | "NewCustomer" | "Analytics" | "UpdateBhav" | "CategoryList" | "ProductList"
>;

export interface MenuItem {
  key: string;
  label: string;
  subtitle: string;
  /** Ionicons glyph name. */
  icon: string;
  route: MenuRoute;
}

export interface Business {
  id: BusinessId;
  name: string;
  subtitle: string;
  icon: string;
  /** Header colour, icon colour. */
  accent: string;
  /** Icon tile background. */
  tint: string;
  hubRoute: HubRoute;
  items: MenuItem[];
}

export const BUSINESSES: Business[] = [
  {
    id: "aj",
    name: "Asha Jewellers",
    subtitle: "Customers · Rehan · Len-den · Analytics",
    icon: "diamond-outline",
    accent: colors.ajNavy,
    tint: "#E7ECF7",
    hubRoute: "AshaHome",
    items: [
      { key: "existing", label: "Existing Customer", subtitle: "View and manage entries", icon: "folder-open-outline", route: "ExistingCustomers" },
      { key: "new", label: "New Customer", subtitle: "Create a new entry", icon: "person-add-outline", route: "NewCustomer" },
      { key: "analytics", label: "Analytics", subtitle: "Overview · Customer · Rehan · Lenden", icon: "bar-chart-outline", route: "Analytics" },
    ],
  },
  {
    id: "ssj",
    name: "SSJ",
    subtitle: "Bhav · Categories · Products",
    icon: "storefront-outline",
    accent: colors.ssjMaroon,
    tint: "#F7E8EC",
    hubRoute: "SsjHome",
    items: [
      { key: "bhav", label: "Update Bhav", subtitle: "Update commodity rates", icon: "trending-up-outline", route: "UpdateBhav" },
      { key: "category", label: "Category", subtitle: "Manage product categories", icon: "folder-outline", route: "CategoryList" },
      { key: "product", label: "Product", subtitle: "Manage products & variants", icon: "cube-outline", route: "ProductList" },
    ],
  },
];

/** Which business owns each route below Home; drives the header colour. tsc enforces that every route is listed. */
export const ROUTE_BUSINESS: Record<Exclude<RouteName, "Home">, BusinessId> = {
  AshaHome: "aj",
  NewCustomer: "aj",
  ExistingCustomers: "aj",
  UserTransactions: "aj",
  AddTransaction: "aj",
  TransactionDetail: "aj",
  BillPreview: "aj",
  Analytics: "aj",
  SsjHome: "ssj",
  UpdateBhav: "ssj",
  CategoryList: "ssj",
  AddEditCategory: "ssj",
  ProductList: "ssj",
  AddEditProduct: "ssj",
};

export const businessById = (id: BusinessId): Business => {
  const business = BUSINESSES.find((b) => b.id === id);
  if (!business) throw new Error(`Unknown business ${id}`);
  return business;
};

export const headerColorFor = (route: RouteName): string =>
  route === "Home" ? colors.ajNavy : businessById(ROUTE_BUSINESS[route]).accent;
