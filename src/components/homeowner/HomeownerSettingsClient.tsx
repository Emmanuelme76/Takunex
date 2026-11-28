"use client";

import { useState, useTransition } from "react";
import { logoutUser } from "@/actions/auth.actions";
import {
  softDeleteHomeownerAccountAction,
  updateHomeownerPasswordAction,
} from "@/actions/homeowner.actions";

interface HomeownerSettingsClientProps {
  email: string;
  role: string;
  createdAtLabel: string;
}

export function HomeownerSettingsClient({
  email,
  role,
  createdAtLabel,
}: HomeownerSettingsClientProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [isUpdatingPass, startUpdatingPass] = useTransition();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    startUpdatingPass(async () => {
      const res = await updateHomeownerPasswordAction({
        newPassword,
        confirmPassword,
      });

      if (!res.ok) {
        setPasswordMsg({ type: "err", text: res.error });
      } else {
        setPasswordMsg({
          type: "ok",
          text: res.message ?? "Password updated.",
        });
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  };

  const handleSignOut = async () => {
    await logoutUser();
    window.location.href = "/login";
  };

  const handleSoftDelete = () => {
    setDeleteError(null);
    startDeleting(async () => {
      const res = await softDeleteHomeownerAccountAction();
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }
      await logoutUser();
      window.location.href = "/login";
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-tx-black">
          Account Settings
        </h1>
        <p className="text-sm text-tx-gray-dark">
          Manage your security credentials, session, and account status.
        </p>
      </div>

      {/* Resumen de cuenta */}
      <section className="rounded-2xl bg-white p-6 shadow-xs">
        <h2 className="text-base font-bold text-tx-black">Account Overview</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
          <div className="rounded-xl bg-tx-canvas/70 p-3.5">
            <p className="font-semibold text-tx-gray-dark">Signed-in Email</p>
            <p className="mt-1 font-bold text-tx-ink">{email}</p>
          </div>
          <div className="rounded-xl bg-tx-canvas/70 p-3.5">
            <p className="font-semibold text-tx-gray-dark">Active Role</p>
            <p className="mt-1 font-bold text-tx-navy">{role}</p>
          </div>
          <div className="rounded-xl bg-tx-canvas/70 p-3.5">
            <p className="font-semibold text-tx-gray-dark">Member Since</p>
            <p className="mt-1 font-bold text-tx-ink">{createdAtLabel}</p>
          </div>
        </div>
      </section>

      {/* Cambio de Contraseña */}
      <form
        onSubmit={handlePasswordSubmit}
        className="space-y-4 rounded-2xl bg-white p-6 shadow-xs"
      >
        <h2 className="text-base font-bold text-tx-black">Change Password</h2>

        {passwordMsg && (
          <div
            className={`rounded-xl px-4 py-3 text-xs font-medium ${
              passwordMsg.type === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {passwordMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="newPassword"
              className="block text-xs font-semibold text-tx-ink"
            >
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-xs font-semibold text-tx-ink"
            >
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className="mt-1.5 w-full rounded-xl border border-tx-gray-light px-3.5 py-2.5 text-sm text-tx-black focus:border-tx-sky focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isUpdatingPass}
            className="rounded-full bg-tx-sky px-6 py-2.5 text-sm font-bold text-white transition hover:bg-tx-teal disabled:opacity-60 cursor-pointer"
          >
            {isUpdatingPass ? "Updating..." : "Update Password"}
          </button>
        </div>
      </form>

      {/* Sesión y Desactivación (Soft Delete) */}
      <section className="space-y-4 rounded-2xl border border-red-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-tx-canvas pb-4">
          <div>
            <h2 className="text-base font-bold text-tx-black">Sign Out</h2>
            <p className="text-xs text-tx-gray-dark">
              End your current session on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-tx-navy px-5 py-2 text-xs font-bold text-tx-navy transition hover:bg-tx-navy hover:text-white cursor-pointer"
          >
            Log Out
          </button>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <h3 className="text-sm font-bold text-red-700">
              Deactivate Account
            </h3>
            <p className="text-xs text-tx-gray-dark">
              Your account will be deactivated (Soft Delete) while preserving
              order and transaction audit records.
            </p>
          </div>

          {deleteError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {deleteError}
            </p>
          )}

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 cursor-pointer"
            >
              Deactivate My Account
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-red-50 p-3.5">
              <p className="text-xs font-semibold text-red-800">
                Are you sure? You will be signed out immediately.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-tx-gray-light bg-white px-3 py-1.5 text-xs font-medium text-tx-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleSoftDelete}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting ? "Deactivating..." : "Confirm Deactivation"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}