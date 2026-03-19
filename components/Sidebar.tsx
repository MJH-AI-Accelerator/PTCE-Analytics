"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  BookOpen,
  ClipboardList,
  Users,
  Search,
  Building,
  Database,
  Download,
  Settings,
} from "lucide-react";

const mainNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/program-catalog", label: "Program Catalog", icon: BookOpen },
  { href: "/analysis", label: "Analysis", icon: ClipboardList },
  { href: "/learner-responses", label: "Learner Responses", icon: Users },
  { href: "/learner-explorer", label: "Learner Explorer", icon: Search },
  { href: "/export", label: "Export", icon: Download },
];

const adminNavItems = [
  { href: "/data-import", label: "Data Import", icon: Upload },
  { href: "/employer-management", label: "Employer Mgmt", icon: Building },
  { href: "/data-sources", label: "Data Sources", icon: Database },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const renderLink = (item: typeof mainNavItems[0], collapsed: boolean) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.label}
        className={`flex items-center gap-3 px-4 lg:px-6 py-2.5 text-sm transition-colors ${
          active
            ? "bg-teal-500/20 text-teal-300 font-medium border-r-3 border-teal-400"
            : "text-navy-200 hover:text-white hover:bg-navy-400"
        } ${collapsed ? "justify-center" : ""}`}
      >
        <Icon size={18} className="shrink-0" />
        <span className="hidden lg:inline">{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="fixed lg:static inset-y-0 left-0 z-50 w-14 lg:w-64 bg-navy-500 text-white flex flex-col shrink-0 transition-all duration-200">
      {/* Header */}
      <div className="p-3 lg:p-6 border-b border-navy-400 flex items-center justify-center lg:justify-start">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            <span className="lg:hidden">P</span>
            <span className="hidden lg:inline">PT</span>
            <span className="text-teal-400 italic">
              <span className="lg:hidden">t</span>
              <span className="hidden lg:inline">ce</span>
            </span>
          </h1>
          <p className="text-xs text-navy-200 mt-0.5 hidden lg:block">Analytics Platform</p>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        {mainNavItems.map((item) => renderLink(item, false))}

        {/* Admin Section */}
        <div className="mt-6 pt-4 border-t border-navy-400">
          <div className="px-4 lg:px-6 mb-2 flex items-center gap-2">
            <Settings size={12} className="text-navy-300 shrink-0" />
            <span className="text-xs font-semibold text-navy-300 uppercase tracking-wider hidden lg:inline">
              Admin
            </span>
          </div>
          {adminNavItems.map((item) => renderLink(item, false))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 lg:p-4 border-t border-navy-400">
        <p className="text-xs text-navy-300 hidden lg:block">Pharmacy Times CE</p>
      </div>
    </aside>
  );
}
