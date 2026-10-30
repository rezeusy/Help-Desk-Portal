import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Activity,
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  PanelLeft,
  ShieldCheck,
  Trash2,
  Users,
  AlertCircle,
  Wrench,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Package, label: "Master Inventory", path: "/master" },
  { icon: Wrench, label: "Non-working Devices", path: "/non-working" },
  { icon: ClipboardList, label: "Audit History", path: "/audit" },
  { icon: ShieldCheck, label: "User Management", path: "/admin/users", adminOnly: true },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width-v2";
const DEFAULT_WIDTH = 298;
const MIN_WIDTH = 240;
const MAX_WIDTH = 480;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  useEffect(() => {
    if (!loading && !user) setLocation("/login");
  }, [loading, user, setLocation]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return null;

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function LocationsMenu({ location, setLocation }: { location: string; setLocation: (path: string) => void }) {
  const { data: locations, refetch } = trpc.locations.list.useQuery();
  const utils = trpc.useUtils();
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [locationName, setLocationName] = useState("");
  const [deleteLocationId, setDeleteLocationId] = useState<string | null>(null);
  const createMutation = trpc.locations.create.useMutation({
    onSuccess: () => {
      setShowAddLocation(false);
      setLocationName("");
      toast.success("Office added successfully");
      refetch();
    },
    onError: (error) => toast.error(error.message || "Failed to add office"),
  });
  const deleteMutation = trpc.locations.delete.useMutation({
    onSuccess: ({ releasedUnits }) => {
      const unitLabel = releasedUnits === 1 ? "unit" : "units";
      toast.success(releasedUnits > 0 ? `Office deleted · ${releasedUnits} ${unitLabel} returned to available inventory` : "Office deleted successfully");
      if (location === `/location/${deleteLocationId}`) setLocation("/");
      setDeleteLocationId(null);
      void Promise.all([
        refetch(),
        utils.inventory.list.invalidate(),
        utils.stats.dashboard.invalidate(),
        utils.reports.inventoryExport.invalidate(),
      ]);
    },
    onError: (error) => toast.error(error.message || "Failed to delete office"),
  });

  const addLocation = () => {
    if (!locationName.trim()) return;
    const id = `${locationName.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
    createMutation.mutate({ id, name: locationName });
  };

  return (
      <div className="mt-4 border-t border-white/10 pt-4">
      <div className="px-2">
        <div className="mb-2 flex items-center justify-between px-2 group-data-[collapsible=icon]:justify-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 group-data-[collapsible=icon]:hidden">Offices</span>
          <Building2 className="hidden h-3.5 w-3.5 text-slate-500 group-data-[collapsible=icon]:block" />
          {!showAddLocation && (
            <button
              type="button"
              onClick={() => setShowAddLocation(true)}
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:hidden"
              aria-label="Add office"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <nav aria-label="Office navigation" className="min-w-0 space-y-1">
          {locations?.map((loc) => {
            const isActive = location === `/location/${loc.id}`;
            return (
              <div key={loc.id} className="group flex min-h-10 w-full shrink-0 items-center rounded-xl transition-colors hover:bg-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setLocation(`/location/${loc.id}`)}
                  title={loc.name}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-10 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xl px-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#8e9aff] ${isActive ? "text-white" : "text-slate-300 hover:text-white"} group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] ${isActive ? "bg-[#5367f2] text-white" : "bg-white/[0.07] text-slate-400"}`}>
                    <Building2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">{loc.name}</span>
                </button>
                <div className="flex shrink-0 items-center gap-1 pr-2 group-data-[collapsible=icon]:hidden">
                  <span className="data-mono rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{loc.items?.length || 0}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteLocationId(loc.id);
                    }}
                    className="rounded-md p-1 text-slate-500 opacity-0 transition-all hover:bg-rose-400/10 hover:text-rose-300 group-hover:opacity-100"
                    title={`Delete ${loc.name}`}
                    aria-label={`Delete ${loc.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </nav>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-9 w-full justify-start rounded-xl px-2 text-xs font-medium text-slate-400 hover:bg-white/[0.06] hover:text-white group-data-[collapsible=icon]:justify-center"
          onClick={() => setShowAddLocation((current) => !current)}
        >
          <Plus className="mr-2 h-3.5 w-3.5 group-data-[collapsible=icon]:mr-0" />
          <span className="group-data-[collapsible=icon]:hidden">Add office</span>
        </Button>
        {showAddLocation && (
          <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-white/[0.05] p-2 group-data-[collapsible=icon]:hidden">
            <input
              type="text"
              placeholder="Office name..."
              value={locationName}
              onChange={(event) => setLocationName(event.target.value)}
              className="h-9 w-full rounded-lg border border-white/10 bg-[#0f1222] px-2.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#8e9aff]"
              onKeyDown={(event) => {
                if (event.key === "Enter") addLocation();
              }}
            />
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" className="h-8 flex-1 rounded-lg text-xs text-slate-400 hover:bg-white/10 hover:text-white" onClick={() => { setShowAddLocation(false); setLocationName(""); }} disabled={createMutation.isPending}>Cancel</Button>
              <Button size="sm" className="h-8 flex-1 rounded-lg bg-[#8e9aff] text-xs text-[#15182b] hover:bg-[#aab4ff]" onClick={addLocation} disabled={createMutation.isPending || !locationName.trim()}>Add</Button>
            </div>
          </div>
        )}
      </div>
      <AlertDialog open={deleteLocationId !== null} onOpenChange={(open) => !open && setDeleteLocationId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" />Delete Office</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this office? All deployed items will be unassigned from this location. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteLocationId) deleteMutation.mutate(deleteLocationId); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending}>{deleteMutation.isPending ? "Deleting..." : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type DashboardLayoutContentProps = { children: React.ReactNode; setSidebarWidth: (width: number) => void };

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find((item) => location === item.path);
  const mobileTitle = activeMenuItem?.label ?? (location.startsWith("/location/") ? "Office view" : "Workspace");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = event.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-white/10 bg-[#15182b] text-slate-100" disableTransition={isResizing}>
          <SidebarHeader className="h-[70px] justify-center border-b border-white/[0.08] px-3">
            <div className="flex w-full items-center gap-3 px-1">
              <button onClick={toggleSidebar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-slate-300 transition-colors hover:bg-white/[0.14] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8e9aff]" aria-label="Toggle navigation">
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-extrabold tracking-[0.02em] text-white">IT GLOBAL (LYNX - STARS)</span>
                    <span className="rounded-full bg-[#8e9aff]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#b7bfff]">IT</span>
                  </div>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Inventory workspace</p>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-4">
            <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 group-data-[collapsible=icon]:hidden">Workspace</div>
            <nav aria-label="Workspace navigation" className="min-w-0 space-y-1">
              {menuItems.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => {
                const isActive = location === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => setLocation(item.path)}
                    aria-current={isActive ? "page" : undefined}
                    title={item.label}
                    className={`flex h-12 w-full shrink-0 items-center gap-2 overflow-hidden rounded-xl px-2.5 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#8e9aff] ${isActive ? "bg-[#5367f2] text-white shadow-[0_8px_20px_rgba(83,103,242,0.28)]" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"} group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0`}
                  >
                    <item.icon className="h-[17px] w-[17px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                    {item.path === "/audit" && <span className="ml-auto shrink-0 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] text-slate-500 group-data-[collapsible=icon]:hidden">LOG</span>}
                  </button>
                );
              })}
            </nav>
            <LocationsMenu location={location} setLocation={setLocation} />
          </SidebarContent>

          <SidebarFooter className="border-t border-white/[0.08] p-3">
            <div className="mb-3 flex items-center gap-2 px-2 text-[10px] font-medium text-emerald-300/80 group-data-[collapsible=icon]:hidden"><Activity className="h-3.5 w-3.5" /><span>Systems operational</span><span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.1)]" /></div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8e9aff] group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/15 bg-[#2c3154]"><AvatarFallback className="bg-[#2c3154] text-xs font-bold text-[#d8dcff]">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-semibold text-white">{user?.name || "-"}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{user?.email || "Workspace member"}</p></div>
                  <span className="text-slate-500 group-data-[collapsible=icon]:hidden">•••</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" /><span>Sign out</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-[#8e9aff]/40 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }} />
      </div>

      <SidebarInset className="app-main min-h-screen">
        {isMobile && (
          <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/70 bg-background/85 px-3 backdrop-blur-xl">
            <div className="flex items-center gap-2"><SidebarTrigger className="h-10 w-10 rounded-xl border border-border bg-card" /><div><p className="text-sm font-bold text-foreground">{mobileTitle}</p><p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Northstar workspace</p></div></div>
            <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
          </div>
        )}
        <main className="page-enter flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
