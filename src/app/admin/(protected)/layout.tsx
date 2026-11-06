
import { Suspense, type ReactNode } from "react";

import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import {
  getAdminCollection,
  getCurrentAdmin,
} from "@/lib/admin-auth";

import AdminShell from "./admin-shell";

// ======================================================
// NAM & THU - PROTECTED ADMIN LAYOUT
// ======================================================

interface AdminLayoutProps {
  children: ReactNode;
}

interface HeaderProfile {
  fullName: string;
  avatarDataUrl: string | null;
}

interface StoredProfileFields {
  fullName?: string;
  avatarDataUrl?: string | null;
}

// ======================================================
// TẢI THÔNG TIN HỒ SƠ
// ======================================================

async function getHeaderProfile(
  adminId: string
): Promise<HeaderProfile> {
  if (!ObjectId.isValid(adminId)) {
    return {
      fullName: "",
      avatarDataUrl: null,
    };
  }

  const collection = await getAdminCollection();

  const document = await collection.findOne(
    {
      _id: new ObjectId(adminId),
    },
    {
      projection: {
        fullName: 1,
        avatarDataUrl: 1,
      },
    }
  );

  const profile = document as
    | (StoredProfileFields & {
        _id: ObjectId;
      })
    | null;

  const fullName =
    typeof profile?.fullName === "string"
      ? profile.fullName
      : "";

  const avatarDataUrl =
    typeof profile?.avatarDataUrl === "string" &&
    /^data:image\/(jpeg|png|webp);base64,/.test(
      profile.avatarDataUrl
    )
      ? profile.avatarDataUrl
      : null;

  return {
    fullName,
    avatarDataUrl,
  };
}

// ======================================================
// ACCESS GATE
// ======================================================

async function AdminAccessGate({
  children,
}: AdminLayoutProps) {
  await connection();

  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const profile = await getHeaderProfile(
    admin.id
  );

  return (
    <AdminShell
      admin={{
        id: admin.id,
        username: admin.username,
        role: admin.role,
        side: admin.side,
        fullName: profile.fullName,
        avatarDataUrl: profile.avatarDataUrl,
      }}
    >
      {children}
    </AdminShell>
  );
}

// ======================================================
// LOADING
// ======================================================

function AdminLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9F8EE] px-4">
      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-[3px] border-[#E4E8E5] border-t-[#31566B]"
        />

        <p className="text-sm text-[#61726D]">
          Đang tải hệ thống quản trị...
        </p>
      </div>
    </div>
  );
}

// ======================================================
// ROOT LAYOUT
// ======================================================

export default function ProtectedAdminLayout({
  children,
}: AdminLayoutProps) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminAccessGate>
        {children}
      </AdminAccessGate>
    </Suspense>
  );
}
