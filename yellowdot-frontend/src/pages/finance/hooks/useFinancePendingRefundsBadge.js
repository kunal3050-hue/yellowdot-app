/**
 * useFinancePendingRefundsBadge — count of refunds in "Requested" status,
 * for the FinanceSubNav's Refunds tab badge. Only meaningful for users who
 * can actually approve (finance-refund-approval) — the caller is
 * responsible for that RBAC check, this hook just fetches the count.
 * Cheap, short-poll-free: fetches once on mount, matching how other
 * lightweight badge counts in this app behave (e.g. notification bell).
 */
import { useEffect, useState } from "react";
import financeApi from "../../../services/financeApi";

export default function useFinancePendingRefundsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    financeApi.refunds.list({ status: "Requested" })
      .then(data => { if (!cancelled) setCount(data.refunds?.length || 0); })
      .catch(() => { if (!cancelled) setCount(0); });
    return () => { cancelled = true; };
  }, []);

  return count;
}
