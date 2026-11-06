
import { config } from "dotenv";

import {
  MongoClient,
} from "mongodb";

// ======================================================
// 1. LOAD .ENV.LOCAL
// ======================================================

config({
  path: ".env.local",
  quiet: true,
});

// ======================================================
// 2. CONFIGURATION
// ======================================================

const COLLECTIONS = [
  "wedding_events",
  "guests",
  "gallery",
  "love_stories",
  "wishes",
  "admin_users",
] as const;

// ======================================================
// 3. MAIN FUNCTION
// ======================================================

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  const dbName =
    process.env.MONGODB_DB_NAME ??
    "namthu_wedding";

  if (!uri) {
    throw new Error(
      "Không tìm thấy MONGODB_URI trong .env.local"
    );
  }

  console.log("================================");
  console.log("NAM & THU - DATABASE CHECK");
  console.log("================================");

  console.log(`Database: ${dbName}`);
  console.log("Đang kết nối MongoDB Atlas...");

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    // ================================================
    // CONNECT
    // ================================================

    await client.connect();

    const db = client.db(dbName);

    await db.command({
      ping: 1,
    });

    console.log("");
    console.log("✅ KẾT NỐI MONGODB THÀNH CÔNG!");

    // ================================================
    // CHECK COLLECTIONS
    // ================================================

    const collections = await db
      .listCollections(
        {},
        {
          nameOnly: true,
        }
      )
      .toArray();

    const existingNames = new Set(
      collections.map((item) => item.name)
    );

    console.log("");
    console.log("========== COLLECTIONS ==========");

    for (const name of COLLECTIONS) {
      if (!existingNames.has(name)) {
        console.log(
          `[CHƯA TẠO] ${name}`
        );

        continue;
      }

      const total = await db
        .collection(name)
        .countDocuments();

      console.log(
        `[OK] ${name}: ${total} documents`
      );
    }

    console.log("=================================");

    // ================================================
    // CHECK WEDDING EVENTS
    // ================================================

    if (existingNames.has("wedding_events")) {
      const events = await db
        .collection("wedding_events")
        .find(
          {},
          {
            projection: {
              _id: 0,
              side: 1,
              eventTitle: 1,
              eventDate: 1,
              eventTime: 1,
              timeConfirmed: 1,
            },
          }
        )
        .sort({
          side: 1,
        })
        .toArray();

      console.log("");
      console.log("===== WEDDING EVENTS =====");

      if (events.length === 0) {
        console.log(
          "Chưa có dữ liệu thông tin lễ cưới."
        );
      } else {
        console.table(events);
      }
    }

    console.log("");
    console.log("✅ KIỂM TRA DATABASE HOÀN TẤT!");
  } finally {
    await client.close();

    console.log("Đã đóng kết nối kiểm tra.");
  }
}

// ======================================================
// 4. EXECUTE
// ======================================================

main().catch((error: unknown) => {
  console.error("");
  console.error("❌ KẾT NỐI DATABASE THẤT BẠI");

  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );

  process.exitCode = 1;
});
