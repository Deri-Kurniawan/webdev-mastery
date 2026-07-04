import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
    server: {
        DATABASE_URL: z.url().default("file:./db.sqlite"),
    },
    client: {
        NEXT_PUBLIC_BASE_APP_URL: z.string().default("http://localhost:3000"),
    },
    experimental__runtimeEnv: {
        NEXT_PUBLIC_BASE_APP_URL: process.env.NEXT_PUBLIC_BASE_APP_URL,
    }
});