
import { config } from "dotenv";

import {
  MongoClient,
  type Db,
} from "mongodb";

// ======================================================
// 1. LOAD ENVIRONMENT VARIABLES
// ======================================================

config({
  path: ".env.local",
  quiet: true,
});

// ======================================================
// 2. COLLECTION NAMES
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
// 3. CREATE COLLECTIONS
// ======================================================

async function createCollections(
  db: Db
): Promise<void> {
  console.log("");
  console.log("[1/3] KIỂM TRA COLLECTIONS");

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

  for (const name of COLLECTIONS) {
    if (existingNames.has(name)) {
      console.log(`[EXISTS] ${name}`);
      continue;
    }

    await db.createCollection(name);

    console.log(`[CREATED] ${name}`);
  }
}

// ======================================================
// 4. CREATE INDEXES
// ======================================================

async function createIndexes(
  db: Db
): Promise<void> {
  console.log("");
  console.log("[2/3] TẠO INDEXES");

  // ==================================================
  // WEDDING EVENTS
  // Mỗi phía chỉ có một document.
  // ==================================================

  await db
    .collection("wedding_events")
    .createIndex(
      {
        side: 1,
      },
      {
        unique: true,
        name: "unique_wedding_side",
      }
    );

  // ==================================================
  // GUESTS
  // ==================================================

  const guests = db.collection("guests");

  await guests.createIndex(
    {
      invitationTokenHash: 1,
    },
    {
      unique: true,
      name: "unique_invitation_token",
    }
  );

  await guests.createIndex(
    {
      eventId: 1,
    },
    {
      name: "guest_event",
    }
  );

  await guests.createIndex(
    {
      side: 1,
      fullName: 1,
    },
    {
      name: "guest_side_name",
    }
  );

  await guests.createIndex(
    {
      relation: 1,
    },
    {
      name: "guest_relation",
    }
  );

  await guests.createIndex(
    {
      invitationStatus: 1,
    },
    {
      name: "guest_invitation_status",
    }
  );

  // ==================================================
  // GALLERY
  // ==================================================

  await db
    .collection("gallery")
    .createIndex(
      {
        isVisible: 1,
        sortOrder: 1,
      },
      {
        name: "gallery_display_order",
      }
    );

  // ==================================================
  // LOVE STORIES
  // ==================================================

  await db
    .collection("love_stories")
    .createIndex(
      {
        isVisible: 1,
        sortOrder: 1,
      },
      {
        name: "stories_display_order",
      }
    );

  // ==================================================
  // WISHES
  // ==================================================

  const wishes = db.collection("wishes");

  await wishes.createIndex(
    {
      status: 1,
      createdAt: -1,
    },
    {
      name: "wishes_review_queue",
    }
  );

  await wishes.createIndex(
    {
      guestId: 1,
    },
    {
      name: "wishes_guest",
    }
  );

  // ==================================================
  // ADMIN USERS
  // ==================================================

  await db
    .collection("admin_users")
    .createIndex(
      {
        username: 1,
      },
      {
        unique: true,
        name: "unique_admin_username",
      }
    );

  console.log("✅ INDEXES ĐÃ ĐƯỢC TẠO!");
}

// ======================================================
// 5. DEFAULT WEDDING EVENTS
// ======================================================

const INITIAL_WEDDING_EVENTS = [
  // ==================================================
  // NHÀ GÁI
  // ==================================================

  {
    side: "bride",

    eventTitle: "Bữa tiệc chung vui",

    eventDate: "2026-12-26",

    eventTime: null,

    timeConfirmed: false,

    timezone: "Asia/Ho_Chi_Minh",

    family: {
      father: "",
      mother: "",
    },

    venue: {
      name: "Tư gia nhà gái",
      address: "",
      mapUrl: "",
    },

    isActive: true,
  },

  // ==================================================
  // NHÀ TRAI
  // ==================================================

  {
    side: "groom",

    eventTitle: "Lễ thành hôn",

    eventDate: "2026-12-27",

    eventTime: null,

    timeConfirmed: false,

    timezone: "Asia/Ho_Chi_Minh",

    family: {
      father: "",
      mother: "",
    },

    venue: {
      name: "Tư gia nhà trai",
      address: "",
      mapUrl: "",
    },

    isActive: true,
  },
];

// ======================================================
// 6. SEED WEDDING EVENTS
// ======================================================

async function seedWeddingEvents(
  db: Db
): Promise<void> {
  console.log("");
  console.log("[3/3] KHỞI TẠO THÔNG TIN LỄ CƯỚI");

  const collection = db.collection(
    "wedding_events"
  );

  for (const event of INITIAL_WEDDING_EVENTS) {
    const now = new Date();

    const result = await collection.updateOne(
      {
        side: event.side,
      },
      {
        $setOnInsert: {
          ...event,
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        upsert: true,
      }
    );

    const label =
      event.side === "bride"
        ? "Nhà gái"
        : "Nhà trai";

    if (result.upsertedCount > 0) {
      console.log(
        `[CREATED] ${label} - ${event.eventDate}`
      );
    } else {
      console.log(
        `[EXISTS] ${label} - Giữ nguyên dữ liệu`
      );
    }
  }

  console.log("");
  console.log("✅ KHỞI TẠO LỄ CƯỚI HOÀN TẤT!");
}

// ======================================================
// 7. DATABASE SUMMARY
// ======================================================

async function showSummary(
  db: Db
): Promise<void> {
  console.log("");
  console.log("========== DATABASE SUMMARY ==========");

  for (const name of COLLECTIONS) {
    const count = await db
      .collection(name)
      .countDocuments();

    console.log(`${name}: ${count} documents`);
  }

  console.log("======================================");
}

// ======================================================
// 8. MAIN FUNCTION
// ======================================================

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  const dbName =
    process.env.MONGODB_DB_NAME ??
    "namthu_wedding";

  if (!uri) {
    throw new Error(
      "Thiếu MONGODB_URI trong .env.local"
    );
  }

  console.log("");
  console.log("======================================");
  console.log("NAM & THU - DATABASE INITIALIZATION");
  console.log("======================================");

  console.log(`Database: ${dbName}`);
  console.log("Đang kết nối MongoDB Atlas...");

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    retryWrites: true,
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
    // CREATE COLLECTIONS
    // ================================================

    await createCollections(db);

    // ================================================
    // CREATE INDEXES
    // ================================================

    await createIndexes(db);

    // ================================================
    // SEED WEDDING EVENTS
    // ================================================

    await seedWeddingEvents(db);

    // ================================================
    // SUMMARY
    // ================================================

    await showSummary(db);

    console.log("");
    console.log("✅ KHỞI TẠO DATABASE THÀNH CÔNG!");
  } finally {
    await client.close();

    console.log("Đã đóng kết nối MongoDB.");
  }
}

// ======================================================
// 9. EXECUTE
// ======================================================

main().catch((error: unknown) => {
  console.error("");
  console.error("❌ KHỞI TẠO DATABASE THẤT BẠI");

  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );

  process.exitCode = 1;
});
