// Under the sign-in and waitlist forms. It only informs; acceptance happens on /accept
// (docs/specs/terms-and-safety.md §2.4).
export function AcceptanceLine({ termsHref }: { termsHref: string | null }) {
  const link = "underline underline-offset-4 hover:text-foreground";
  return (
    <p className="text-xs text-muted">
      New accounts accept{" "}
      {termsHref ? (
        <>
          the{" "}
          <a href={termsHref} className={link}>
            Terms
          </a>{" "}
          and{" "}
        </>
      ) : null}
      the{" "}
      <a href="/safety" className={link}>
        Safety notice
      </a>{" "}
      before using the console.
    </p>
  );
}
