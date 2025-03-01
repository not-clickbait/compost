import type { EmailAddress, EmailAttachment, EmailMessage } from "~/lib/types";
import pLimit from "p-limit";
import { EmailLabel } from "@prisma/client";
import { db } from "~/server/db";

export async function persistEmails({
  accountId,
  emails,
}: {
  accountId: string;
  emails: EmailMessage[];
}) {
  console.log("Persisting emails", emails.length);
  const limit = pLimit(10); // 10 concurrent writes

  try {
    await Promise.all(
      emails.map((email) => limit(() => upsertEmail({ accountId, email }))),
    );
  } catch (error) {
    console.error("Error persisting emails", error);
  }
}

export async function upsertEmail({
  accountId,
  email,
}: {
  accountId: string;
  email: EmailMessage;
}) {
  try {
    let labelType: EmailLabel = "inbox";

    if (
      email.sysLabels.includes("inbox") ||
      email.sysLabels.includes("important")
    ) {
      labelType = "inbox";
    } else if (email.sysLabels.includes("sent")) {
      labelType = "sent";
    } else if (email.sysLabels.includes("draft")) {
      labelType = "draft";
    }

    const addressesToUpsert = new Map<string, EmailAddress>();
    for (const address of [
      email.from,
      ...email.to,
      ...email.cc,
      ...email.bcc,
      ...email.replyTo,
    ]) {
      if (address) {
        addressesToUpsert.set(address.address, address);
      }
    }

    const upsertedAddresses: Awaited<ReturnType<typeof upsertEmailAddress>>[] =
      [];

    for (const address of addressesToUpsert.values()) {
      const upsertedAddress = await upsertEmailAddress({
        accountId,
        address,
      });

      upsertedAddresses.push(upsertedAddress);
    }

    const addressMap = new Map(
      upsertedAddresses.filter(Boolean).map((a) => [a!.address, a]),
    );

    const fromAddress = addressMap.get(email.from.address);
    if (!fromAddress) {
      console.error("From address not found");
      return;
    }

    const toAddresses = email.to
      .map((a) => addressMap.get(a.address))
      .filter(Boolean);
    const ccAddresses = email.cc
      .map((a) => addressMap.get(a.address))
      .filter(Boolean);
    const bccAddresses = email.bcc
      .map((a) => addressMap.get(a.address))
      .filter(Boolean);
    const replyToAddresses = email.replyTo
      .map((a) => addressMap.get(a.address))
      .filter(Boolean);

    /*
    Upsert the Thread
     */
    const thread = await db.thread.upsert({
      where: {
        id: email.threadId,
      },
      update: {
        subject: email.subject,
        accountId,
        lastMessageDate: new Date(email.sentAt),
        done: false,
        participantIds: [
          ...new Set([
            fromAddress.id,
            ...toAddresses.map((a) => a!.id),
            ...ccAddresses.map((a) => a!.id),
            ...bccAddresses.map((a) => a!.id),
            ...replyToAddresses.map((a) => a!.id),
          ]),
        ],
      },
      create: {
        id: email.threadId,
        accountId,
        subject: email.subject,
        lastMessageDate: new Date(email.sentAt),
        done: false,
        draftStatus: labelType === "draft",
        inboxStatus: labelType === "inbox",
        participantIds: [
          ...new Set([
            fromAddress.id,
            ...toAddresses.map((a) => a!.id),
            ...ccAddresses.map((a) => a!.id),
            ...bccAddresses.map((a) => a!.id),
            ...replyToAddresses.map((a) => a!.id),
          ]),
        ],
      },
    });

    /*
    Upsert the Email
     */
    await db.email.upsert({
      where: {
        id: email.id,
      },
      update: {
        threadId: email.threadId,
        subject: email.subject,
        fromId: fromAddress.id,
        to: {
          set: toAddresses.map((a) => ({ id: a!.id })),
        },
        cc: {
          set: ccAddresses.map((a) => ({ id: a!.id })),
        },
        bcc: {
          set: bccAddresses.map((a) => ({ id: a!.id })),
        },
        replyTo: {
          set: replyToAddresses.map((a) => ({ id: a!.id })),
        },
        sentAt: new Date(email.sentAt),
        createdTime: new Date(email.createdTime),
        receivedAt: new Date(email.receivedAt),
        lastModifiedTime: new Date(),
        sysLabels: email.sysLabels,
        keywords: email.keywords,
        sysClassifications: email.sysClassifications,
        meetingMessageMethod: email.meetingMessageMethod,
        internetHeaders: email.internetHeaders as never,
        internetMessageId: email.internetMessageId,
        sensitivity: email.sensitivity,
        hasAttachments: email.hasAttachments,
        body: email.body,
        bodySnippet: email.bodySnippet,
        inReplyTo: email.inReplyTo,
        references: email.references,
        threadIndex: email.threadIndex,
        folderId: email.folderId,
        omitted: email.omitted,
        nativeProperties: email.nativeProperties,
      },
      create: {
        id: email.id,
        threadId: email.threadId,
        subject: email.subject,
        fromId: fromAddress.id,
        to: {
          connect: toAddresses.map((a) => ({ id: a!.id })),
        },
        cc: {
          connect: ccAddresses.map((a) => ({ id: a!.id })),
        },
        bcc: {
          connect: bccAddresses.map((a) => ({ id: a!.id })),
        },
        replyTo: {
          connect: replyToAddresses.map((a) => ({ id: a!.id })),
        },
        sentAt: new Date(email.sentAt),
        receivedAt: new Date(email.receivedAt),
        createdTime: new Date(email.createdTime),
        lastModifiedTime: new Date(),
        sysLabels: email.sysLabels,
        keywords: email.keywords,
        sysClassifications: email.sysClassifications,
        meetingMessageMethod: email.meetingMessageMethod,
        internetHeaders: email.internetHeaders as never,
        internetMessageId: email.internetMessageId,
        sensitivity: email.sensitivity,
        hasAttachments: email.hasAttachments,
        body: email.body,
        bodySnippet: email.bodySnippet,
        inReplyTo: email.inReplyTo,
        references: email.references,
        threadIndex: email.threadIndex,
        folderId: email.folderId,
        omitted: email.omitted,
        nativeProperties: email.nativeProperties,
      },
    });

    /*
    Classify the Thread into folders
     */

    const threadEmails = await db.email.findMany({
      where: {
        threadId: email.threadId,
      },
      orderBy: {
        receivedAt: "asc",
      },
    });

    let threadFolderType: "sent" | "inbox" | "draft" = "sent";
    for (const threadEmail of threadEmails) {
      if (threadEmail.emailLabel === "inbox") {
        threadFolderType = "inbox";
        break;
      } else if (threadEmail.emailLabel === "draft") {
        threadFolderType = "draft";
        break;
      }
    }

    await db.thread.update({
      where: {
        id: email.threadId,
      },
      data: {
        sentStatus: threadFolderType === "sent",
        draftStatus: threadFolderType === "draft",
        inboxStatus: threadFolderType === "inbox",
      },
    });

    /*
    Upsert Attachments
     */
    for (const attachment of email.attachments) {
      await upsertAttachment({
        emailId: email.id,
        attachment,
      });
    }
  } catch (error) {
    console.error("Error upserting email", error);
  }
}

export async function upsertAttachment({
  emailId,
  attachment,
}: {
  emailId: string;
  attachment: EmailAttachment;
}) {
  try {
    await db.emailAttachment.upsert({
      where: {
        id: attachment.id,
      },
      update: {
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        inline: attachment.inline,
        contentId: attachment.contentId,
        content: attachment.content,
        contentLocation: attachment.contentLocation,
      },
      create: {
        id: attachment.id,
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        inline: attachment.inline,
        contentId: attachment.contentId,
        content: attachment.content,
        contentLocation: attachment.contentLocation,
        emailId,
      },
    });
  } catch (error) {
    console.error("Error upserting attachment", error);
  }
}

export async function upsertEmailAddress({
  accountId,
  address,
}: {
  accountId: string;
  address: EmailAddress;
}) {
  try {
    const persistedEmailAddress = await db.emailAddress.findUnique({
      where: {
        accountId_address: {
          accountId,
          address: address.address,
        },
      },
    });

    if (persistedEmailAddress) {
      return persistedEmailAddress;
    }

    return await db.emailAddress.create({
      data: {
        accountId,
        name: address.name,
        address: address.address,
        raw: address.raw,
      },
    });
  } catch (error) {
    console.error("Error upserting email address", error);
    return null;
  }
}
