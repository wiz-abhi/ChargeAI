import { NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function GET(req: Request) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const db = await connectToDatabase()
    const apiKeys = db.collection("apiKeys")

    const keys = await apiKeys.find({ userId }, { projection: { key: 1, createdAt: 1 } }).toArray()

    console.log("API Keys response:", JSON.stringify(keys))

    return NextResponse.json(keys)
  } catch (error) {
    console.error("Failed to retrieve API keys:", error)
    return NextResponse.json({ error: "Failed to retrieve API keys" }, { status: 500 })
  }
}

