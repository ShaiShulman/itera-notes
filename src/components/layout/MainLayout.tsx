import TopNavigation from "./TopNavigation";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNavigation />
      <main className="flex-1">{children}</main>
    </div>
  );
}
