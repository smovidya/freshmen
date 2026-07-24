import z from "zod/v4";

export const FRIEND_CODE_LENGTH = 7;
// Same-airline and cross-airline adds are two independent 10-slot buckets,
// not one shared pool - up to 20 friends total (10 + 10).
export const MAX_FRIENDS_PER_BUCKET = 10;
export const MAX_FRIENDS_TOTAL = MAX_FRIENDS_PER_BUCKET * 2;

export const addFriendSchema = z.object({
  code: z.string().length(FRIEND_CODE_LENGTH),
});
