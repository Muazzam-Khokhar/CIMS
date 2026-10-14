import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/mongodb";
import { createAuditLog } from "@/lib/audit";
import { getPaginationParams } from "@/lib/pagination";

import Partner from "@/models/Partner";
import Loan from "@/models/Loan";
import FinanceTransaction from "@/models/FinanceTransaction";

import type { AuditAction, AuditEntity } from "@/models/AuditLog";

type AuditActor = {
  userId: string;
  name?: string;
  role: "OWNER" | "MANAGER" | "STAFF";
};

type RequestBody = Record<string, unknown>;

type TransactionType =
  | "PARTNER_CONTRIBUTION"
  | "PARTNER_CAPITAL_RETURN"
  | "PARTNER_DRAWING"
  | "LOAN_RECEIVED"
  | "LOAN_PRINCIPAL_REPAYMENT"
  | "PARTNER_ADVANCE_GIVEN"
  | "PARTNER_ADVANCE_REPAID"
  | "BUSINESS_ADVANCE_GIVEN"
  | "BUSINESS_ADVANCE_SETTLED";

type LoanDirection = "BUSINESS_BORROWED" | "PARTNER_ADVANCE";

const PAYMENT_METHODS = ["CASH", "BANK", "ONLINE", "OTHER"];

const OPENING_TRANSACTION_TYPES: TransactionType[] = [
  "LOAN_RECEIVED",
  "PARTNER_ADVANCE_GIVEN",
];

const MANUAL_TRANSACTION_TYPES: TransactionType[] = [
  "PARTNER_CONTRIBUTION",
  "PARTNER_CAPITAL_RETURN",
  "PARTNER_DRAWING",
  "LOAN_PRINCIPAL_REPAYMENT",
  "PARTNER_ADVANCE_REPAID",
  "BUSINESS_ADVANCE_GIVEN",
  "BUSINESS_ADVANCE_SETTLED",
];

const REPAID_TYPES: TransactionType[] = [
  "LOAN_PRINCIPAL_REPAYMENT",
  "PARTNER_ADVANCE_REPAID",
];

class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function fail(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.status },
    );
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 11000
  ) {
    return NextResponse.json(
      { success: false, message: "A duplicate record exists." },
      { status: 409 },
    );
  }

  console.error(fallback, error);

  return NextResponse.json(
    { success: false, message: fallback },
    { status: 500 },
  );
}

function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    mongoose.isValidObjectId(value)
  );
}

function validAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function plain<T>(document: T): T {
  if (
    document &&
    typeof document === "object" &&
    "toObject" in document &&
    typeof document.toObject === "function"
  ) {
    return document.toObject() as T;
  }

  return document;
}

async function audit(
  actor: AuditActor,
  action: "CREATE" | "UPDATE" | "DELETE",
  entity: "PARTNER" | "LOAN" | "FINANCE_TRANSACTION",
  entityId: string,
  description: string,
  before?: Record<string, unknown> | null,
  after?: Record<string, unknown> | null,
  session?: mongoose.ClientSession,
) {
  await createAuditLog({
    actor,
    action: action as AuditAction,
    entity: entity as AuditEntity,
    entityId,
    description,
    before: before ?? undefined,
    after: after ?? undefined,
    session,
  });
}

function getMethod(value: unknown) {
  if (
    typeof value !== "string" ||
    !PAYMENT_METHODS.includes(value)
  ) {
    throw new HttpError("Invalid payment method.");
  }

  return value;
}

function getTransactionType(value: unknown): TransactionType {
  const allTypes: TransactionType[] = [
    ...MANUAL_TRANSACTION_TYPES,
    ...OPENING_TRANSACTION_TYPES,
  ];

  if (
    typeof value !== "string" ||
    !allTypes.includes(value as TransactionType)
  ) {
    throw new HttpError("Invalid finance transaction type.");
  }

  return value as TransactionType;
}

function getAuditSnapshot(document: any): Record<string, unknown> {
  return JSON.parse(JSON.stringify(plain(document)));
}

/* =========================================================
   PARTNER HELPERS
========================================================= */

async function getPartnerCapitalTotals(
  partnerId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession,
  excludeTransactionId?: mongoose.Types.ObjectId,
) {
  const match: Record<string, unknown> = {
    partnerId,
    status: "VALID",
    type: {
      $in: [
        "PARTNER_CONTRIBUTION",
        "PARTNER_CAPITAL_RETURN",
      ],
    },
  };

  if (excludeTransactionId) {
    match._id = { $ne: excludeTransactionId };
  }

  let query = FinanceTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$type",
        total: { $sum: "$amount" },
      },
    },
  ]);

  if (session) query = query.session(session);

  const rows = await query;

  const totals = new Map<string, number>(
    rows.map((row: any) => [row._id, row.total]),
  );

  return {
    contributed: totals.get("PARTNER_CONTRIBUTION") || 0,
    returned: totals.get("PARTNER_CAPITAL_RETURN") || 0,
  };
}

