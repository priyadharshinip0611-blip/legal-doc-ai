import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileUp, Settings, Scale, Moon, Sun, Menu, X } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/analyze", label: "Analyze", icon: FileUp },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Mobile nav toggle */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 text-primary">
          <Scale className="h-6 w-6" />
          <span className="font-serif font-bold text-xl text-foreground">LexAI</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-200 ease-in-out md:relative md:translate-x-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-6 flex items-center gap-3">
          <Scale className="h-8 w-8 text-primary" />
          <span className="font-serif font-bold text-2xl tracking-tight">LexAI</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                <div className={`
                  flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer
                  ${isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}
                `}>
                  <Icon className="h-5 w-5" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-3 px-3 py-2 text-sidebar-foreground/70">
            <Settings className="h-5 w-5" />
            <span className="text-sm">Settings</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Subtle top decorative border */}
        <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
