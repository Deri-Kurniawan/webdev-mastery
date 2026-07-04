import { db } from "@/db";
import { asc } from "drizzle-orm";

export async function GET(_request: Request) {
    const files = await db.query.filesTable.findMany({
        orderBy: ({ createdAt }) => asc(createdAt),
    });
    return Response.json({ files });
}