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

    let nextDeltaToken, nextPageToken;

    const recordsToPersist = [];

    do {
      const response = await requestChangedEmails(
        this.accessToken,
        syncUpdatedToken,
      );

      ({ nextDeltaToken, nextPageToken } = response);

      recordsToPersist.push(...response.records);
      console.log(`Fetched ${response.records.length} records`);

      syncUpdatedToken = nextDeltaToken;
    } while (nextPageToken);

    console.log(`Persisting ${recordsToPersist.length} records`);
  };
}
