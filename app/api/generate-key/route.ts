import { NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { connectToDatabase } from "@/lib/mongodb"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const { userId } = getAuth(req)
    if (!userId) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const db = await connectToDatabase()
    const apiKeys = db.collection("apiKeys")

    const existingKeys = await apiKeys.find({ userId }).toArray()
    if (existingKeys.length >= 2) {
      return new NextResponse(JSON.stringify({ error: "Maximum number of API keys reached" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const key = crypto.randomBytes(32).toString("hex")
    await apiKeys.insertOne({ key, userId, createdAt: new Date() })

    return NextResponse.json({ apiKey: key })
  } catch (error) {
    console.error("Failed to generate API key:", error)
    return new NextResponse(JSON.stringify({ error: "Failed to generate API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

