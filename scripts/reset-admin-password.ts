
import { config } from "dotenv";
import { MongoClient } from "mongodb";
import * as argon2 from "argon2";

import {
  input,
  password,
  confirm,
} from "@inquirer/prompts";

// ======================================================
// NAM & THU - RESET ADMIN PASSWORD
// ======================================================

// Đọc biến môi trường trong .env.local.
config({
  path: ".env.local",
  quiet: true,
});

const MONGODB_URI = process.env.MONGODB_URI;

const DATABASE_NAME =
  process.env.MONGODB_DB_NAME ||
  "namthu_wedding";

const COLLECTION_NAME = "admin_users";

// ======================================================
// QUY TẮC MẬT KHẨU
// ======================================================

function validatePassword(value: string) {
  if (Array.from(value).length < 8) {
    throw new Error(
      "Mật khẩu phải có ít nhất 8 ký tự."
    );
  }

  if (!/[A-Za-z]/.test(value)) {
    throw new Error(
      "Mật khẩu phải chứa ít nhất một chữ cái."
    );
  }

  if (!/[0-9]/.test(value)) {
    throw new Error(
      "Mật khẩu phải chứa ít nhất một chữ số."
    );
  }

  if (!/[^A-Za-z0-9\s]/.test(value)) {
    throw new Error(
      "Mật khẩu phải chứa ít nhất một ký tự đặc biệt."
    );
  }

  if (Buffer.byteLength(value, "utf8") > 1024) {
    throw new Error(
      "Mật khẩu không được vượt quá 1024 byte."
    );
  }
}

// ======================================================
// MAIN
// ======================================================

async function main() {
  if (!MONGODB_URI) {
    throw new Error(
      "Thiếu MONGODB_URI trong .env.local."
    );
  }

  console.log("");
  console.log("======================================");
  console.log("NAM & THU - RESET ADMIN PASSWORD");
  console.log("======================================");
  console.log("");

  const username = (
    await input({
      message: "Tên tài khoản cần khôi phục:",
      default: "admin",
      required: true,
    })
  )
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9_.-]{3,50}$/.test(username)) {
    throw new Error(
      "Tên đăng nhập không hợp lệ."
    );
  }

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });

  try {
    await client.connect();

    const database = client.db(DATABASE_NAME);

    const collection = database.collection(
      COLLECTION_NAME
    );

    // Chỉ cho phép khôi phục Super Admin
    // thông qua terminal trên máy chủ.
    // Không mở chức năng này qua API công khai.
    const admin = await collection.findOne({
      username,
      role: "super_admin",
    });

    if (!admin) {
      throw new Error(
        "Không tìm thấy tài khoản Super Admin."
      );
    }

    console.log("");
    console.log(
      `Đã tìm thấy tài khoản: ${username}`
    );

    const newPassword = await password({
      message: "Nhập mật khẩu mới:",
      mask: "*",
    });

    validatePassword(newPassword);

    const confirmation = await password({
      message: "Xác nhận mật khẩu mới:",
      mask: "*",
    });

    if (newPassword !== confirmation) {
      throw new Error(
        "Mật khẩu xác nhận không khớp."
      );
    }

    const approved = await confirm({
      message:
        "Xác nhận đặt lại mật khẩu và thu hồi phiên cũ?",
      default: false,
    });

    if (!approved) {
      console.log(
        "Đã hủy. Không thay đổi dữ liệu."
      );
      return;
    }

    // Băm mật khẩu bằng Argon2id.
    const passwordHash = await argon2.hash(
      newPassword,
      {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      }
    );

    // Không thay đổi role, username hoặc
    // thông tin khác của Super Admin.
    const result = await collection.updateOne(
      {
        _id: admin._id,
        username,
        role: "super_admin",
      },
      {
        $set: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          activeSessionHash: null,
          sessionExpiresAt: null,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount !== 1) {
      throw new Error(
        "Không thể cập nhật tài khoản."
      );
    }

    console.log("");
    console.log(
      "✅ ĐỔI MẬT KHẨU SUPER ADMIN THÀNH CÔNG!"
    );
    console.log(`Tài khoản: ${username}`);
    console.log("Vai trò: super_admin");
    console.log("Các phiên cũ: Đã thu hồi");
    console.log("");
    console.log(
      "Đăng nhập: http://localhost:3000/admin/login"
    );
  } finally {
    await client.close();
  }
}

// ======================================================
// EXECUTE
// ======================================================

main().catch((error: unknown) => {
  console.error("");
  console.error(
    "❌ KHÔNG THỂ ĐẶT LẠI MẬT KHẨU"
  );

  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );

  process.exitCode = 1;
});
