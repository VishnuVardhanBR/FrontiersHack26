import { z } from "zod";

export const SessionIdSchema = z.string().uuid();

export type SessionId = z.infer<typeof SessionIdSchema>;
