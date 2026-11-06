
import "server-only";

import { randomUUID } from "node:crypto";

import type { Collection } from "mongodb";

import { getDatabase } from "@/lib/mongodb";

import { wedding } from "@/data/wedding";

// ======================================================
// NAM & THU - LOVE STORY DATABASE
//
// GIAI ĐOẠN 3.8 - BƯỚC 2
//
// Chức năng:
// 1. Quản lý dữ liệu Love Story trong MongoDB.
// 2. Khởi tạo dữ liệu từ wedding.ts một lần.
// 3. Kiểm tra tiêu đề tối đa 200 ký tự.
// 4. Kiểm tra nội dung tối đa 2000 ký tự.
// 5. Kiểm tra ngày theo dd/mm/yyyy.
// 6. Hỗ trợ ký tự đặc biệt và emoji.
// 7. Hỗ trợ ẩn/hiện, sắp xếp, thêm/sửa/xóa.
// 8. Dữ liệu dùng chung cho cả ba Admin.
//
// Không giới hạn dữ liệu theo Nhà trai/Nhà gái.
// Phân quyền sẽ được kiểm tra tại API.
// ======================================================

// ======================================================
// CONFIG
// ======================================================

export const STORIES_COLLECTION = "wedding_stories";

export const STORIES_META_COLLECTION =
  "wedding_stories_meta";

// Giới hạn ký tự được thống nhất với người dùng.
export const STORY_TITLE_MAX_LENGTH = 200;

export const STORY_DESCRIPTION_MAX_LENGTH = 2000;

// Ngày nhập dạng dd/mm/yyyy.
export const STORY_DATE_FORMAT = "dd/mm/yyyy";

// Ảnh upload lên GridFS sẽ có URL dạng:
// /api/stories/image/<mongodb-object-id>
export const STORY_IMAGE_API_PREFIX =
  "/api/stories/image/";

// Giới hạn dung lượng ảnh: 8 MB.
export const STORY_IMAGE_MAX_BYTES =
  8 * 1024 * 1024;

// Các định dạng ảnh được hỗ trợ.
export const STORY_ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// Khóa đánh dấu đã khởi tạo dữ liệu.
// Giữ cố định để không tự khôi phục những
// câu chuyện đã bị Admin xóa.
const STORY_SEED_META_ID = "initial-stories";

// ======================================================
// DATABASE TYPES
// ======================================================

export interface WeddingStoryDocument {
  _id: string;

  // Ngày được hiển thị trên thiệp cưới.
  // Dữ liệu mới phải có dạng dd/mm/yyyy.
  // Dữ liệu cũ có thể là nhãn thời gian.
  date: string;

  // Tiêu đề cột mốc.
  title: string;

  // Nội dung câu chuyện.
  description: string;

  // Đường dẫn ảnh.
  // Có thể là ảnh tĩnh hoặc ảnh GridFS.
  image: string;

  // Vị trí trong dòng thời gian.
  sortOrder: number;

  // Có hiển thị trên thiệp cưới hay không.
  isVisible: boolean;

  // Mã tài khoản đã tạo.
  createdBy: string | null;

  // Thời gian tạo và cập nhật.
  createdAt: Date;
  updatedAt: Date;
}

