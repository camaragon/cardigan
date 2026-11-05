import Image from "next/image";
import Link from "next/link";

export const Logo = () => {
  return (
    <Link href="/" aria-label="Cardigan home">
      <div className="hover:opacity-75 transition hidden md:flex">
        <Image
          src="/logo-lockup.svg"
          alt="Cardigan"
          height={32}
          width={132}
          className="dark:hidden"
        />
        <Image
          src="/logo-lockup-dark.svg"
          alt="Cardigan"
          height={32}
          width={132}
          className="hidden dark:block"
        />
      </div>
    </Link>
  );
};
