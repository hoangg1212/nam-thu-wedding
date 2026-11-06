
import { config } from "dotenv";
import { MongoClient } from "mongodb";
import * as argon2 from "argon2";

import {
  input,
  password,
} from "@inquirer/prompts";

// ======================================================
// 1. LOAD ENVIRONMENT VARIABLES
// ======================================================

config({
  path: ".env.local",
  quiet: true,
});

// ======================================================
// 2. CONFIGURATION
// ======================================================

const MONGODB_URI = process.env.MONGODB_URI;

const DATABASE_NAME =
  process.env.MONGODB_DB_NAME || "namthu_wedding";

const COLLECTION_NAME = "admin_users";

// ======================================================
// 3. VALIDATE PASSWORD
// ======================================================

function validatePassword(value: string): void {
  // Ít nhất 8 ký tự.
  if (Array.from(value).length < 8) {
    throw new Error(
      "Mật khẩu phải có ít nhất 8 ký tự."
    );
  }

  // Phải có chữ cái.
  if (!/[A-Za-z]/.test(value)) {
    throw new Error(
      "Mật khẩu phải có ít nhất một chữ cái."
    );
  }

  // Phải có chữ số.
  if (!/[0-9]/.test(value)) {
    throw new Error(
      "Mật khẩu phải có ít nhất một chữ số."
    );
  }

  // Phải có ký tự đặc biệt.
  if (!/[^A-Za-z0-9\s]/.test(value)) {
    throw new Error(
      "Mật khẩu phải có ít nhất một ký tự đặc biệt."
    );
  }

  if (Buffer.byteLength(value, "utf8") > 1024) {
    throw new Error(
      "Mật khẩu không được vượt quá 1024 byte."
    );
  }
}

// ======================================================
// 4. MAIN
// ======================================================

async function main(): Promise<void> {
  if (!MONGODB_URI) {
    throw new Error(
      "Thiếu MONGODB_URI trong .env.local."
    );
  }

  console.log("");
  console.log("======================================");
  console.log("NAM & THU - CREATE ADMIN");
  console.log("======================================");
  console.log("");

  // ==================================================
  // NHẬP TÊN ĐĂNG NHẬP
  // ==================================================

  const username = (
    await input({
      message: "Tên đăng nhập Admin:",
      default: "admin",
      required: true,
    })
  )
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9_.-]{3,50}$/.test(username)) {
    throw new Error(
      "Username phải có 3–50 ký tự và chỉ gồm chữ thường, chữ số, dấu chấm, gạch dưới hoặc gạch ngang."
    );
  }

  // ==================================================
  // NHẬP MẬT KHẨU
  // ==================================================

  const adminPassword = await password({
    message: "Mật khẩu Admin:",
    mask: "*",
  });

  validatePassword(adminPassword);

  // ==================================================
  // XÁC NHẬN MẬT KHẨU
  // ==================================================

  const confirmPassword = await password({
    message: "Xác nhận mật khẩu:",
    mask: "*",
  });

  if (adminPassword !== confirmPassword) {
    throw new Error(
      "Mật khẩu xác nhận không khớp."
    );
  }

  // ==================================================
  // KẾT NỐI MONGODB
  // ==================================================

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();

    const db = client.db(DATABASE_NAME);

    const collection = db.collection(
      COLLECTION_NAME
    );

    // =================================================
    // KIỂM TRA USERNAME ĐÃ TỒN TẠI
    // =================================================

    const existingAdmin = await collection.findOne({
      username,
    });

    if (existingAdmin) {
      throw new Error(
        "Tên đăng nhập này đã tồn tại. Hãy dùng chức năng đặt lại mật khẩu nếu bạn quên mật khẩu."
      );
    }

    // =================================================
    // MÃ HÓA MẬT KHẨU
    // =================================================

    console.log("");
    console.log("Đang mã hóa mật khẩu...");

    const passwordHash = await argon2.hash(
      adminPassword,
      {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      }
    );

    // =================================================
    // TẠO TÀI KHOẢN ADMIN
    // =================================================

    const now = new Date();

    const result = await collection.insertOne({
      username,
      passwordHash,

      role: "admin",
      isActive: true,

      failedLoginAttempts: 0,
      lockedUntil: null,

      activeSessionHash: null,
      sessionExpiresAt: null,

      lastLoginAt: null,

      createdAt: now,
      updatedAt: now,
    });

    // =================================================
    // SUCCESS
    // =================================================

    console.log("");
    console.log("======================================");
    console.log("✅ TẠO ADMIN THÀNH CÔNG!");
    console.log("======================================");
    console.log(`Username: ${username}`);
    console.log(
      `Admin ID: ${result.insertedId.toHexString()}`
    );
    console.log("");
    console.log(
      "Đăng nhập tại: http://localhost:3000/admin/login"
    );
  } finally {
    await client.close();
  }
}

// ======================================================
// 5. EXECUTE
// ======================================================

main().catch((error: unknown) => {
  console.error("");
  console.error("❌ KHÔNG THỂ TẠO ADMIN");

  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );

  process.exitCode = 1;
});
