import { NextResponse } from "next/server"
import { getAuth } from "@clerk/nextjs/server"
import { connectToDatabase } from "@/lib/mongodb"

export async function DELETE(req: Request, { params }: { params: { key: string } }) {
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

    const result = await apiKeys.deleteOne({ key: params.key, userId })

    if (result.deletedCount === 0) {
      return new NextResponse(JSON.stringify({ error: "API key not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    return NextResponse.json({ message: "API key deleted successfully" })
  } catch (error) {
    console.error("Failed to delete API key:", error)
    return new NextResponse(JSON.stringify({ error: "Failed to delete API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

