import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Upload,
  Receipt,
  History,
  LogOut,
  Menu,
  CheckCircle,
  UserCog,
  LogIn,
  FileBarChart,
  Plus,
  Edit3,
  Building2,
  AlertCircle,
  Trophy,
  ChevronLeft,
  ChevronRight,
  PiggyBank,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { LeadNotificationBell } from '@/components/LeadNotificationBell';
import { AutoLogout } from '@/components/AutoLogout';

const navigationGroups = [
  {
    title: 'Overview',
    value: 'overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['treasurer', 'accountant', 'general', 'lead', 'office_assistant'] },
    ]
  },
  {
    title: 'Finance & Operations',
    value: 'finance',
    items: [
      { name: 'Add Income', href: '/add-income', icon: Plus, roles: ['accountant', 'treasurer'] },
      { name: 'Add Expense', href: '/expenses', icon: Receipt, roles: ['accountant', 'treasurer'] },
      { name: 'Petty Cash', href: '/petty-cash', icon: Receipt, roles: ['treasurer', 'lead', 'accountant'] },
      { name: 'Sports Income', href: '/sports-income', icon: Trophy, roles: ['office_assistant', 'treasurer'] },
      { name: 'Savings & ROI', href: '/savings', icon: PiggyBank, roles: ['treasurer', 'accountant'] },
    ]
  },
  {
    title: 'Management',
    value: 'management',
    items: [
      { name: 'Approvals', href: '/approvals', icon: CheckCircle, roles: ['treasurer'] },
      { name: 'Corrections', href: '/corrections', icon: Edit3, roles: ['accountant', 'treasurer'] },
      { name: 'Expense Budget', href: '/budget-upload', icon: Upload, roles: ['treasurer'] },
      { name: 'Income Budget', href: '/income-budget-upload', icon: Upload, roles: ['treasurer'] },
    ]
  },
  {
    title: 'CAM & Facility',
    value: 'cam',
    items: [
      { name: 'CAM Tracking', href: '/cam-tracking', icon: Building2, roles: ['treasurer', 'lead'] },
      { name: 'CAM Reports', href: '/cam-reports', icon: FileBarChart, roles: ['treasurer'] },
    ]
  },
  {
    title: 'Analytics & Reports',
    value: 'analytics',
    items: [
      { name: 'Reports Center', href: '/reports', icon: FileBarChart, roles: ['treasurer', 'accountant', 'lead'] },
      { name: 'Historical Data', href: '/historical', icon: History, roles: ['treasurer', 'accountant'] },
      { name: 'Missing Data', href: '/missing-data-report', icon: AlertCircle, roles: ['treasurer'] },
    ]
  },
  {
    title: 'System',
    value: 'system',
    items: [
      { name: 'User Management', href: '/user-management', icon: UserCog, roles: ['treasurer'] },
    ]
  },
];

