"use client";

import { useEffect, useState } from "react";
import { Mail, ShieldCheck, User } from "lucide-react";

type Admin = {
  _id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  isActive: boolean;
};

export default function ProfilePage() {
  const [admin, setAdmin] =
    useState<Admin | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch(
          "/api/auth/me",
        );

        if (!response.ok) return;

        const result = await response.json();

        if (result.success) {
          setAdmin(result.data);
        }
      } catch (error) {
        console.error(
          "Load profile error:",
          error,
        );
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Unable to load profile.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Profile
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Manage your account information.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-xl font-bold text-white">
            {admin.name
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {admin.name}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {admin.email}
            </p>
          </div>
        </div>

        <div className="grid gap-4 pt-6 sm:grid-cols-3">
          <ProfileItem
            icon={
              <User className="h-4 w-4" />
            }
            label="Name"
            value={admin.name}
          />

          <ProfileItem
            icon={
              <Mail className="h-4 w-4" />
            }
            label="Email"
            value={admin.email}
          />

          <ProfileItem
            icon={
              <ShieldCheck className="h-4 w-4" />
            }
            label="Role"
            value={admin.role}
          />
        </div>
      </div>
    </div>
  );
}

function ProfileItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}

        <span className="text-xs font-medium">
          {label}
        </span>
      </div>

      <p className="mt-2 truncate text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}