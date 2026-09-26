import Link from "next/link";

const PROFILE_LINK = "rounded p-1 text-muted transition-colors hover:text-foreground";
const TEXT_LINK = "hover:text-foreground hover:underline";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Site-wide footer (docs/specs/finished/credits.md §2.1). In the root layout, so pages without Shell get it too.
export function SiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-line">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 text-xs text-muted">
        <span>Built by Tomas Neira</span>
        <span className="flex items-center">
          <a
            href="https://github.com/tineira"
            target="_blank"
            rel="me noopener noreferrer"
            aria-label="Tomas Neira on GitHub"
            className={PROFILE_LINK}
          >
            <GitHubIcon />
          </a>
          <a
            href="https://x.com/tomneira"
            target="_blank"
            rel="me noopener noreferrer"
            aria-label="Tomas Neira on X"
            className={PROFILE_LINK}
          >
            <XIcon />
          </a>
        </span>
        <span aria-hidden="true">·</span>
        <Link href="/credits" className={TEXT_LINK}>
          Credits
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/changelog" className={TEXT_LINK}>
          Changelog
        </Link>
      </div>
    </footer>
  );
}
