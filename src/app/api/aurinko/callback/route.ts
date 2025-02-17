import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { exchangeAurinkoCode, getAccountDetails } from "~/lib/aurinko";
import { db } from "~/server/db";

export const GET = async (req: NextRequest) => {
  const { userId } = await auth();

  if (!userId) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const status = searchParams.get("status");

  if (code && status === "success") {
    const { accessToken, accountId } = await exchangeAurinkoCode(code);

    const { email, name } = await getAccountDetails(accessToken);

    await db.account.upsert({
      where: {
        id: accountId,
      },
      update: {
        accessToken,
      },
      create: {
        id: accountId,
        userId,
        email,
        name,
        accessToken,
      },
    });

    return NextResponse.redirect(new URL("/mail", req.url));
  } else {
    return new Response("Error: Could not exchange code", {
      status: 400,
    });
  }
};