export interface WeddingStory {
  id: string;
  date: string;
  title: string;
  description: string;
  image: string;
  sortOrder: number;
  isVisible: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StorySeedMetaDocument {
  _id: string;
  initialized: boolean;
  initializedAt: Date;
}

// ======================================================
// STRING HELPERS
// ======================================================

// Đếm Unicode code points thay vì độ dài UTF-16.
//
// Ví dụ:
// "❤️" có thể bao gồm nhiều code points.
// Hàm này đồng bộ với cách đếm Array.from()
// trên giao diện.
//
// Không loại bỏ emoji hay ký tự đặc biệt.
export function countStoryCharacters(
  value: string
): number {
  return Array.from(value).length;
}

// Kiểm tra dữ liệu đầu vào là chuỗi.
function requireString(
  value: unknown,
  fieldName: string
): string {
  if (typeof value !== "string") {
    throw new Error(
      `${fieldName} phải là chuỗi ký tự.`
    );
  }

  return value;
}

// ======================================================
// VALIDATE TITLE
// ======================================================

// Tiêu đề:
// - Không được để trống.
// - Tối đa 200 ký tự.
// - Cho phép tiếng Việt và ký tự đặc biệt.
// - Không chuyển đổi hoặc xóa emoji.
export function validateStoryTitle(
  value: unknown
): string {
  const title = requireString(
    value,
    "Tiêu đề"
  ).trim();

  if (!title) {
    throw new Error(
      "Vui lòng nhập tiêu đề câu chuyện."
    );
  }

  if (
    countStoryCharacters(title) >
    STORY_TITLE_MAX_LENGTH
  ) {
    throw new Error(
      `Tiêu đề không được vượt quá ${STORY_TITLE_MAX_LENGTH} ký tự.`
    );
  }

  return title;
}

// ======================================================
// VALIDATE DESCRIPTION
// ======================================================

// Nội dung:
// - Không được để trống.
// - Tối đa 2000 ký tự.
// - Giữ nguyên xuống dòng bên trong.
// - Cho phép tiếng Việt, emoji và ký tự đặc biệt.
//
// Khi hiển thị ở frontend cần sử dụng
// white-space: pre-line hoặc pre-wrap
// để giữ định dạng xuống dòng.
export function validateStoryDescription(
  value: unknown
): string {
  const description = requireString(
    value,
    "Nội dung câu chuyện"
  ).trim();

  if (!description) {
    throw new Error(
      "Vui lòng nhập nội dung câu chuyện."
    );
  }

  if (
    countStoryCharacters(description) >
    STORY_DESCRIPTION_MAX_LENGTH
  ) {
    throw new Error(
      `Nội dung không được vượt quá ${STORY_DESCRIPTION_MAX_LENGTH} ký tự.`
    );
  }

  return description;
}

// ======================================================
// DATE HELPERS
// ======================================================

// Kiểm tra năm nhuận.
//
// Năm nhuận nếu:
// - Chia hết cho 400.
// Hoặc:
// - Chia hết cho 4 nhưng không chia hết cho 100.
function isLeapYear(year: number): boolean {
  return (
    year % 400 === 0 ||
    (year % 4 === 0 && year % 100 !== 0)
  );
}

// Trả về số ngày tối đa của từng tháng.
function daysInMonth(
  month: number,
  year: number
): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  if (
    month === 4 ||
    month === 6 ||
    month === 9 ||
    month === 11
  ) {
    return 30;
  }

  return 31;
}

// ======================================================
// VALIDATE DATE
// ======================================================

// Kiểm tra ngày tháng thực tế.
//
// Ví dụ hợp lệ:
// 01/01/2026
// 29/02/2024
// 31/12/2026
//
// Ví dụ không hợp lệ:
// 31/02/2026
// 29/02/2025
// 00/12/2026
// 15/13/2026
export function validateStoryDate(
  value: unknown
): string {
  const input = requireString(
    value,
    "Ngày tháng năm"
  ).trim();

  if (!input) {
    throw new Error(
      "Vui lòng chọn hoặc nhập ngày tháng năm."
    );
  }

  const matched = input.match(
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  );

  if (!matched) {
    throw new Error(
      "Ngày phải có định dạng dd/mm/yyyy. Ví dụ: 26/12/2026."
    );
  }

  const day = Number(matched[1]);
  const month = Number(matched[2]);
  const year = Number(matched[3]);

  if (year < 1 || year > 9999) {
    throw new Error(
      "Năm phải nằm trong khoảng 0001 đến 9999."
    );
  }

  if (month < 1 || month > 12) {
    throw new Error(
      "Tháng không hợp lệ."
    );
  }

  if (
    day < 1 ||
    day > daysInMonth(month, year)
  ) {
    throw new Error(
      "Ngày không hợp lệ trong tháng đã chọn."
    );
  }

  return input;
}

// ======================================================
// DATE CONVERSION
// ======================================================

// Chuyển ngày từ input type="date":
// yyyy-mm-dd
//
// Sang dạng hiển thị và lưu MongoDB:
// dd/mm/yyyy
export function isoToStoryDate(
  value: string
): string {
  const matched = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!matched) {
    throw new Error(
      "Ngày từ lịch không hợp lệ."
    );
  }

  return validateStoryDate(
    `${matched[3]}/${matched[2]}/${matched[1]}`
  );
}

