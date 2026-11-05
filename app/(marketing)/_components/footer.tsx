import Link from "next/link";

import { Logo } from "@/components/logo";

export const Footer = () => {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center gap-4 px-4 py-6 text-sm text-slate-600 md:flex-row md:justify-between">
        <div className="hidden md:block">
          <Logo />
        </div>
        <p className="text-center">A task board for people and AI agents.</p>
        <nav aria-label="Account" className="flex gap-4">
          <Link
            href="/sign-in"
            className="rounded-sm hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-sm hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Create an account
          </Link>
        </nav>
      </div>
    </footer>
  );
};
