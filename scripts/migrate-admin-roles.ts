
import { config } from "dotenv";
import { MongoClient } from "mongodb";

// Đọc biến môi trường của dự án.
config({ path: ".env.local", quiet: true });

async function main() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Thiếu MONGODB_URI trong .env.local");
  }

  const databaseName =
    process.env.MONGODB_DB_NAME || "namthu_wedding";

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();

    const db = client.db(databaseName);
    const admins = db.collection("admin_users");

    // Chỉ cập nhật tài khoản admin đã tồn tại.
    const existing = await admins.findOne({
      username: "admin",
    });

    if (!existing) {
      throw new Error(
        "Không tìm thấy tài khoản admin. Dừng migration."
      );
    }

    // Không thay đổi passwordHash.
    const result = await admins.updateOne(
      { _id: existing._id },
      {
        $set: {
          role: "super_admin",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount !== 1) {
      throw new Error("Không cập nhật được tài khoản.");
    }

    console.log("✅ Đã nâng cấp admin thành super_admin");
    console.log("✅ Giữ nguyên mật khẩu hiện tại");
    console.log("✅ Không thay đổi dữ liệu lễ cưới");
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    "❌ Migration thất bại:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
