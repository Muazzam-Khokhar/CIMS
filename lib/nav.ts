import {
  BarChart3,
  CarFront,
  CreditCard,
  LayoutDashboard,
  Receipt,
  Settings,
  BadgeJapaneseYen,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  exact?: boolean;
  children?: NavItem[];
};

export const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Business overview",
  },
  {
    name: "Inventory",
    href: "/inventory",
    icon: CarFront,
    description: "Vehicles in stock",
  },
  {
    name: "Sales",
    href: "/sales",
    icon: ShoppingCart,
    description: "Deals and invoices",
  },
  // {
  //   name: "Customers",
  //   href: "/customers",
  //   icon: Users,
  //   description: "Buyer records",
  // },
  {
    name: "Expenses",
    href: "/expenses",
    icon: Receipt,
    description: "Business expenses",
    children: [
      {
        name: "Vehicle Expenses",
        href: "/expenses/vehicle",
        icon: CarFront,
        description: "Vehicle-related costs",
      },
      {
        name: "General Expenses",
        href: "/expenses/general",
        icon: Receipt,
        description: "Business operating costs",
      },
    ],
  },
  {
    name: "Payments",
    href: "/payments",
    icon: CreditCard,
    description: "Money in and out",
  },
  {
    name: "Money",
    href: "/finance",
    icon: BadgeJapaneseYen,
    description: "Where your money came from and went",
    children: [
      { name: "Overview", href: "/finance",exact: true, icon: BarChart3, description: "Money summary" },
      { name: "Partners", href: "/finance/partners", icon: Users, description: "People who invest with you" },
      { name: "Loans", href: "/finance/loans", icon: Receipt, description: "Money borrowed or lent" },
    ],
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
    description: "Performance insights",
  },
];

export const settingsItem: NavItem = {
  name: "Settings",
  href: "/settings",
  icon: Settings,
  description: "Workspace preferences",
};

export function isNavActive(
  pathname: string,
  href: string,
  exact = false,
) {
  if (href === "/" || exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPageMeta(pathname: string) {
  const allItems = [
    settingsItem,
    ...navigation.flatMap((item) => [item, ...(item.children ?? [])]),
  ];

  const match = allItems
    .filter((item) => isNavActive(pathname, item.href, item.exact))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return {
    title: match?.name ?? "CIMS",
    description: match?.description ?? "Car inventory management",
  };
}
