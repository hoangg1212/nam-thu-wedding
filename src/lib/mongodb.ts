
import "server-only";

import {
  MongoClient,
  type Db,
  type MongoClientOptions,
} from "mongodb";

// ======================================================
// NAM & THU WEDDING - MONGODB CONNECTION
//
// CHỨC NĂNG:
// - Kết nối MongoDB.
// - Quản lý connection pool.
// - Tái sử dụng kết nối trong Development.
// - Tái sử dụng kết nối trong Production.
// - Cho phép kết nối lại khi gặp lỗi.
// - Cung cấp MongoClient và Database.
// - Kiểm tra trạng thái kết nối MongoDB.
//
// FIX ESLINT:
// - Xóa eslint-disable-next-line no-var
//   không còn cần thiết.
// - Giữ nguyên logic kết nối hiện tại.
// ======================================================

// ======================================================
// 1. CẤU HÌNH MONGODB
// ======================================================

// URI kết nối được lấy từ biến môi trường.
// Không hardcode tài khoản hoặc mật khẩu.
const uri = process.env.MONGODB_URI;

// Tên database.
// Nếu chưa cấu hình, dùng database mặc định.
const databaseName =
  process.env.MONGODB_DB_NAME || "namthu_wedding";

// ======================================================
// 2. CONNECTION POOL OPTIONS
// ======================================================

const options: MongoClientOptions = {
  // Số kết nối tối đa trong pool.
  maxPoolSize: 10,

  // Không bắt buộc duy trì kết nối tối thiểu.
  minPoolSize: 0,

  // Đóng kết nối nhàn rỗi sau 60 giây.
  maxIdleTimeMS: 60000,

  // Thời gian tối đa tìm MongoDB server.
  serverSelectionTimeoutMS: 10000,

  // Thời gian tối đa thiết lập kết nối.
  connectTimeoutMS: 10000,

  // Cho phép MongoDB tự thử lại thao tác ghi
  // khi xảy ra một số lỗi kết nối tạm thời.
  retryWrites: true,
};

// ======================================================
// 3. BỘ NHỚ KẾT NỐI
//
// DEVELOPMENT:
// Sử dụng globalThis để tái sử dụng Promise
// khi Next.js thực hiện Hot Reload.
//
// PRODUCTION:
// Sử dụng biến cấp module để tái sử dụng
// Promise kết nối trong cùng runtime.
// ======================================================

declare global {
  var namThuMongoClientPromise:
    | Promise<MongoClient>
    | undefined;
}

let productionClientPromise:
  | Promise<MongoClient>
  | undefined;

// ======================================================
// 4. TẠO KẾT NỐI MONGODB
//
// Nếu thiếu MONGODB_URI:
// - Trả về Promise bị reject.
// - Thông báo rõ nguyên nhân.
//
// Nếu kết nối lỗi:
// - Đóng MongoClient.
// - Chuyển tiếp lỗi để xử lý retry.
// ======================================================

function createConnection(): Promise<MongoClient> {
  if (!uri) {
    return Promise.reject(
      new Error(
        "Thiếu MONGODB_URI trong .env.local"
      )
    );
  }

  const client = new MongoClient(uri, options);

  return client.connect().catch(async (error) => {
    // Giải phóng tài nguyên nếu kết nối lỗi.
    await client.close().catch(() => undefined);

    throw error;
  });
}

// ======================================================
// 5. LẤY MONGO CLIENT
//
// DEVELOPMENT:
// - Lưu Promise trong globalThis.
// - Hạn chế tạo kết nối mới khi Hot Reload.
//
// PRODUCTION:
// - Lưu Promise trong biến module.
//
// Khi kết nối thất bại:
// - Xóa Promise lỗi khỏi cache.
// - Lần gọi tiếp theo có thể kết nối lại.
// ======================================================

export async function getMongoClient(): Promise<MongoClient> {
  const development =
    process.env.NODE_ENV === "development";

  let promise: Promise<MongoClient>;

  // ==================================================
  // DEVELOPMENT
  // ==================================================

  if (development) {
    if (!globalThis.namThuMongoClientPromise) {
      globalThis.namThuMongoClientPromise =
        createConnection();
    }

    promise = globalThis.namThuMongoClientPromise;
  } else {
    // ================================================
    // PRODUCTION
    // ================================================

    if (!productionClientPromise) {
      productionClientPromise = createConnection();
    }

    promise = productionClientPromise;
  }

  // ==================================================
  // CHỜ KẾT NỐI HOÀN THÀNH
  // ==================================================

  try {
    return await promise;
  } catch (error) {
    // ==================================================
    // XỬ LÝ KẾT NỐI THẤT BẠI
    //
    // Chỉ xóa cache nếu Promise lỗi vẫn
    // chính là Promise đang được lưu.
    //
    // Không xóa Promise mới của request khác.
    // ==================================================

    if (development) {
      if (
        globalThis.namThuMongoClientPromise ===
        promise
      ) {
        globalThis.namThuMongoClientPromise =
          undefined;
      }
    } else if (productionClientPromise === promise) {
      productionClientPromise = undefined;
    }

    throw error;
  }
}

// ======================================================
// 6. LẤY DATABASE
//
// Sử dụng MongoClient đã được tái sử dụng.
// Không tạo kết nối mới cho mỗi lần gọi.
// ======================================================

export async function getDatabase(): Promise<Db> {
  const client = await getMongoClient();

  return client.db(databaseName);
}

// ======================================================
// 7. KIỂM TRA KẾT NỐI MONGODB
//
// Gửi lệnh ping đến MongoDB.
//
// Kết quả:
// - true: Kết nối và ping thành công.
// - false: Xảy ra lỗi kết nối hoặc ping.
//
// Không trả về thông tin bí mật của MongoDB.
// ======================================================

export async function pingMongoDB(): Promise<boolean> {
  try {
    const db = await getDatabase();

    await db.command({ ping: 1 });

    return true;
  } catch (error) {
    console.error(
      "[MONGODB CONNECTION ERROR]",
      error
    );

    return false;
  }
}
