import { AssetType } from "@prisma/client";
import { db } from "../db.js";
import { normalizeV3PositionPublicToken } from "../services/metadata.js";

const locks = await db.lock.findMany({
  where: { assetType: AssetType.V3_POSITION },
  select: { id: true }
});

for (const lock of locks) {
  await normalizeV3PositionPublicToken(lock.id);
}

console.log(`Normalized ${locks.length} V3 position lock${locks.length === 1 ? "" : "s"}`);
await db.$disconnect();
