import { NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { getWallet, createWallet } from "@/lib/mongodb"

export async function GET(request: Request) {
  try {
    const { userId } = getAuth(request)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let wallet = await getWallet(userId)
    if (!wallet) {
      wallet = await createWallet(userId)
    }

    console.log("Wallet response:", JSON.stringify(wallet))
    return NextResponse.json(wallet)
  } catch (error) {
    console.error("Failed to retrieve wallet:", error)
    return NextResponse.json({ error: "Failed to retrieve wallet" }, { status: 500 })
  }
}

