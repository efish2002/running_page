import { Link, NavLink } from 'react-router-dom';
import useSiteMetadata from '@/hooks/useSiteMetadata';

const PAGES = [
  { to: '/', index: '01', name: 'run' },
  { to: '/metrics', index: '02', name: 'metrics' },
  { to: '/trail', index: '03', name: 'trail' },
];

const Header = () => {
  const { logo, siteTitle, navLinks } = useSiteMetadata();

  return (
    <nav className="sticky top-0 z-20 w-full border-b border-line bg-background/70 px-6 py-3.5 backdrop-blur-xl lg:px-16">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <Link to="/" className="flex items-center gap-3">
          <picture>
            <img
              className="h-9 w-9 rounded-full border border-accent/40 shadow-[0_0_0_3px_hsl(var(--accent)/0.08),0_0_18px_hsl(var(--accent)/0.35)]"
              alt="logo"
              src={logo}
            />
          </picture>
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-foreground">
            {siteTitle}
            <span className="ml-2 text-accent">{'//'}</span>
          </span>
        </Link>

        <div className="order-last flex w-full items-center gap-1 md:order-none md:w-auto">
          {PAGES.map((page) => (
            <NavLink key={page.to} to={page.to} end={page.to === '/'}>
              {({ isActive }) => (
                <span
                  className={`relative flex items-baseline gap-1.5 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                    isActive ? 'text-accent' : 'text-muted hover:text-accent'
                  }`}
                >
                  <span className="text-[9px] opacity-60">{page.index}</span>
                  {page.name}
                  {isActive && (
                    <span className="absolute inset-x-2 -bottom-1 h-px bg-accent shadow-[0_0_8px_hsl(var(--accent))]" />
                  )}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-6">
          {navLinks.map((n, i) => (
            <a
              key={i}
              href={n.url}
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-accent"
            >
              {n.name}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Header;
