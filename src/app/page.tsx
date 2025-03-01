"use client";

import { LinkAccountButton } from "~/components/link-account-button";
import { useAuth } from "@clerk/nextjs";

export default function Home() {
  const { isSignedIn } = useAuth();

  return (
    <div>
      SignedIn: {isSignedIn ? "true" : "false"} <br />
      <LinkAccountButton />
    </div>
  );
}
