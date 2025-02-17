"use server";

import { auth } from "@clerk/nextjs/server";

export const getAurinkoAuthURL = async (
  serviceType: "Google" | "Office365",
) => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const params = new URLSearchParams({
    clientId: process.env.AURINKO_CLIENT_ID!,
    serviceType,
    scope: "Mail.Read Mail.ReadWrite Mail.Send Mail.Drafts Mail.All",
    responseType: "code",
    returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/aurinko/callback`,
  });

  return "https://api.aurinko.io/v1/auth/authorize?" + params.toString();
};

export const exchangeAurinkoCode = async (
  code: string,
): Promise<{
  accountId: string;
  accessToken: string;
  userId: string;
  userSession: string;
}> => {
  const credentials = btoa(
    `${process.env.AURINKO_CLIENT_ID!}:${process.env.AURINKO_CLIENT_SECRET!}`,
  );

  const response = await fetch(`https://api.aurinko.io/v1/auth/token/${code}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    throw new Error("Error: Could not exchange code");
  }

  const { accountId, accessToken, userId, userSession } = await response.json();

  return {
    accountId: (accountId as number).toString(),
    accessToken,
    userId,
    userSession,
  };
};

type AurinkoUserDetails = {
  email: string;
  name: string;
};

export const getAccountDetails = async (
  accessToken: string,
): Promise<AurinkoUserDetails> => {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const response = await fetch("https://api.aurinko.io/v1/account", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Error: Could not get account details");
  }

  const accountDetails: AurinkoUserDetails = await response.json();

  return {
    email: accountDetails.email,
    name: accountDetails.name,
  };
};
