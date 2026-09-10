"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { ClassMultiSelect, type ClassMultiSelectOption } from "@/components/forms/ClassMultiSelect";
import { cn } from "@/lib/utils";
import type { StudentAccount } from "../types";
import { StatusBadge } from "./StatusBadge";

const SUSPENSION_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Chưa cài date-fns (xem package.json) nên tính tay: số ngày còn lại trước
 * khi cron job xóa vĩnh viễn = 30 - số ngày đã trôi qua kể từ suspendedAt. */
function daysUntilDeletion(suspendedAt: Date): number {
  const elapsedDays = Math.floor((Date.now() - suspendedAt.getTime()) / DAY_MS);
  return Math.max(0, SUSPENSION_GRACE_DAYS - elapsedDays);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("vi-VN");
}

/** studentPhone/parentPhone nullable — tài khoản đăng ký qua Google chưa
 * hoàn tất hồ sơ có thể chưa có giá trị (xem callbacks.signIn trong auth.ts). */
function formatPhone(phone: string | null): string {
  return phone ?? "—";
}

const actionButtonClass =
  "rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors";

interface AccountActionHandlers {
  onApprove: (id: string, classIds: string[]) => void;
  onUpdateClasses: (id: string, classIds: string[]) => void;
  onReject: (account: StudentAccount) => void;
  onSuspend: (account: StudentAccount) => void;
  onReactivate: (id: string) => void;
  onResetPassword: (account: StudentAccount) => void;
}

interface AccountsTableProps extends AccountActionHandlers {
  accounts: StudentAccount[];
  classes: ClassMultiSelectOption[];
  /** id account đang có server action chạy dở, hoặc null nếu không có. */
  pendingId: string | null;
}

type ClassDialogState = {
  account: StudentAccount;
  mode: "approve" | "update";
};

