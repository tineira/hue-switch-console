import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        Sign out
      </button>
    </form>
  );
}