async function getPartnerFinancialSummary(
  partnerIds: mongoose.Types.ObjectId[],
) {
  const output = new Map<
    string,
    {
      totalContributed: number;
      capitalReturned: number;
      netCapital: number;
    }
  >();

  if (partnerIds.length === 0) return output;

  const rows = await FinanceTransaction.aggregate([
    {
      $match: {
        partnerId: { $in: partnerIds },
        status: "VALID",
        type: {
          $in: [
            "PARTNER_CONTRIBUTION",
            "PARTNER_CAPITAL_RETURN",
          ],
        },
      },
    },
    {
      $group: {
        _id: { partnerId: "$partnerId", type: "$type" },
        amount: { $sum: "$amount" },
      },
    },
  ]);

  for (const row of rows) {
    const id = String(row._id.partnerId);

    const summary = output.get(id) || {
      totalContributed: 0,
      capitalReturned: 0,
      netCapital: 0,
    };

    if (row._id.type === "PARTNER_CONTRIBUTION") {
      summary.totalContributed = row.amount;
    } else if (row._id.type === "PARTNER_CAPITAL_RETURN") {
      summary.capitalReturned = row.amount;
    }

    summary.netCapital =
      summary.totalContributed - summary.capitalReturned;

    output.set(id, summary);
  }

  return output;
}

/* =========================================================
   PARTNERS: GET LIST
========================================================= */

export async function getPartners(
  searchParams: URLSearchParams,
) {
  try {
    await connectDB();

    const { page, limit, skip } =
      getPaginationParams(searchParams);

    const search = (searchParams.get("search") || "").trim();

    const filter: Record<string, unknown> = {};

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");

      filter.$or = [
        { name: regex },
        { phone: regex },
        { email: regex },
      ];
    }

    const [partners, totalCount] = await Promise.all([
      Partner.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Partner.countDocuments(filter),
    ]);

    const summaries = await getPartnerFinancialSummary(
      partners.map((partner: any) => partner._id),
    );

    const data = partners.map((partner: any) => ({
      ...partner,
      financialSummary: summaries.get(String(partner._id)) || {
        totalContributed: 0,
        capitalReturned: 0,
        netCapital: 0,
      },
    }));

    return NextResponse.json({
      success: true,
      data,
      page,
      limit,
      totalCount,
      hasMore: skip + data.length < totalCount,
    });
  } catch (error) {
    return fail(error, "Failed to fetch partners");
  }
}

/* =========================================================
   PARTNERS: CREATE
========================================================= */

export async function createPartner(
  body: RequestBody,
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      throw new HttpError("Partner name is required.");
    }

    if (
      body.email !== undefined &&
      typeof body.email !== "string"
    ) {
      throw new HttpError("Invalid email.");
    }

    if (
      body.phone !== undefined &&
      typeof body.phone !== "string"
    ) {
      throw new HttpError("Invalid phone number.");
    }

    let created: any;

    await session.withTransaction(async () => {
      const [partner] = await Partner.create(
        [
          {
            name,
            phone: String(body.phone || "").trim(),
            email: String(body.email || "")
              .trim()
              .toLowerCase(),
            notes: String(body.notes || "").trim(),
          },
        ],
        { session },
      );

      created = partner;

      await audit(
        actor,
        "CREATE",
        "PARTNER",
        String(partner._id),
        `Partner "${name}" created`,
        null,
        getAuditSnapshot(partner),
        session,
      );
    });

    return NextResponse.json(
      { success: true, data: created },
      { status: 201 },
    );
  } catch (error) {
    return fail(error, "Failed to create partner");
  } finally {
    await session.endSession();
  }
}

/* =========================================================
   PARTNERS: GET ONE
========================================================= */

export async function getPartner(id: string) {
  try {
    await connectDB();

    if (!validId(id)) {
      throw new HttpError("Invalid partner ID.", 400);
    }

    const partner = await Partner.findById(id).lean();

    if (!partner) {
      throw new HttpError("Partner not found.", 404);
    }

    const summaries = await getPartnerFinancialSummary([
      partner._id,
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...partner,
        financialSummary: summaries.get(String(partner._id)) || {
          totalContributed: 0,
          capitalReturned: 0,
          netCapital: 0,
        },
      },
    });
  } catch (error) {
    return fail(error, "Failed to fetch partner");
  }
}

/* =========================================================
   PARTNERS: PATCH
========================================================= */