export function AccountsTable({
  accounts,
  classes,
  pendingId,
  onApprove,
  onUpdateClasses,
  onReject,
  onSuspend,
  onReactivate,
  onResetPassword,
}: AccountsTableProps) {
  const [classDialog, setClassDialog] = useState<ClassDialogState | null>(null);

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-navy-200/60 bg-white/60 py-16 text-center text-sm text-navy-300">
        Không tìm thấy tài khoản nào phù hợp.
      </div>
    );
  }

  const actionProps = {
    onReject,
    onSuspend,
    onReactivate,
    onResetPassword,
    onOpenClassDialog: (account: StudentAccount, mode: ClassDialogState["mode"]) => setClassDialog({ account, mode }),
  };

  return (
    <>
      {/* Bảng ngang — chỉ hiện từ md trở lên, dưới md chuyển sang card ở khối
          bên dưới thay vì để table tràn ngang màn hình. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-navy-100 bg-white md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-xs font-semibold tracking-wide text-navy-300 uppercase">
              <th className="px-4 py-3">Họ tên</th>
              <th className="px-4 py-3">Mã HS (STT)</th>
              <th className="px-4 py-3">SĐT học sinh</th>
              <th className="px-4 py-3">SĐT phụ huynh</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Ngày đăng ký</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-b border-navy-100/60 last:border-0">
                <td className="px-4 py-3.5 font-medium text-navy-500">{account.name}</td>
                <td className="px-4 py-3.5 font-semibold text-navy-500">{account.studentCode ?? "Chờ duyệt"}</td>
                <td className="px-4 py-3.5 text-navy-400">{formatPhone(account.studentPhone)}</td>
                <td className="px-4 py-3.5 text-navy-400">{formatPhone(account.parentPhone)}</td>
                <td className="px-4 py-3.5 text-navy-400">{account.email}</td>
                <td className="px-4 py-3.5 text-navy-400">{formatDate(account.createdAt)}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={account.status} />
                  {account.status === "SUSPENDED" && account.suspendedAt && (
                    <p className="mt-1 text-xs text-red-400">
                      Còn {daysUntilDeletion(account.suspendedAt)} ngày trước khi xóa
                    </p>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-2"><Link href={`/admin/hoc-sinh/${account.id}/ket-qua`} className={`${actionButtonClass} border border-navy-200 text-navy-500`}>Xem kết quả</Link><AccountActions account={account} isPending={pendingId === account.id} {...actionProps} /></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Card xếp dọc — dưới md */}
      <div className="flex flex-col gap-3 md:hidden">
        {accounts.map((account) => (
          <div key={account.id} className="rounded-2xl border border-navy-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-navy-500">{account.name}</p>
                <p className="text-xs text-navy-300">{account.studentCode ? `Mã HS ${account.studentCode}` : "Chờ cấp mã khi duyệt"} · {account.email}</p>
              </div>
              <StatusBadge status={account.status} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-navy-300">SĐT học sinh</dt>
              <dd className="text-navy-500">{formatPhone(account.studentPhone)}</dd>
              <dt className="text-navy-300">SĐT phụ huynh</dt>
              <dd className="text-navy-500">{formatPhone(account.parentPhone)}</dd>
              <dt className="text-navy-300">Ngày đăng ký</dt>
              <dd className="text-navy-500">{formatDate(account.createdAt)}</dd>
            </dl>

            {account.status === "SUSPENDED" && account.suspendedAt && (
              <p className="mt-2 text-xs text-red-400">
                Còn {daysUntilDeletion(account.suspendedAt)} ngày trước khi xóa
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 border-t border-navy-100 pt-3">
              <Link href={`/admin/hoc-sinh/${account.id}/ket-qua`} className={`${actionButtonClass} border border-navy-200 text-navy-500`}>Xem kết quả</Link>
              <AccountActions
                account={account}
                isPending={pendingId === account.id}
                {...actionProps}
              />
            </div>
          </div>
        ))}
      </div>

      <ClassAssignmentDialog
        state={classDialog}
        classes={classes}
        pending={Boolean(classDialog && pendingId === classDialog.account.id)}
        onCancel={() => setClassDialog(null)}
        onSubmit={(account, mode, classIds) => {
          if (mode === "approve") onApprove(account.id, classIds);
          else onUpdateClasses(account.id, classIds);
          setClassDialog(null);
        }}
      />
    </>
  );
}

function AccountActions({
  account,
  isPending,
  onReject,
  onSuspend,
  onReactivate,
  onResetPassword,
  onOpenClassDialog,
}: Omit<AccountActionHandlers, "onApprove" | "onUpdateClasses"> & {
  account: StudentAccount;
  isPending: boolean;
  onOpenClassDialog: (account: StudentAccount, mode: ClassDialogState["mode"]) => void;
}) {
  const spinner = <Loader2 className="size-3.5 animate-spin" aria-hidden />;

  if (account.status === "PENDING") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenClassDialog(account, "approve")}
          disabled={isPending}
          className={cn(
            actionButtonClass,
            "inline-flex items-center gap-1.5 bg-green-600 text-white hover:bg-green-700 disabled:pointer-events-none disabled:opacity-60",
          )}
        >
          {isPending && spinner}
          Duyệt & xếp lớp
        </button>
        <button
          type="button"
          onClick={() => onReject(account)}
          disabled={isPending}
          className={cn(
            actionButtonClass,
            "inline-flex items-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-60",
          )}
        >
          {isPending && spinner}
          Từ chối
        </button>
      </div>
    );
  }

  if (account.status === "ACTIVE") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenClassDialog(account, "update")}
          disabled={isPending}
          className={cn(actionButtonClass, "inline-flex items-center gap-1.5 border border-navy-200 text-navy-500 hover:bg-pastel-100 disabled:opacity-60")}
        >
          {isPending && spinner}
          Xếp lớp{account.classIds.length ? ` (${account.classIds.length})` : ""}
        </button>
        <button
          type="button"
          onClick={() => onResetPassword(account)}
          disabled={isPending}
          className={cn(
            actionButtonClass,
            "inline-flex items-center gap-1.5 border border-navy-200 text-navy-500 hover:bg-pastel-100 disabled:pointer-events-none disabled:opacity-60",
          )}
        >
          {isPending && spinner}
          Đặt lại MK
        </button>
        <button
          type="button"
          onClick={() => onSuspend(account)}
          disabled={isPending}
          className={cn(
            actionButtonClass,
            "inline-flex items-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-60",
          )}
        >
          {isPending && spinner}
          Thu hồi quyền
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onReactivate(account.id)}
      disabled={isPending}
      className={cn(
        actionButtonClass,
        "inline-flex items-center gap-1.5 bg-green-600 text-white hover:bg-green-700 disabled:pointer-events-none disabled:opacity-60",
      )}
    >
      {isPending && spinner}
      Kích hoạt lại
    </button>
  );
}

function ClassAssignmentDialog({
  state,
  classes,
  pending,
  onCancel,
  onSubmit,
}: {
  state: ClassDialogState | null;
  classes: ClassMultiSelectOption[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (account: StudentAccount, mode: ClassDialogState["mode"], classIds: string[]) => void;
}) {
  useEffect(() => {
    if (!state) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, pending, state]);

  if (!state) return null;
  const { account, mode } = state;

  return (
    <div onClick={() => !pending && onCancel()} className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-900/45 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="class-assignment-title" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-navy-100 bg-white p-5 shadow-2xl sm:p-6">
        <h2 id="class-assignment-title" className="text-lg font-semibold text-navy-600">
          {mode === "approve" ? "Duyệt và xếp lớp" : "Xếp lớp học"}
        </h2>
        <p className="mt-1 text-sm text-navy-400">
          {account.name} · Mã HS {account.studentCode ?? "sẽ được cấp khi duyệt"}
        </p>

        <form
          key={`${mode}-${account.id}`}
          action={(formData) => onSubmit(
            account,
            mode,
            formData.getAll("classIds").filter((value): value is string => typeof value === "string"),
          )}
          className="mt-5"
        >
          <ClassMultiSelect classes={classes} defaultSelected={account.classIds} label="Chọn lớp học" />
          <p className="mt-3 text-sm text-navy-300">
            Hiện tại: {account.classNames.join(", ") || "Chưa xếp lớp"}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onCancel} disabled={pending} className="rounded-full bg-gray-100 px-5 py-2.5 text-sm font-medium text-navy-500 hover:bg-gray-200 disabled:opacity-60">
              Hủy
            </button>
            <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-60">
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {mode === "approve" ? "Duyệt học sinh" : "Lưu lớp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
