"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  approveAccount,
  reactivateAccount,
  rejectAccount,
  resetStudentPassword,
  revokeAccount,
} from "../actions";
import type { AccountFilter, StudentAccount } from "../types";
import { AccountFilterTabs } from "./AccountFilterTabs";
import { AccountsTable } from "./AccountsTable";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

type PendingAction =
  | { type: "reject"; account: StudentAccount }
  | { type: "suspend"; account: StudentAccount };

type ActionResult = { success: boolean; error?: string };

export function AccountsPage({
  initialAccounts,
}: {
  initialAccounts: StudentAccount[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<StudentAccount[]>(initialAccounts);
  const [filter, setFilter] = useState<AccountFilter>("ALL");
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [resetResult, setResetResult] = useState<{
    accountName: string;
    temporaryPassword: string;
  }>();
  const [, startTransition] = useTransition();
  // id của account đang có action chạy dở — cho phép chỉ disable/hiện loading
  // đúng NÚT đó thay vì khoá cả bảng, đồng thời chặn double-click trên chính
  // nút đó (useTransition dùng để bọc action, không cần isPending riêng vì
  // đã có state chi tiết hơn ở đây).
  const [pendingId, setPendingId] = useState<string | null>(null);

  const counts = useMemo<Record<AccountFilter, number>>(
    () => ({
      ALL: accounts.length,
      PENDING: accounts.filter((a) => a.status === "PENDING").length,
      ACTIVE: accounts.filter((a) => a.status === "ACTIVE").length,
      SUSPENDED: accounts.filter((a) => a.status === "SUSPENDED").length,
    }),
    [accounts],
  );

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (filter !== "ALL" && account.status !== filter) return false;
      if (!term) return true;
      return (
        account.name.toLowerCase().includes(term) ||
        Boolean(account.studentCode?.toLowerCase().includes(term)) ||
        Boolean(account.studentPhone?.includes(term)) ||
        Boolean(account.parentPhone?.includes(term)) ||
        account.email.toLowerCase().includes(term)
      );
    });
  }, [accounts, filter, search]);

  /**
   * Chạy 1 server action cho đúng 1 account — KHÔNG đổi `accounts` state
   * trước khi biết kết quả (đặc biệt quan trọng với revoke: admin phải thấy
   * đúng những gì đã thật sự xảy ra, không phải UI "đoán trước"). Chỉ khi
   * `result.success` mới gọi `onSuccess` để cập nhật state + refresh lại từ
   * server cho đồng bộ tuyệt đối.
   */
  function runAction(
    id: string,
    action: () => Promise<ActionResult>,
    onSuccess: () => void,
  ) {
    setErrorMessage(undefined);
    setPendingId(id);
    startTransition(async () => {
      const result = await action();
      setPendingId(null);

      if (!result.success) {
        setErrorMessage(result.error ?? "Đã có lỗi xảy ra, vui lòng thử lại.");
        return;
      }

      onSuccess();
      router.refresh();
    });
  }

  function handleApprove(id: string) {
    runAction(id, () => approveAccount(id), () => {
      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "ACTIVE" } : a)),
      );
    });
  }

  function handleReactivate(id: string) {
    runAction(id, () => reactivateAccount(id), () => {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: "ACTIVE", suspendedAt: null } : a,
        ),
      );
    });
  }

  function handleResetPassword(account: StudentAccount) {
    setErrorMessage(undefined);
    setPendingId(account.id);
    startTransition(async () => {
      const result = await resetStudentPassword(account.id);
      setPendingId(null);
      if (!result.success) {
        setErrorMessage(result.error);
        return;
      }
      setResetResult({
        accountName: account.name,
        temporaryPassword: result.temporaryPassword,
      });
    });
  }

  function handleConfirmPendingAction() {
    if (!pendingAction) return;
    const { type, account } = pendingAction;
    setPendingAction(null);

    if (type === "reject") {
      runAction(account.id, () => rejectAccount(account.id), () => {
        setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      });
    } else {
      runAction(account.id, () => revokeAccount(account.id), () => {
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === account.id
              ? { ...a, status: "SUSPENDED", suspendedAt: new Date() }
              : a,
          ),
        );
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-600">Quản lý học sinh</h1>
        <p className="mt-1 text-sm text-navy-300">
          Duyệt tài khoản đăng ký mới, thu hồi hoặc kích hoạt lại quyền truy cập.
        </p>
      </div>

      {errorMessage && (
        <p className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <AccountFilterTabs value={filter} onChange={setFilter} counts={counts} />

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-navy-300"
          aria-hidden
        />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo mã, tên, số điện thoại hoặc email..."
          className="w-full rounded-full border border-navy-100 bg-white py-2.5 pr-4 pl-10 text-sm text-navy-500 placeholder:text-navy-300 outline-none transition-colors focus:border-navy-400"
        />
      </div>

      <AccountsTable
        accounts={filteredAccounts}
        pendingId={pendingId}
        onApprove={handleApprove}
        onReject={(account) => setPendingAction({ type: "reject", account })}
        onSuspend={(account) => setPendingAction({ type: "suspend", account })}
        onReactivate={handleReactivate}
        onResetPassword={handleResetPassword}
      />

      {resetResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="temporary-password-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/45 px-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2
              id="temporary-password-title"
              className="text-lg font-semibold text-navy-600"
            >
              Mật khẩu tạm của {resetResult.accountName}
            </h2>
            <p className="mt-2 text-sm text-navy-400">
              Sao chép và gửi riêng cho học sinh. Mật khẩu này chỉ hiện ở đây
              một lần; học sinh sẽ phải đổi ngay sau khi đăng nhập.
            </p>
            <code className="mt-4 block select-all rounded-2xl bg-pastel-100 px-4 py-3 text-center text-lg font-semibold tracking-wider text-navy-600">
              {resetResult.temporaryPassword}
            </code>
            <button
              type="button"
              onClick={() => setResetResult(undefined)}
              className="mt-5 w-full rounded-full bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Tôi đã lưu mật khẩu
            </button>
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={pendingAction !== null}
        title={
          pendingAction?.type === "reject"
            ? "Từ chối tài khoản đăng ký?"
            : "Thu hồi quyền tài khoản?"
        }
        description={
          pendingAction?.type === "reject"
            ? `Tài khoản của ${pendingAction.account.name} sẽ bị xóa khỏi danh sách chờ duyệt và không thể khôi phục.`
            : pendingAction
              ? `${pendingAction.account.name} sẽ không thể đăng nhập. Tài khoản sẽ tự động bị xóa sau 30 ngày nếu không được kích hoạt lại.`
              : ""
        }
        confirmLabel={pendingAction?.type === "reject" ? "Từ chối" : "Thu hồi quyền"}
        onConfirm={handleConfirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