export async function updatePartner(
  id: string,
  body: RequestBody,
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    if (!validId(id)) {
      throw new HttpError("Invalid partner ID.", 400);
    }

    let updated: any;

    await session.withTransaction(async () => {
      const partner = await Partner.findById(id).session(session);

      if (!partner) {
        throw new HttpError("Partner not found.", 404);
      }

      const before = getAuditSnapshot(partner);

      if (body.name !== undefined) {
        if (
          typeof body.name !== "string" ||
          !body.name.trim()
        ) {
          throw new HttpError("Partner name is required.");
        }

        partner.name = body.name.trim();
      }

      if (body.phone !== undefined) {
        if (typeof body.phone !== "string") {
          throw new HttpError("Invalid phone number.");
        }

        partner.phone = body.phone.trim();
      }

      if (body.email !== undefined) {
        if (typeof body.email !== "string") {
          throw new HttpError("Invalid email.");
        }

        partner.email = body.email.trim().toLowerCase();
      }

      if (body.notes !== undefined) {
        if (typeof body.notes !== "string") {
          throw new HttpError("Invalid notes.");
        }

        partner.notes = body.notes.trim();
      }

      // Prevent arbitrary fields such as transaction balances
      // or status from being changed through this endpoint.
      await partner.save({ session });
      updated = partner;

      await audit(
        actor,
        "UPDATE",
        "PARTNER",
        String(partner._id),
        `Partner "${partner.name}" updated`,
        before,
        getAuditSnapshot(partner),
        session,
      );
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return fail(error, "Failed to update partner");
  } finally {
    await session.endSession();
  }
}

/* =========================================================
   PARTNERS: DELETE
========================================================= */

export async function deletePartner(
  id: string,
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    if (!validId(id)) {
      throw new HttpError("Invalid partner ID.", 400);
    }

    await session.withTransaction(async () => {
      const partner = await Partner.findById(id).session(session);

      if (!partner) {
        throw new HttpError("Partner not found.", 404);
      }

      const [loan, transaction] = await Promise.all([
        Loan.findOne({ partnerId: partner._id })
          .session(session)
          .lean(),

        FinanceTransaction.findOne({ partnerId: partner._id })
          .session(session)
          .lean(),
      ]);

      if (loan || transaction) {
        throw new HttpError(
          "This partner has financial history. Remove or reconcile those records before deleting the partner.",
          409,
        );
      }

      const before = getAuditSnapshot(partner);

      await partner.deleteOne({ session });

      await audit(
        actor,
        "DELETE",
        "PARTNER",
        String(partner._id),
        `Partner "${partner.name}" deleted`,
        before,
        null,
        session,
      );
    });

    return NextResponse.json({
      success: true,
      message: "Partner deleted successfully.",
    });
  } catch (error) {
    return fail(error, "Failed to delete partner");
  } finally {
    await session.endSession();
  }
}

/* =========================================================
   LOAN HELPERS
========================================================= */

async function repaymentTotal(
  loanId: mongoose.Types.ObjectId,
  direction: LoanDirection,
  session?: mongoose.ClientSession,
  excludeTransactionId?: mongoose.Types.ObjectId,
) {
  const repaymentType =
    direction === "BUSINESS_BORROWED"
      ? "LOAN_PRINCIPAL_REPAYMENT"
      : "PARTNER_ADVANCE_REPAID";

  const match: Record<string, unknown> = {
    loanId,
    type: repaymentType,
    status: "VALID",
  };

  if (excludeTransactionId) {
    match._id = { $ne: excludeTransactionId };
  }

  let query = FinanceTransaction.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  if (session) query = query.session(session);

  const result = await query;

  return Number(result[0]?.total || 0);
}

async function syncLoanStatus(
  loan: any,
  session: mongoose.ClientSession,
) {
  if (!loan || loan.status === "VOIDED") return;

  const repaid = await repaymentTotal(
    loan._id,
    loan.direction,
    session,
  );

  loan.status =
    loan.principalAmount - repaid <= 0.005
      ? "SETTLED"
      : "ACTIVE";

  await loan.save({ session });
}

function presentLoan(loan: any, totalRepaid: number) {
  const remaining = Math.max(
    0,
    Number(loan.principalAmount) - totalRepaid,
  );

  return {
    ...loan,
    totalRepaid,
    outstandingPrincipal: remaining,
    status:
      loan.status === "VOIDED"
        ? "VOIDED"
        : remaining <= 0.005
          ? "SETTLED"
          : "ACTIVE",
  };
}

/* =========================================================
   LOANS: GET LIST
========================================================= */

