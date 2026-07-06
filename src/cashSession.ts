import { db, uid, type CashMovement, type CashMovementType, type CashSession, type User } from './db';
import { round2, todayISO } from './utils';

export function getOpenSession(): Promise<CashSession | undefined> {
  return db.cashSessions.where('status').equals('open').first();
}

export async function openSession(user: User, openingAmount: number, note = ''): Promise<CashSession> {
  const existing = await getOpenSession();
  if (existing) return existing; // avoid duplicates if two taps race
  const session: CashSession = {
    id: uid(),
    openedAt: todayISO(),
    openedBy: user.id!,
    openedByName: user.name,
    openingAmount: round2(openingAmount),
    closedAt: null,
    closedBy: null,
    closedByName: null,
    countedAmount: null,
    expectedAmount: null,
    difference: null,
    cashSalesTotal: null,
    cashInTotal: null,
    cashOutTotal: null,
    note,
    status: 'open',
  };
  await db.cashSessions.add(session);
  return session;
}

export async function addCashMovement(session: CashSession, type: CashMovementType, amount: number, note: string, user: User): Promise<CashMovement> {
  const mv: CashMovement = {
    id: uid(),
    sessionId: session.id!,
    date: todayISO(),
    type,
    amount: round2(amount),
    note,
    userId: user.id!,
    userName: user.name,
  };
  await db.cashMovements.add(mv);
  return mv;
}

export interface SessionTotals {
  cashSalesTotal: number;
  cashInTotal: number;
  cashOutTotal: number;
  expectedAmount: number;
}

export async function computeSessionTotals(session: CashSession, asOf?: string): Promise<SessionTotals> {
  const to = asOf ?? session.closedAt ?? todayISO();
  const sales = await db.sales.where('date').between(session.openedAt, to, true, true).toArray();
  const cashSalesTotal = round2(
    sales.filter((s) => s.status === 'done' && s.payment === 'cash').reduce((s, x) => s + x.total, 0),
  );
  const movements = await db.cashMovements.where('sessionId').equals(session.id!).toArray();
  const cashInTotal = round2(movements.filter((m) => m.type === 'in').reduce((s, x) => s + x.amount, 0));
  const cashOutTotal = round2(movements.filter((m) => m.type === 'out').reduce((s, x) => s + x.amount, 0));
  const expectedAmount = round2(session.openingAmount + cashSalesTotal + cashInTotal - cashOutTotal);
  return { cashSalesTotal, cashInTotal, cashOutTotal, expectedAmount };
}

export async function closeSession(session: CashSession, countedAmount: number, note: string, user: User): Promise<void> {
  const closedAt = todayISO();
  const totals = await computeSessionTotals(session, closedAt);
  await db.cashSessions.update(session.id!, {
    closedAt,
    closedBy: user.id!,
    closedByName: user.name,
    countedAmount: round2(countedAmount),
    expectedAmount: totals.expectedAmount,
    difference: round2(countedAmount - totals.expectedAmount),
    cashSalesTotal: totals.cashSalesTotal,
    cashInTotal: totals.cashInTotal,
    cashOutTotal: totals.cashOutTotal,
    note: note || session.note,
    status: 'closed',
  });
}
