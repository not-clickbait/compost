import { requestChangedEmails, startEmailSync } from "~/lib/aurinko";

export class Account {
  private accessToken: string;

  constructor(token: string) {
    this.accessToken = token;
  }

  initialSync = async () => {
    let { syncUpdatedToken, ready } = await startEmailSync(this.accessToken);

    let attempts = 1;

    while (!ready && attempts < 5) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      ({ syncUpdatedToken, ready } = await startEmailSync(this.accessToken));
      attempts++;
    }

    if (!ready) {
      throw new Error("Initial sync failed");
    }

    let nextPageToken = undefined;

    const recordsToPersist = [];

    do {
      // Todo keep track of sync status, abort on failure
      const response = await requestChangedEmails({
        accessToken: this.accessToken,
        deltaToken: syncUpdatedToken,
        pageToken: nextPageToken,
      });

      recordsToPersist.push(...response.records);

      nextPageToken = response.nextPageToken ?? null;

      if (response.nextDeltaToken) {
        syncUpdatedToken = response.nextDeltaToken;
        console.log("Sync completed ✅");
      }
    } while (nextPageToken);

    return {
      records: recordsToPersist,
      syncUpdatedToken,
    };
  };
}
