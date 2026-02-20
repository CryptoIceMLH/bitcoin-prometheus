import { NavLink, Outlet } from "react-router-dom";

function BitcoinLogo() {
  return (
    <img src="/logo.jpg" alt="Prometheus" className="w-9 h-9 rounded-full" />
  );
}

const navBtnClass = ({ isActive }: { isActive: boolean }) =>
  `px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
    isActive
      ? "bg-fire-orange/20 text-fire-amber"
      : "text-gray-400 hover:bg-surface-hover hover:text-gray-200"
  }`;

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-surface-dark">
      {/* Top bar */}
      <header className="flex items-center justify-between px-3 sm:px-6 py-3 bg-surface border-b border-surface-light/30">
        <div className="flex items-center gap-2.5">
          <BitcoinLogo />
          <div className="flex flex-col leading-tight">
            <span className="text-sm sm:text-base font-bold text-fire-amber">Prometheus <span className="text-[10px] text-gray-500 font-normal">v0.1.4</span></span>
            <span className="text-[10px] text-gray-500 hidden sm:block">Bitcoin Client</span>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={navBtnClass}>
            Dashboard
          </NavLink>
          <NavLink to="/settings" className={navBtnClass}>
            <span className="hidden sm:inline">Sovereign </span>Controls
          </NavLink>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