export async function getLoans(
  searchParams: URLSearchParams,
) {
  try {
    await connectDB();

    const { page, limit, skip } =
      getPaginationParams(searchParams);

    const search = (searchParams.get("search") || "").trim();
    const direction = searchParams.get("direction");
    const requestedStatus = searchParams.get("status");

    const filter: Record<string, unknown> = {};

    if (
      direction === "BUSINESS_BORROWED" ||
      direction === "PARTNER_ADVANCE"
    ) {
      filter.direction = direction;
    }

    if (
      requestedStatus === "ACTIVE" ||
      requestedStatus === "SETTLED" ||
      requestedStatus === "VOIDED"
    ) {
      filter.status = requestedStatus;
    }

    if (search) {
      filter.counterpartyName = {
        $regex: escapeRegex(search),
        $options: "i",
      };
    }

    const [loans, totalCount] = await Promise.all([
      Loan.find(filter)
        .populate("partnerId", "name phone email")
        .sort({ loanDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Loan.countDocuments(filter),
    ]);

    const paidValues = await Promise.all(
      loans.map((loan: any) =>
        repaymentTotal(loan._id, loan.direction),
      ),
    );

    const data = loans.map((loan: any, index: number) =>
      presentLoan(loan, paidValues[index]),
    );

    return NextResponse.json({
      success: true,
      data,
      page,
      limit,
      totalCount,
      hasMore: skip + data.length < totalCount,
    });
  } catch (error) {
    return fail(error, "Failed to fetch loans");
  }
}

/* =========================================================
   LOANS: GET ONE
========================================================= */

export async function getLoan(id: string) {
  try {
    await connectDB();

    if (!validId(id)) {
      throw new HttpError("Invalid loan ID.", 400);
    }

    const loan = await Loan.findById(id)
      .populate("partnerId", "name phone email")
      .lean();

    if (!loan) {
      throw new HttpError("Loan not found.", 404);
    }

    const paid = await repaymentTotal(
      loan._id,
      loan.direction,
    );

    const transactions = await FinanceTransaction.find({
      loanId: loan._id,
    })
      .sort({ transactionDate: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: presentLoan(loan, paid),
      transactions,
    });
  } catch (error) {
    return fail(error, "Failed to fetch loan");
  }
}

/* =========================================================
   LOANS: CREATE
   Creates the loan and opening transaction together.
========================================================= */

export async function createLoan(
  body: RequestBody,
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    const direction = body.direction as LoanDirection;
    const counterpartyType = body.counterpartyType;
    const counterpartyName =
      typeof body.counterpartyName === "string"
        ? body.counterpartyName.trim()
        : "";

    const principalAmount = body.principalAmount;
    const loanDate = parseDate(body.loanDate);
    const dueDate = body.dueDate
      ? parseDate(body.dueDate)
      : null;

    if (
      direction !== "BUSINESS_BORROWED" &&
      direction !== "PARTNER_ADVANCE"
    ) {
      throw new HttpError("Invalid loan direction.");
    }

    if (
      typeof counterpartyType !== "string" ||
      !["PARTNER", "BANK", "INDIVIDUAL", "OTHER"].includes(
        counterpartyType,
      )
    ) {
      throw new HttpError("Invalid counterparty type.");
    }

    if (!counterpartyName) {
      throw new HttpError("Lender/partner name is required.");
    }

    if (!validAmount(principalAmount)) {
      throw new HttpError(
        "Principal amount must be greater than zero.",
      );
    }

    if (!loanDate) {
      throw new HttpError("A valid loan date is required.");
    }

    if (body.dueDate && !dueDate) {
      throw new HttpError("Invalid due date.");
    }

    if (
      direction === "PARTNER_ADVANCE" &&
      counterpartyType !== "PARTNER"
    ) {
      throw new HttpError(
        "A partner advance must be issued to a registered partner.",
      );
    }

    let partnerId: mongoose.Types.ObjectId | null = null;
    let displayName = counterpartyName;

    if (counterpartyType === "PARTNER") {
      if (!validId(body.partnerId)) {
        throw new HttpError("Select a valid registered partner.");
      }

      const partner = await Partner.findById(body.partnerId);

      if (!partner) {
        throw new HttpError("Partner not found.", 404);
      }

      partnerId = partner._id;
      displayName = partner.name;
    }

    const paymentMethod = getMethod(body.paymentMethod ?? "CASH");

    let createdLoan: any;

    await session.withTransaction(async () => {
      const [loan] = await Loan.create(
        [
          {
            direction,
            counterpartyType,
            counterpartyName: displayName,
            partnerId,
            principalAmount,
            loanDate,
            dueDate,
            notes: String(body.notes || "").trim(),
            status: "ACTIVE",
          },
        ],
        { session },
      );

      const transactionType =
        direction === "BUSINESS_BORROWED"
          ? "LOAN_RECEIVED"
          : "PARTNER_ADVANCE_GIVEN";

      const [transaction] = await FinanceTransaction.create(
        [
          {
            type: transactionType,
            partnerId,
            loanId: loan._id,
            amount: principalAmount,
            transactionDate: loanDate,
            paymentMethod,
            reference: String(body.reference || "").trim(),
            notes: String(body.notes || "").trim(),
            status: "VALID",
          },
        ],
        { session },
      );

      await audit(
        actor,
        "CREATE",
        "LOAN",
        String(loan._id),
        `Loan created for ${displayName}, amount Rs. ${principalAmount}`,
        null,
        getAuditSnapshot(loan),
        session,
      );

      await audit(
        actor,
        "CREATE",
        "FINANCE_TRANSACTION",
        String(transaction._id),
        `Opening transaction for loan ${String(loan._id)}`,
        null,
        getAuditSnapshot(transaction),
        session,
      );

      createdLoan = loan;
    });

    return NextResponse.json(
      { success: true, data: createdLoan },
      { status: 201 },
    );
  } catch (error) {
    return fail(error, "Failed to create loan");
  } finally {
    await session.endSession();
  }
}

/* =========================================================
   LOANS: PATCH
   Financial changes also update the opening ledger transaction.
========================================================= */

export async function updateLoan(
  id: string,
  body: RequestBody,
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    if (!validId(id)) {
      throw new HttpError("Invalid loan ID.", 400);
    }

    let updated: any;

    await session.withTransaction(async () => {
      const loan = await Loan.findById(id).session(session);

      if (!loan) {
        throw new HttpError("Loan not found.", 404);
      }

      if (loan.status === "VOIDED") {
        throw new HttpError(
          "A voided loan cannot be edited.",
          409,
        );
      }

      const before = getAuditSnapshot(loan);

      // Only allow fields that this endpoint can reconcile.
      if (body.notes !== undefined) {
        if (typeof body.notes !== "string") {
          throw new HttpError("Invalid notes.");
        }
        loan.notes = body.notes.trim();
      }

      if (body.dueDate !== undefined) {
        const dueDate = body.dueDate
          ? parseDate(body.dueDate)
          : null;

        if (body.dueDate && !dueDate) {
          throw new HttpError("Invalid due date.");
        }

        loan.dueDate = dueDate;
      }

      if (body.counterpartyName !== undefined) {
        if (
          typeof body.counterpartyName !== "string" ||
          !body.counterpartyName.trim()
        ) {
          throw new HttpError("Counterparty name is required.");
        }

        loan.counterpartyName = body.counterpartyName.trim();
      }

      const openingType =
        loan.direction === "BUSINESS_BORROWED"
          ? "LOAN_RECEIVED"
          : "PARTNER_ADVANCE_GIVEN";

      const openingTransaction =
        await FinanceTransaction.findOne({
          loanId: loan._id,
          type: openingType,
        }).session(session);

      if (!openingTransaction) {
        throw new HttpError(
          "Opening loan transaction is missing. Reconcile the loan before editing.",
          409,
        );
      }

      if (body.loanDate !== undefined) {
        const loanDate = parseDate(body.loanDate);

        if (!loanDate) {
          throw new HttpError("Invalid loan date.");
        }

        loan.loanDate = loanDate;
        openingTransaction.transactionDate = loanDate;
      }

      if (body.principalAmount !== undefined) {
        if (!validAmount(body.principalAmount)) {
          throw new HttpError(
            "Principal amount must be greater than zero.",
          );
        }

        const alreadyRepaid = await repaymentTotal(
          loan._id,
          loan.direction,
          session,
        );

        if (body.principalAmount < alreadyRepaid - 0.005) {
          throw new HttpError(
            "Principal cannot be less than the amount already repaid.",
          );
        }

        loan.principalAmount = body.principalAmount;
        openingTransaction.amount = body.principalAmount;
      }

      if (body.paymentMethod !== undefined) {
        openingTransaction.paymentMethod = getMethod(
          body.paymentMethod,
        );
      }

      if (body.reference !== undefined) {
        openingTransaction.reference = String(
          body.reference || "",
        ).trim();
      }

      if (body.notes !== undefined) {
        openingTransaction.notes = String(
          body.notes || "",
        ).trim();
      }

      await openingTransaction.save({ session });
      await syncLoanStatus(loan, session);
      await loan.save({ session });

      await audit(
        actor,
        "UPDATE",
        "LOAN",
        String(loan._id),
        `Loan ${String(loan._id)} updated`,
        before,
        getAuditSnapshot(loan),
        session,
      );

      updated = loan;
    });

    const paid = await repaymentTotal(updated._id, updated.direction);

    return NextResponse.json({
      success: true,
      data: presentLoan(updated, paid),
    });
  } catch (error) {
    return fail(error, "Failed to update loan");
  } finally {
    await session.endSession();
  }
}

