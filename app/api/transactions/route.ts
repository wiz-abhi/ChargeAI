import { NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { getTransactions } from "@/lib/mongodb"

export async function GET(request: Request) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const page = Number.parseInt(url.searchParams.get("page") || "1", 10)
    const limit = Number.parseInt(url.searchParams.get("limit") || "10", 10)

    const { transactions, totalCount } = await getTransactions(userId, page, limit)

    return NextResponse.json({ transactions, totalCount, page, limit })
  } catch (error) {
    console.error("Failed to retrieve transactions:", error)
    return NextResponse.json({ error: "Failed to retrieve transactions" }, { status: 500 })
  }
}

