import { NextRequest } from "next/server";
import { db } from "~/server/db";
import { Account } from "~/lib/account";
import { persistEmails } from "~/lib/sync-to-db";

export const POST = async (req: NextRequest) => {
  const {
    accountId,
    accessToken,
  }: {
    accountId: string;
    accessToken: string;
  } = await req.json();

  if (!accountId || !accessToken) {
    return new Response("Error: Missing accountId or accessToken", {
      status: 400,
    });
  }

  const persistedAccount = await db.account.findUnique({
    where: {
      id: accountId,
    },
  });

  if (!persistedAccount) {
    return new Response("Error: Account not found", {
      status: 404,
    });
  }

  const account = new Account(accessToken);

  try {
    const { records, syncUpdatedToken } = await account.initialSync();

    if (!records) {
      return new Response("Error: Initial sync failed", {
        status: 500,
      });
    }

    await db.account.update({
      where: {
        id: accountId,
      },
      data: {
        deltaSyncToken: syncUpdatedToken,
      },
    });

    await persistEmails({
      accountId,
      emails: records,
    });
  } catch (error) {
    return new Response("Error: Initial sync failed", {
      status: 500,
    });
  }

  return new Response("Success", {
    status: 200,
  });
};