// Chuyển từ dd/mm/yyyy sang yyyy-mm-dd.
//
// Hàm này phục vụ việc hiển thị ngày
// đã lưu khi Admin mở popup chỉnh sửa.
export function storyDateToIso(
  value: string
): string {
  const validDate = validateStoryDate(
    value
  );

  const [day, month, year] =
    validDate.split("/");

  return `${year}-${month}-${day}`;
}

// ======================================================
// VALIDATE IMAGE URL
// ======================================================

// Chỉ chấp nhận:
// 1. Ảnh nằm trong public/ của website.
// 2. Ảnh đã upload lên API GridFS Love Story.
//
// Không chấp nhận:
// - URL HTTP bên ngoài.
// - javascript:
// - data:
// - Đường dẫn //domain.
// - Đường dẫn vượt thư mục.
//
// Cho phép chuỗi rỗng nếu chưa thêm ảnh.
export function isValidStoryImageUrl(
  value: unknown
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  if (value === "") {
    return true;
  }

  // Ảnh GridFS.
  if (
    /^\/api\/stories\/image\/[a-f0-9]{24}$/i.test(
      value
    )
  ) {
    return true;
  }

  // Ảnh trong public/.
  // Chỉ cho phép đường dẫn file ảnh nội bộ.
  return /^\/(?!\/)(?!api\/)[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(
    value
  ) &&
    !value.includes("..") &&
    !value.includes("//");
}

// Kiểm tra đường dẫn ảnh.
export function validateStoryImageUrl(
  value: unknown
): string {
  if (!isValidStoryImageUrl(value)) {
    throw new Error(
      "Đường dẫn ảnh Love Story không hợp lệ."
    );
  }

  return value;
}

// ======================================================
// ID GENERATION
// ======================================================

// Tạo ID ngẫu nhiên cho mỗi cột mốc.
//
// Không sử dụng timestamp hoặc số thứ tự,
// tránh trùng ID khi nhiều Admin cùng thêm.
export function createWeddingStoryId(): string {
  return randomUUID();
}

// ======================================================
// DATABASE COLLECTION
// ======================================================

// Collection lưu các cột mốc Love Story.
export async function getStoriesCollection(): Promise<
  Collection<WeddingStoryDocument>
> {
  const database = await getDatabase();

  return database.collection<WeddingStoryDocument>(
    STORIES_COLLECTION
  );
}

// Collection ghi nhận việc khởi tạo ban đầu.
async function getStoriesMetaCollection(): Promise<
  Collection<StorySeedMetaDocument>
> {
  const database = await getDatabase();

  return database.collection<StorySeedMetaDocument>(
    STORIES_META_COLLECTION
  );
}

// ======================================================
// SERIALIZE STORY
// ======================================================

// Chuyển document MongoDB sang dữ liệu JSON
// để API và frontend sử dụng.
//
// Không trả MongoDB _id trực tiếp dưới dạng object.
export function serializeWeddingStory(
  document: WeddingStoryDocument
): WeddingStory {
  return {
    id: document._id,

    date: document.date,
    title: document.title,
    description: document.description,

    image: document.image,

    sortOrder: document.sortOrder,

    isVisible: document.isVisible,

    createdBy: document.createdBy,

    createdAt:
      document.createdAt.toISOString(),

    updatedAt:
      document.updatedAt.toISOString(),
  };
}

// ======================================================
// INITIAL DATA
// ======================================================

// Chuyển dữ liệu wedding.stories sang MongoDB.
//
// Dữ liệu cũ có thể đang sử dụng nhãn:
//
// "Ngày đầu gặp gỡ"
// "Ngày chúng mình hẹn hò"
//
// Ta giữ nguyên những nhãn này khi khởi tạo
// để không làm thay đổi nội dung hiện tại.
//
// Khi Admin tạo hoặc chỉnh sửa cột mốc,
// API sẽ yêu cầu ngày theo dd/mm/yyyy.
function buildInitialStories():
  WeddingStoryDocument[] {
  const now = new Date();

  return wedding.stories.map(
    (story, index) => ({
      _id: `initial-story-${index + 1}`,

      date: story.date,

      title: story.title,

      description: story.description,

      image:
        isValidStoryImageUrl(story.image)
          ? story.image
          : "",

      sortOrder: index,

      isVisible: true,

      createdBy: null,

      createdAt: now,
      updatedAt: now,
    })
  );
}

// ======================================================
// INITIALIZE STORIES
// ======================================================

// Mục tiêu:
// - Nếu chưa khởi tạo: lấy dữ liệu từ wedding.ts.
// - Nếu đã khởi tạo: không chèn thêm dữ liệu cũ.
// - Khi Admin xóa hết cột mốc: không tự khôi phục.
// - Nếu có nhiều request đồng thời: chỉ một request
//   được quyền thực hiện khởi tạo.
//
// Lưu ý:
// Việc khởi tạo chạy trên cùng database MongoDB.
// ======================================================

export async function ensureStoriesInitialized():
  Promise<void> {
  const stories =
    await getStoriesCollection();

  const metadata =
    await getStoriesMetaCollection();

  // Kiểm tra dữ liệu đã được khởi tạo chưa.
  const existingMeta =
    await metadata.findOne({
      _id: STORY_SEED_META_ID,
    });

  if (existingMeta?.initialized) {
    return;
  }

  // Nếu collection đã có dữ liệu nhưng chưa
  // có metadata, không chèn trùng dữ liệu.
  const existingCount =
    await stories.countDocuments(
      {},
      { limit: 1 }
    );

  if (existingCount > 0) {
    await metadata.updateOne(
      {
        _id: STORY_SEED_META_ID,
      },
      {
        $set: {
          initialized: true,
          initializedAt: new Date(),
        },
      },
      {
        upsert: true,
      }
    );

    return;
  }

  // Dùng insertOne với _id cố định để giành
  // quyền khởi tạo giữa các request đồng thời.
  try {
    await metadata.insertOne({
      _id: STORY_SEED_META_ID,
      initialized: false,
      initializedAt: new Date(),
    });
  } catch (error) {
    // Nếu request khác đang khởi tạo, không
    // tự thêm dữ liệu trùng.
    //
    // Lỗi khác vẫn phải được xử lý.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return;
    }

    throw error;
  }

  try {
    const initialStories =
      buildInitialStories();

    if (initialStories.length > 0) {
      await stories.insertMany(
        initialStories,
        {
          ordered: true,
        }
      );
    }

    await metadata.updateOne(
      {
        _id: STORY_SEED_META_ID,
      },
      {
        $set: {
          initialized: true,
        },
      }
    );
  } catch (error) {
    // Không báo đã khởi tạo thành công
    // nếu bước chèn dữ liệu bị lỗi.
    //
    // Chỉ xóa metadata khi collection
    // vẫn chưa có bất kỳ story nào.
    const currentCount =
      await stories.countDocuments(
        {},
        { limit: 1 }
      );

    if (currentCount === 0) {
      await metadata.deleteOne({
        _id: STORY_SEED_META_ID,
        initialized: false,
      });
    }

    throw error;
  }
}

// ======================================================
// GET ALL STORIES
// ======================================================

// Admin sử dụng hàm này để xem tất cả
// cột mốc, bao gồm cả những cột mốc đã ẩn.
export async function getAllWeddingStories():
  Promise<WeddingStory[]> {
  await ensureStoriesInitialized();

  const collection =
    await getStoriesCollection();

  const documents = await collection
    .find({})
    .sort({
      sortOrder: 1,
      createdAt: 1,
      _id: 1,
    })
    .toArray();

  return documents.map(
    serializeWeddingStory
  );
}

// ======================================================
// GET PUBLIC STORIES
// ======================================================

// Website thiệp cưới chỉ hiển thị
// các cột mốc đang bật isVisible=true.
export async function getPublicWeddingStories():
  Promise<WeddingStory[]> {
  await ensureStoriesInitialized();

  const collection =
    await getStoriesCollection();

  const documents = await collection
    .find({
      isVisible: true,
    })
    .sort({
      sortOrder: 1,
      createdAt: 1,
      _id: 1,
    })
    .toArray();

  return documents.map(
    serializeWeddingStory
  );
}
