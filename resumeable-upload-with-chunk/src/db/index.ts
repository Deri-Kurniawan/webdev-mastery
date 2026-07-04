import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import { env } from "@/env";

const client = createClient({
    url: env.DATABASE_URL,
});

export const db = drizzle(client, { schema });