/* =========================================================
   LOANS: DELETE
   Deletes associated transactions together, with a separate
   audit record for every deleted document.
========================================================= */

export async function deleteLoan(
  id: string,
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    if (!validId(id)) {
      throw new HttpError("Invalid loan ID.", 400);
    }

    await session.withTransaction(async () => {
      const loan = await Loan.findById(id).session(session);

      if (!loan) {
        throw new HttpError("Loan not found.", 404);
      }

      const transactions = await FinanceTransaction.find({
        loanId: loan._id,
      }).session(session);

      const loanBefore = getAuditSnapshot(loan);

      for (const transaction of transactions) {
        await audit(
          actor,
          "DELETE",
          "FINANCE_TRANSACTION",
          String(transaction._id),
          `Transaction deleted with loan ${String(loan._id)}`,
          getAuditSnapshot(transaction),
          null,
          session,
        );

        await transaction.deleteOne({ session });
      }

      await loan.deleteOne({ session });

      await audit(
        actor,
        "DELETE",
        "LOAN",
        String(loan._id),
        `Loan and ${transactions.length} related transaction(s) deleted`,
        loanBefore,
        null,
        session,
      );
    });

    return NextResponse.json({
      success: true,
      message: "Loan and its related transactions deleted.",
    });
  } catch (error) {
    return fail(error, "Failed to delete loan");
  } finally {
    await session.endSession();
  }
}

/* =========================================================
   FINANCE TRANSACTION: VALIDATE AMOUNT
========================================================= */

