import mongoose from "mongoose";
import Payment from "@/models/Payment";

export const SIGNED_AMOUNT = {
  $cond: [
    { $eq: ["$type", "REFUND"] },
    { $multiply: ["$amount", -1] },
    "$amount",
  ],
};

export const signed = (p: { amount: number; type?: string }) =>
  p.type === "REFUND" ? -p.amount : p.amount;

export async function netPaidBySale(
  saleIds?: mongoose.Types.ObjectId[],
  session?: mongoose.ClientSession,
) {
  let query = Payment.aggregate([
    ...(saleIds ? [{ $match: { saleId: { $in: saleIds } } }] : []),
    { $group: { _id: "$saleId", total: { $sum: SIGNED_AMOUNT } } },
  ]);

  if (session) query = query.session(session);

  const rows = await query;

  return new Map<string, number>(
    rows.map((r: any) => [String(r._id), Number(r.total || 0)]),
  );
}