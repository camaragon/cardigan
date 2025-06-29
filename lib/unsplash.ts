import { createApi } from "unsplash-js";

const accessKey = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;

if (!accessKey) {
  throw new Error("Missing NEXT_PUBLIC_UNSPLASH_ACCESS_KEY in environment");
}

export const unsplash = createApi({
  accessKey,
  fetch: fetch,
});