async function validateTransactionAmount(
  transaction: any,
  amount: number,
  session: mongoose.ClientSession,
) {
  const transactionId = transaction._id as
    | mongoose.Types.ObjectId
    | undefined;

  if (
    transaction.type === "PARTNER_CAPITAL_RETURN" ||
    transaction.type === "PARTNER_CONTRIBUTION"
  ) {
    const partnerId = transaction.partnerId;

    if (!partnerId) {
      throw new HttpError(
        "Partner is missing from the transaction.",
        409,
      );
    }

    const totals = await getPartnerCapitalTotals(
      partnerId,
      session,
      transactionId,
    );

    if (transaction.type === "PARTNER_CAPITAL_RETURN") {
      const available = totals.contributed - totals.returned;

      if (amount > available + 0.005) {
        throw new HttpError(
          `Capital return exceeds available unreturned contributions (${Math.max(0, available)}).`,
        );
      }
    }

    if (transaction.type === "PARTNER_CONTRIBUTION") {
      if (totals.contributed + amount < totals.returned - 0.005) {
        throw new HttpError(
          "Contribution amount cannot be reduced below capital already returned.",
        );
      }
    }
  }

  if (REPAID_TYPES.includes(transaction.type)) {
    if (!transaction.loanId) {
      throw new HttpError(
        "Loan is missing from the repayment transaction.",
        409,
      );
    }

    const loan = await Loan.findById(transaction.loanId).session(session);

    if (!loan || loan.status === "VOIDED") {
      throw new HttpError("Loan not found.", 404);
    }

    const expectedType =
      loan.direction === "BUSINESS_BORROWED"
        ? "LOAN_PRINCIPAL_REPAYMENT"
        : "PARTNER_ADVANCE_REPAID";

    if (transaction.type !== expectedType) {
      throw new HttpError(
        "Repayment type does not match the loan direction.",
      );
    }

    const alreadyRepaid = await repaymentTotal(
      loan._id,
      loan.direction,
      session,
      transactionId,
    );

    const outstanding =
      loan.principalAmount - alreadyRepaid;

    if (amount > outstanding + 0.005) {
      throw new HttpError(
        `Amount exceeds outstanding principal (${Math.max(0, outstanding)}).`,
      );
    }
  }

  if (transaction.type === "BUSINESS_ADVANCE_SETTLED") {
    if (!transaction.relatedTransactionId) {
      throw new HttpError(
        "Original business advance is missing.",
        409,
      );
    }

    const originalAdvance = await FinanceTransaction.findOne({
      _id: transaction.relatedTransactionId,
      type: "BUSINESS_ADVANCE_GIVEN",
      status: "VALID",
    }).session(session);

    if (!originalAdvance) {
      throw new HttpError(
        "Original business advance was not found.",
        404,
      );
    }

    const match: Record<string, unknown> = {
      relatedTransactionId: originalAdvance._id,
      type: "BUSINESS_ADVANCE_SETTLED",
      status: "VALID",
    };

    if (transactionId) {
      match._id = { $ne: transactionId };
    }

    const rows = await FinanceTransaction.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).session(session);

    const alreadySettled = Number(rows[0]?.total || 0);
    const outstanding =
      originalAdvance.amount - alreadySettled;

    if (amount > outstanding + 0.005) {
      throw new HttpError(
        `Amount exceeds outstanding advance (${Math.max(0, outstanding)}).`,
      );
    }
  }
}

/* =========================================================
   FINANCE TRANSACTIONS: GET LIST
========================================================= */

export async function getFinanceTransactions(
  searchParams: URLSearchParams,
) {
  try {
    await connectDB();

    const { page, limit, skip } =
      getPaginationParams(searchParams);

    const search = (searchParams.get("search") || "").trim();
    const type = searchParams.get("type");
    const partnerId = searchParams.get("partnerId");
    const loanId = searchParams.get("loanId");
    const status = searchParams.get("status") || "VALID";

    const filter: Record<string, any> = {};

    if (status === "VALID" || status === "VOIDED") {
      filter.status = status;
    }

    if (type) {
      filter.type = getTransactionType(type);
    }

    if (partnerId) {
      if (!validId(partnerId)) {
        throw new HttpError("Invalid partner ID.");
      }
      filter.partnerId = new mongoose.Types.ObjectId(partnerId);
    }

    if (loanId) {
      if (!validId(loanId)) {
        throw new HttpError("Invalid loan ID.");
      }
      filter.loanId = new mongoose.Types.ObjectId(loanId);
    }

    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};

      if (startDate) {
        const parsed = parseDate(startDate);
        if (!parsed) throw new HttpError("Invalid start date.");
        dateFilter.$gte = parsed;
      }

      if (endDate) {
        const parsed = parseDate(endDate);
        if (!parsed) throw new HttpError("Invalid end date.");
        parsed.setHours(23, 59, 59, 999);
        dateFilter.$lte = parsed;
      }

      filter.transactionDate = dateFilter;
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");

      const [partners, loans] = await Promise.all([
        Partner.find({ name: regex }).select("_id").lean(),
        Loan.find({ counterpartyName: regex })
          .select("_id")
          .lean(),
      ]);

      filter.$or = [
        { reference: regex },
        { notes: regex },
        { type: regex },
        { partnerId: { $in: partners.map((item: any) => item._id) } },
        { loanId: { $in: loans.map((item: any) => item._id) } },
      ];
    }

    const [data, totalCount, summary] = await Promise.all([
      FinanceTransaction.find(filter)
        .populate("partnerId", "name phone email")
        .populate("loanId", "direction counterpartyName principalAmount")
        .sort({ transactionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      FinanceTransaction.countDocuments(filter),

      FinanceTransaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data,
      page,
      limit,
      totalCount,
      hasMore: skip + data.length < totalCount,
      totalAmount: Number(summary[0]?.totalAmount || 0),
    });
  } catch (error) {
    return fail(error, "Failed to fetch finance transactions");
  }
}

/* =========================================================
   FINANCE TRANSACTIONS: GET ONE
========================================================= */

export async function getFinanceTransaction(id: string) {
  try {
    await connectDB();

    if (!validId(id)) {
      throw new HttpError("Invalid transaction ID.", 400);
    }

    const transaction = await FinanceTransaction.findById(id)
      .populate("partnerId", "name phone email")
      .populate("loanId", "direction counterpartyName principalAmount")
      .populate("relatedTransactionId")
      .lean();

    if (!transaction) {
      throw new HttpError("Finance transaction not found.", 404);
    }

    return NextResponse.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    return fail(error, "Failed to fetch finance transaction");
  }
}

/* =========================================================
   FINANCE TRANSACTIONS: CREATE
========================================================= */

