import Image from "next/image";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 w-full max-w-screen-2xl items-center justify-between px-4"
      >
        <div className="flex items-center">
          <div className="hidden md:block">
            <Logo />
          </div>
          <Link href="/" className="md:hidden" aria-label="Cardigan home">
            <Image src="/logo.svg" alt="" height={28} width={28} />
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button size="sm" variant="ghost" asChild>
            <Link href="/sign-in">Log in</Link>
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            asChild
          >
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
};
