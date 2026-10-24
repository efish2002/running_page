import { Link } from 'react-router-dom';
import useSiteMetadata from '@/hooks/useSiteMetadata';

const Header = () => {
  const { logo, siteUrl, siteTitle, navLinks } = useSiteMetadata();

  return (
    <nav className="sticky top-0 z-20 flex w-full items-center justify-between border-b border-line bg-background/70 px-6 py-3.5 backdrop-blur-xl lg:px-16">
      <Link to={siteUrl} className="flex items-center gap-3">
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
    </nav>
  );
};

export default Header;