export async function createFinanceTransaction(
  body: RequestBody,
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    const type = getTransactionType(body.type);

    if (OPENING_TRANSACTION_TYPES.includes(type)) {
      throw new HttpError(
        "Opening loan transactions are created automatically when a loan is created.",
      );
    }

    if (!MANUAL_TRANSACTION_TYPES.includes(type)) {
      throw new HttpError("Unsupported transaction type.");
    }

    const amount = body.amount;
    const transactionDate = parseDate(body.transactionDate);

    if (!validAmount(amount)) {
      throw new HttpError("Amount must be greater than zero.");
    }

    if (!transactionDate) {
      throw new HttpError("A valid transaction date is required.");
    }

    const paymentMethod = getMethod(body.paymentMethod ?? "CASH");

    let created: any;

    await session.withTransaction(async () => {
      let partnerId: mongoose.Types.ObjectId | null = null;
      let loan: any = null;
      let originalAdvance: any = null;

      const partnerRequired = [
        "PARTNER_CONTRIBUTION",
        "PARTNER_CAPITAL_RETURN",
        "PARTNER_DRAWING",
        "BUSINESS_ADVANCE_GIVEN",
      ].includes(type);

      if (partnerRequired) {
        if (!validId(body.partnerId)) {
          throw new HttpError("Select a valid partner.");
        }

        const partner = await Partner.findById(body.partnerId)
          .session(session);

        if (!partner) {
          throw new HttpError("Partner not found.", 404);
        }

        partnerId = partner._id;
      }

      if (type === "PARTNER_CAPITAL_RETURN") {
        const totals = await getPartnerCapitalTotals(
          partnerId!,
          session,
        );

        const available = totals.contributed - totals.returned;

        if (amount > available + 0.005) {
          throw new HttpError(
            `Capital return exceeds available unreturned contributions (${Math.max(0, available)}).`,
          );
        }
      }

      if (
        type === "LOAN_PRINCIPAL_REPAYMENT" ||
        type === "PARTNER_ADVANCE_REPAID"
      ) {
        if (!validId(body.loanId)) {
          throw new HttpError("Select a valid loan.");
        }

        loan = await Loan.findById(body.loanId).session(session);

        if (!loan || loan.status === "VOIDED") {
          throw new HttpError("Loan not found.", 404);
        }

        const expectedDirection =
          type === "LOAN_PRINCIPAL_REPAYMENT"
            ? "BUSINESS_BORROWED"
            : "PARTNER_ADVANCE";

        if (loan.direction !== expectedDirection) {
          throw new HttpError(
            "Transaction type does not match the loan direction.",
          );
        }

        const alreadyRepaid = await repaymentTotal(
          loan._id,
          loan.direction,
          session,
        );

        const outstanding =
          loan.principalAmount - alreadyRepaid;

        if (amount > outstanding + 0.005) {
          throw new HttpError(
            `Amount exceeds outstanding principal (${Math.max(0, outstanding)}).`,
          );
        }

        partnerId = loan.partnerId || null;
      }

      if (type === "BUSINESS_ADVANCE_SETTLED") {
        if (!validId(body.relatedTransactionId)) {
          throw new HttpError("Select the original business advance.");
        }

        if (
          body.settlementType !== "EXPENSE" &&
          body.settlementType !== "CASH_RETURN"
        ) {
          throw new HttpError(
            "Settlement type must be EXPENSE or CASH_RETURN.",
          );
        }

        originalAdvance = await FinanceTransaction.findOne({
          _id: body.relatedTransactionId,
          type: "BUSINESS_ADVANCE_GIVEN",
          status: "VALID",
        }).session(session);

        if (!originalAdvance) {
          throw new HttpError(
            "Original business advance not found.",
            404,
          );
        }

        const rows = await FinanceTransaction.aggregate([
          {
            $match: {
              relatedTransactionId: originalAdvance._id,
              type: "BUSINESS_ADVANCE_SETTLED",
              status: "VALID",
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
            },
          },
        ]).session(session);

        const alreadySettled = Number(rows[0]?.total || 0);
        const outstanding = originalAdvance.amount - alreadySettled;

        if (amount > outstanding + 0.005) {
          throw new HttpError(
            `Amount exceeds outstanding advance (${Math.max(0, outstanding)}).`,
          );
        }

        partnerId = originalAdvance.partnerId || null;
      }

      const [transaction] = await FinanceTransaction.create(
        [
          {
            type,
            partnerId,
            loanId: loan?._id || null,
            relatedTransactionId:
              type === "BUSINESS_ADVANCE_SETTLED"
                ? originalAdvance?._id
                : null,
            settlementType:
              type === "BUSINESS_ADVANCE_SETTLED"
                ? body.settlementType
                : null,
            amount,
            transactionDate,
            paymentMethod,
            reference: String(body.reference || "").trim(),
            notes: String(body.notes || "").trim(),
            status: "VALID",
          },
        ],
        { session },
      );

      if (loan) {
        await syncLoanStatus(loan, session);
      }

      await audit(
        actor,
        "CREATE",
        "FINANCE_TRANSACTION",
        String(transaction._id),
        `Finance transaction ${type} recorded, amount Rs. ${amount}`,
        null,
        getAuditSnapshot(transaction),
        session,
      );

      created = transaction;
    });

    return NextResponse.json(
      { success: true, data: created },
      { status: 201 },
    );
  } catch (error) {
    return fail(error, "Failed to create finance transaction");
  } finally {
    await session.endSession();
  }
}

