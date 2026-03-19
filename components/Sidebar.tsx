"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Upload,
  BookOpen,
  HelpCircle,
  ClipboardList,
  Users,
  Building2,
  CalendarRange,
  Layers,
  Search,
  Building,
  FlaskConical,
  Download,
  Database,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/data-import", label: "Data Import", icon: Upload },
  { href: "/program-catalog", label: "Program Catalog", icon: BookOpen },
  { href: "/question-analysis", label: "Question Analysis", icon: HelpCircle },
  { href: "/evaluation-analysis", label: "Evaluation Analysis", icon: ClipboardList },
  { href: "/learner-responses", label: "Learner Responses", icon: Users },
  { href: "/employer-analysis", label: "Employer Analysis", icon: Building2 },
  { href: "/temporal-analysis", label: "Temporal Analysis", icon: CalendarRange },
  { href: "/participation-depth", label: "Participation Depth", icon: Layers },
  { href: "/learner-explorer", label: "Learner Explorer", icon: Search },
  { href: "/employer-management", label: "Employer Management", icon: Building },
  { href: "/statistical-tests", label: "Statistical Tests", icon: FlaskConical },
  { href: "/export", label: "Export", icon: Download },
  { href: "/data-sources", label: "Data Sources", icon: Database },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-navy-500 text-white rounded-lg"
      >
        <Menu size={20} />
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-navy-500 text-white flex flex-col shrink-0 transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-navy-400 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              PT<span className="text-teal-400 italic">ce</span>
            </h1>
            <p className="text-xs text-navy-200 mt-0.5">Analytics Platform</p>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 hover:bg-navy-400 rounded">
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-teal-500/20 text-teal-300 font-medium border-r-3 border-teal-400"
                    : "text-navy-200 hover:text-white hover:bg-navy-400"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-navy-400">
          <p className="text-xs text-navy-300">Pharmacy Times CE</p>
        </div>
      </aside>
    </>
  );
}
