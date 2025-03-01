"use server";

import { auth } from "@clerk/nextjs/server";
import { SyncResponse, SyncUpdatedResponse } from "~/lib/types";

export const getAurinkoAuthURL = async (
  serviceType: "Google" | "Office365",
) => {
  const { userId } = await auth();

  if (!userId) {
    // throw new Error("Unauthorized");
    return "/sign-in";
  }

  const params = new URLSearchParams({
    clientId: process.env.AURINKO_CLIENT_ID!,
    serviceType,
    scopes: "Mail.Read Mail.ReadWrite Mail.Send Mail.Drafts Mail.All",
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

export const startEmailSync = async (accessToken: string, daysWithin = 7) => {
  const params = new URLSearchParams({
    daysWithin: daysWithin.toString(),
    bodyType: "html",
  });

  const url = `https://api.aurinko.io/v1/email/sync?${params.toString()}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Error: Could not start email sync");
  }

  const syncResponse: SyncResponse = await response.json();

  return {
    syncUpdatedToken: syncResponse.syncUpdatedToken,
    syncDeletedToken: syncResponse.syncDeletedToken,
    ready: syncResponse.ready,
  };
};

export const requestChangedEmails = async ({
  accessToken,
  deltaToken,
  pageToken,
}: {
  accessToken: string;
  deltaToken?: string;
  pageToken?: string;
}) => {
  const params = new URLSearchParams();

  if (pageToken) {
    params.set("pageToken", pageToken);
  } else if (deltaToken) {
    params.set("deltaToken", deltaToken);
  }

  const url = `https://api.aurinko.io/v1/email/sync/updated?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Error: Could not get changed emails");
  }

  const changedEmailsResponse: SyncUpdatedResponse = await response.json();

  return {
    nextPageToken: changedEmailsResponse.nextPageToken,
    nextDeltaToken: changedEmailsResponse.nextDeltaToken,
    records: changedEmailsResponse.records,
  };
};
