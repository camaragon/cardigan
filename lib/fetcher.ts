export class FetchError extends Error {
  constructor(public readonly status: number) {
    super(`Request failed (${status})`);
    this.name = "FetchError";
  }
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new FetchError(response.status);
  return response.json();
};
