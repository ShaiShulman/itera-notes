import TopNavigation from "./TopNavigation";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-full flex flex-col bg-slate-50">
      <TopNavigation />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
