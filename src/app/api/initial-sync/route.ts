import { NextRequest } from "next/server";
import { db } from "~/server/db";
import { Account } from "~/lib/account";

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

  await account.initialSync();

  return new Response("Success", {
    status: 200,
  });
};