const NavLinkItem = ({ item, collapsed = false }: { item: any, collapsed?: boolean }) => {
  const location = useLocation();
  const isActive = location.pathname === item.href;
  return (
    <Tooltip key={item.name}>
      <TooltipTrigger asChild>
        <Link
          to={item.href}
          className={cn(
            'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200',
            isActive
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            collapsed && 'justify-center px-2 py-3'
          )}
        >
          <item.icon className={cn("flex-shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4")} />
          {!collapsed && <span>{item.name}</span>}
        </Link>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right" className="font-semibold">
          {item.name}
        </TooltipContent>
      )}
    </Tooltip>
  );
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { signOut, userRole, user } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Default expanded items
  const [openItems, setOpenItems] = useState<string[]>(['overview', 'finance', 'management', 'analytics']);

  // Filter navigation based on user role
  const filteredGroups = navigationGroups.map(group => ({
    ...group,
    items: group.items.filter(item => userRole && item.roles.includes(userRole))
  })).filter(group => group.items.length > 0);

  const NavLinks = () => (
    <TooltipProvider delayDuration={0}>
      {isCollapsed ? (
        <div className="space-y-4 pt-2">
          {filteredGroups.map((group, idx) => (
            <div key={group.value} className="flex flex-col gap-1">
              {group.items.map(item => (
                <NavLinkItem key={item.href} item={item} collapsed={true} />
              ))}
              {idx < filteredGroups.length - 1 && <Separator className="my-2 bg-border/50" />}
            </div>
          ))}
        </div>
      ) : (
        <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="w-full space-y-1">
          {filteredGroups.map((group) => (
            <AccordionItem key={group.value} value={group.value} className="border-none">
              <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/50 rounded-md text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                {group.title}
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-2 space-y-1">
                {group.items.map((item) => (
                  <NavLinkItem key={item.href} item={item} />
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </TooltipProvider>
  );

  return (
    <div className="min-h-screen bg-transparent relative">
      <AutoLogout />

      {/* Background Image Wrapper */}
      <div
        className="fixed inset-0 z-[-50] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background-image.jpg')" }}
      />
      {/* Overlay */}
      <div className="fixed inset-0 z-[-40] bg-background/30 backdrop-blur-[1px]" />

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-4 justify-between">
          {user && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-2">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex flex-col h-full">
                  <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-primary">Expense Manager</h2>
                    {userRole && (
                      <p className="text-xs text-muted-foreground mt-1 capitalize">
                        {userRole === 'treasurer' ? 'Admin' : userRole}
                      </p>
                    )}
                  </div>
                  <nav className="flex-1 p-4 overflow-y-auto">
                    {filteredGroups.map((group) => (
                      <div key={group.value} className="mb-6">
                        <h4 className="px-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.title}</h4>
                        <div className="space-y-1">
                          {group.items.map(item => <NavLinkItem key={item.href} item={item} />)}
                        </div>
                      </div>
                    ))}
                  </nav>
                  <div className="p-4 border-t">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={signOut}
                    >
                      <LogOut className="mr-3 h-5 w-5" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
          <h1 className="text-lg font-semibold">Expense Manager</h1>
          <div className="flex items-center gap-2">
            {user && <NotificationBell />}
            {user && <LeadNotificationBell />}
            {!user && (
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate('/auth')}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Desktop Layout */}
      <div className="lg:flex min-h-screen">
        {/* Sidebar */}
        {user && (
          <aside
            className={cn(
              "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 border-r bg-card/95 backdrop-blur z-50 transition-all duration-300",
              isCollapsed ? "lg:w-20" : "lg:w-64"
            )}
          >
            <div className="flex flex-col h-full relative">
              {/* Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-6 h-6 w-6 rounded-full border bg-background shadow-md z-50 hidden lg:flex hover:bg-primary hover:text-primary-foreground"
                onClick={() => setIsCollapsed(!isCollapsed)}
              >
                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
              </Button>

              <div className={cn("p-6 border-b flex-shrink-0", isCollapsed && "p-4 flex justify-center")}>
                {!isCollapsed ? (
                  <>
                    <h2 className="text-xl font-bold text-primary tracking-tight">Budget Buddy</h2>
                    {userRole && (
                      <p className="text-xs text-muted-foreground mt-1 capitalize flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                        {userRole === 'treasurer' ? 'Administrator' : userRole}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                      BB
                    </div>
                  </div>
                )}
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-muted">
                <NavLinks />
              </nav>
            </div>
          </aside>
        )}

        {/* Main Content Wrapper */}
        <div className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          user && (isCollapsed ? "lg:pl-20" : "lg:pl-64")
        )}>

          {/* Desktop Header for Controls */}
          <header className="hidden lg:flex items-center justify-end gap-4 p-4 border-b bg-background/80 backdrop-blur-md sticky top-0 z-40 transition-all">
            {!user ? (
              <Button
                variant="default"
                onClick={() => navigate('/auth')}
                className="shadow-sm hover:shadow-md transition-all"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <NotificationBell />
                <LeadNotificationBell />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={signOut}
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            )}
          </header>

          {/* Main Content Area */}
          <main className="flex-1 p-6 lg:p-8">
            <div className="mx-auto max-w-7xl animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