/* =========================================================
   FINANCE TRANSACTIONS: PATCH
   Type and financial links are immutable here.
========================================================= */

export async function updateFinanceTransaction(
  id: string,
  body: RequestBody,
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    if (!validId(id)) {
      throw new HttpError("Invalid transaction ID.", 400);
    }

    let updated: any;

    await session.withTransaction(async () => {
      const transaction = await FinanceTransaction.findById(id)
        .session(session);

      if (!transaction) {
        throw new HttpError(
          "Finance transaction not found.",
          404,
        );
      }

      if (transaction.status !== "VALID") {
        throw new HttpError(
          "Only valid transactions can be edited.",
          409,
        );
      }

      if (OPENING_TRANSACTION_TYPES.includes(transaction.type)) {
        throw new HttpError(
          "Edit the linked loan instead of editing its opening transaction.",
          409,
        );
      }

      const before = getAuditSnapshot(transaction);
      let amount = transaction.amount;

      if (body.amount !== undefined) {
        if (!validAmount(body.amount)) {
          throw new HttpError(
            "Amount must be greater than zero.",
          );
        }

        amount = body.amount;
      }

      await validateTransactionAmount(
        transaction,
        amount,
        session,
      );

      transaction.amount = amount;

      if (body.transactionDate !== undefined) {
        const date = parseDate(body.transactionDate);
        if (!date) throw new HttpError("Invalid transaction date.");
        transaction.transactionDate = date;
      }

      if (body.paymentMethod !== undefined) {
        transaction.paymentMethod = getMethod(body.paymentMethod);
      }

      if (body.reference !== undefined) {
        if (typeof body.reference !== "string") {
          throw new HttpError("Invalid reference.");
        }
        transaction.reference = body.reference.trim();
      }

      if (body.notes !== undefined) {
        if (typeof body.notes !== "string") {
          throw new HttpError("Invalid notes.");
        }
        transaction.notes = body.notes.trim();
      }

      if (body.settlementType !== undefined) {
        if (transaction.type !== "BUSINESS_ADVANCE_SETTLED") {
          throw new HttpError(
            "Settlement type only applies to business advance settlements.",
          );
        }

        if (
          body.settlementType !== "EXPENSE" &&
          body.settlementType !== "CASH_RETURN"
        ) {
          throw new HttpError("Invalid settlement type.");
        }

        transaction.settlementType = body.settlementType;
      }

      await transaction.save({ session });

      if (transaction.loanId) {
        const loan = await Loan.findById(transaction.loanId)
          .session(session);

        if (loan) await syncLoanStatus(loan, session);
      }

      await audit(
        actor,
        "UPDATE",
        "FINANCE_TRANSACTION",
        String(transaction._id),
        `Finance transaction ${String(transaction._id)} updated`,
        before,
        getAuditSnapshot(transaction),
        session,
      );

      updated = transaction;
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return fail(error, "Failed to update finance transaction");
  } finally {
    await session.endSession();
  }
}

/* =========================================================
   FINANCE TRANSACTIONS: DELETE
========================================================= */

export async function deleteFinanceTransaction(
  id: string,
  actor: AuditActor,
) {
  const session = await mongoose.startSession();

  try {
    await connectDB();

    if (!validId(id)) {
      throw new HttpError("Invalid transaction ID.", 400);
    }

    await session.withTransaction(async () => {
      const transaction = await FinanceTransaction.findById(id)
        .session(session);

      if (!transaction) {
        throw new HttpError(
          "Finance transaction not found.",
          404,
        );
      }

      if (OPENING_TRANSACTION_TYPES.includes(transaction.type)) {
        throw new HttpError(
          "This transaction belongs to a loan. Delete the loan to remove its opening transaction.",
          409,
        );
      }

      if (transaction.type === "BUSINESS_ADVANCE_GIVEN") {
        const settlement = await FinanceTransaction.findOne({
          relatedTransactionId: transaction._id,
          type: "BUSINESS_ADVANCE_SETTLED",
          status: "VALID",
        })
          .session(session)
          .lean();

        if (settlement) {
          throw new HttpError(
            "This advance has settlement records. Delete those settlements first.",
            409,
          );
        }
      }

      // A contribution cannot be removed if doing so would make
      // previous capital returns exceed the remaining contributions.
      if (transaction.type === "PARTNER_CONTRIBUTION") {
        const totals = await getPartnerCapitalTotals(
          transaction.partnerId,
          session,
          transaction._id,
        );

        if (totals.contributed < totals.returned - 0.005) {
          throw new HttpError(
            "Cannot delete this contribution because capital returns depend on it.",
            409,
          );
        }
      }

      const before = getAuditSnapshot(transaction);
      const linkedLoanId = transaction.loanId;

      await transaction.deleteOne({ session });

      if (linkedLoanId) {
        const loan = await Loan.findById(linkedLoanId)
          .session(session);

        if (loan) {
          await syncLoanStatus(loan, session);
        }
      }

      await audit(
        actor,
        "DELETE",
        "FINANCE_TRANSACTION",
        String(transaction._id),
        `Finance transaction ${transaction.type} deleted`,
        before,
        null,
        session,
      );
    });

    return NextResponse.json({
      success: true,
      message: "Finance transaction deleted successfully.",
    });
  } catch (error) {
    return fail(error, "Failed to delete finance transaction");
  } finally {
    await session.endSession();
  }
}