
import { NextResponse } from "next/server";
import { connection } from "next/server";
import type { Document } from "mongodb";

import {
  getPublicWeddingEvents,
} from "@/lib/public-wedding-events";

import {
  getDatabase,
} from "@/lib/mongodb";

// ======================================================
// NAM & THU - PUBLIC WEDDING EVENTS API
//
// GET /api/wedding-events
//
// CẬP NHẬT:
// - Thêm familyDisplayMode cho từng sự kiện.
// - Lấy lựa chọn trực tiếp từ MongoDB.
// - Tương thích dữ liệu cũ: mặc định "both".
// - Không trả dữ liệu tài khoản quản trị.
// - Không thay đổi danh sách sự kiện công khai
//   do getPublicWeddingEvents() quyết định.
// ======================================================

type ParentDisplayMode =
  | "both"
  | "father"
  | "mother";

function normalizeDisplayMode(
  value: unknown
): ParentDisplayMode {
  if (
    value === "father" ||
    value === "mother"
  ) {
    return value;
  }

  return "both";
}

export async function GET() {
  // Đọc dữ liệu mới tại mỗi request.
  await connection();

  try {
    // Giữ nguyên nguồn dữ liệu công khai
    // và quy tắc sự kiện đang kích hoạt.
    const events =
      await getPublicWeddingEvents();

    const database =
      await getDatabase();

    const collection =
      database.collection<Document>(
        "wedding_events"
      );

    // Chỉ đọc trường cần thiết.
    const documents =
      await collection
        .find(
          {
            side: {
              $in: ["groom", "bride"],
            },
          },
          {
            projection: {
              _id: 0,
              side: 1,
              "family.displayMode": 1,
            },
          }
        )
        .toArray();

    const modes =
      new Map<string, ParentDisplayMode>();

    for (const document of documents) {
      const side =
        document.side;

      if (
        side !== "groom" &&
        side !== "bride"
      ) {
        continue;
      }

      const family =
        document.family &&
        typeof document.family === "object" &&
        !Array.isArray(document.family)
          ? document.family as Record<
              string,
              unknown
            >
          : {};

      modes.set(
        side,
        normalizeDisplayMode(
          family.displayMode
        )
      );
    }

    // Chỉ bổ sung chế độ hiển thị.
    // Không tiết lộ document MongoDB.
    const publicEvents =
      events.map((event) => ({
        ...event,
        familyDisplayMode:
          modes.get(event.side) ?? "both",
      }));

    return NextResponse.json(
      {
        success: true,
        events: publicEvents,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (error) {
    console.error(
      "[PUBLIC WEDDING EVENTS ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Thông tin lễ cưới tạm thời chưa khả dụng.",
        events: [],
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
