"use client";

import { Button } from "~/components/ui/button";
import { getAurinkoAuthURL } from "~/lib/aurinko";

export const LinkAccountButton = () => {
  const onClick = async () => {
    const url = await getAurinkoAuthURL("Google");
    window.location.replace(url);
  };

  return (
    <>
      <Button onClick={onClick}>Link Account</Button>
    </>
  );
};
