import "server-only"
import { PrismaClient, type Prisma } from "@prisma/client"
import { replaceDb, rawDb } from "@/lib/store"

/**
 * Saves the in-memory demo to Supabase through Prisma and loads it back, so
 * data survives restarts and every Vercel instance sees the same demo.
 * With no DATABASE_URL (or under tests) it does nothing and the app keeps
 * running purely in memory, exactly as before.
 */
const ROW = "demo"
const enabled = !!process.env.DATABASE_URL && !process.env.VITEST

const g = globalThis as unknown as { __prisma?: PrismaClient; __ppdbAt?: number }
const prisma = () => (g.__prisma ??= new PrismaClient())

/** Before reading: pull the saved demo if another instance changed it since we last looked. */
export async function syncFromDb() {
  if (!enabled) return
  try {
    const row = await prisma().demoState.findUnique({ where: { id: ROW }, select: { updatedAt: true } })
    if (!row) {
      // First run against an empty database: store the current (seed) demo.
      await saveToDb()
      return
    }
    const at = row.updatedAt.getTime()
    if (g.__ppdbAt === at && rawDb()) return
    const full = await prisma().demoState.findUnique({ where: { id: ROW } })
    if (full) {
      replaceDb(full.data as unknown as Parameters<typeof replaceDb>[0])
      g.__ppdbAt = at
    }
  } catch (e) {
    // A database hiccup should never take the demo down; carry on in memory.
    console.error("[persist] load failed, using memory:", (e as Error).message)
  }
}

/** After a change: write the whole demo back. */
export async function saveToDb() {
  if (!enabled) return
  const data = rawDb()
  if (!data) return
  try {
    const row = await prisma().demoState.upsert({
      where: { id: ROW },
      create: { id: ROW, data: data as unknown as Prisma.InputJsonValue },
      update: { data: data as unknown as Prisma.InputJsonValue },
      select: { updatedAt: true },
    })
    g.__ppdbAt = row.updatedAt.getTime()
  } catch (e) {
    console.error("[persist] save failed:", (e as Error).message)
  }
}
