"use client";

/** Stop waiting for an unconfirmed server action. The server may still commit;
 * callers reconcile and lifecycle/version guards make a later retry safe.
 */
export const withActionTimeout = async <Result>(action: () => Promise<Result>, timeoutMs = 8000): Promise<Result> => {
  let timer: number | undefined;
  try {
    return await Promise.race([action(), new Promise<never>((_resolve, reject) => {
      timer = window.setTimeout(() => reject(new Error("Action was not confirmed")), timeoutMs);
    })]);
  } finally { window.clearTimeout(timer); }
};
