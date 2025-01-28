import { Suspense } from "react"
import dynamic from "next/dynamic"
import { getWallet, getTransactions } from "@/lib/mongodb"
import { auth } from "@clerk/nextjs"

const DashboardClient = dynamic(() => import("./client"), { ssr: false })

export default async function DashboardPage() {
  const { userId } = auth()
  if (!userId) throw new Error("Not authenticated")

  const wallet = await getWallet(userId)
  const { transactions, totalCount } = await getTransactions(userId, 1, 10)

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900">Dashboard</h1>
      <Suspense fallback={<div>Loading dashboard...</div>}>
        <DashboardClient initialWallet={wallet} initialTransactions={transactions} initialTotalCount={totalCount} />
      </Suspense>
    </div>
  )
}

