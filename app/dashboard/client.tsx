"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Key, Trash2, HelpCircle, Copy, Check } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogClose } from "@radix-ui/react-dialog";

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface Transaction {
  type: string
  amount: number
  description: string
  timestamp: string
}

interface Wallet {
  balance: number
}

interface ApiKey {
  _id: string
  key: string
  createdAt: string
}

interface DashboardClientProps {
  initialWallet: Wallet | null
  initialTransactions: Transaction[]
  initialTotalCount: number
  codeSnippet: string
}

export default function DashboardClient({
  initialWallet,
  initialTransactions,
  initialTotalCount,
  codeSnippet
}: DashboardClientProps) {
  const { getToken } = useAuth()
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: wallet, error: walletError } = useSWR<Wallet>("/api/wallet", fetcher, { fallbackData: initialWallet })
  const { data: apiKeysData, error: apiKeysError } = useSWR<ApiKey[]>("/api/api-keys", fetcher)
  const { data: transactionsData, error: transactionsError } = useSWR<{
    transactions: Transaction[]
    totalCount: number
  }>(`/api/transactions?page=${page}&limit=10`, fetcher, {
    fallbackData: { transactions: initialTransactions, totalCount: initialTotalCount },
  })

  const handleCopyClick = async () => {
    try {
      await navigator.clipboard.writeText(codeSnippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000) // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const generateApiKey = async () => {
    try {
      const token = await getToken()
      const response = await fetch("/api/generate-key", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate API key")
      }
      mutate("/api/api-keys")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const deleteApiKey = async (key: string) => {
    try {
      const token = await getToken()
      const response = await fetch(`/api/api-key/${key}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete API key")
      }
      mutate("/api/api-keys")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (walletError || apiKeysError || transactionsError) {
    return <div>Error loading dashboard data</div>
  }

  return (
    <>
      {error && <p className="text-red-500 mb-4 text-center">{error}</p>}

      {wallet && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-indigo-600">Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${wallet.balance.toFixed(3)}</p>
          </CardContent>
        </Card>
      )}

      <h2 className="text-2xl font-bold mb-4 text-center text-gray-900">API Key Management</h2>
      <div className="flex justify-center gap-4 mb-8">
        <Button
          onClick={generateApiKey}
          disabled={apiKeysData && apiKeysData.length >= 2}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Key className="mr-2 h-4 w-4" />
          Generate New API Key
        </Button>
        
        <Dialog>
  <DialogTrigger asChild>
    <Button className="bg-indigo-600 text-white hover:bg-indigo-700">
      <HelpCircle className="mr-2 h-4 w-4" />
      How to Use
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-full sm:max-w-3xl mx-auto max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="text-white">How to Use Your API Key</DialogTitle>
    </DialogHeader>
    <div className="mt-4 relative">
      <pre className="bg-gray-100 rounded-lg overflow-x-auto text-sm break-words">
        <code>
          {`
            require("dotenv").config();
            const express = require("express");
            const axios = require("axios");
            const cors = require("cors");

            const app = express();
            const PORT = process.env.PORT || 5000;

            app.use(express.json());
            app.use(cors());

            const OPENAI_API_URL = "<This Website's URL>/api/chat";
            const API_KEY = process.env.API_KEY;

            if (!OPENAI_API_KEY) {
              console.error("⚠️ Missing API Key. Set API_KEY in .env");
              process.exit(1);
            }

            app.post("/chat", async (req, res) => {
              try {
                const { messages, model = "gpt-4o", temperature = 0.7 } = req.body;

                if (!messages || !Array.isArray(messages)) {
                  return res.status(400).json({ error: "Invalid request format" });
                }

                const response = await axios.post(
                  OPENAI_API_URL,
                  { model, messages, temperature },
                  { headers: { Authorization: \`Bearer \${API_KEY}\` } }
                );

                res.json(response.data);
              } catch (error) {
                console.error("OpenAI API Error:", error?.response?.data || error.message);
                res.status(500).json({ error: "Failed to connect to OpenAI API" });
              }
            });

            app.listen(PORT, () => console.log(\`🚀 Server running on port \${PORT}\`));
          `}
        </code>
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2 h-8 w-8 p-0"
        onClick={handleCopyClick}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  </DialogContent>
</Dialog>

      </div>

      <div className="grid gap-6">
        {apiKeysData ? (
          apiKeysData.map((key) => (
            <Card key={key._id} className="bg-white shadow-md">
              <CardHeader>
                <CardTitle className="text-xl text-indigo-600">API Key</CardTitle>
                <CardDescription>Created on: {new Date(key.createdAt).toLocaleString()}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono bg-gray-100 p-3 rounded text-sm break-all">{key.key}</p>
              </CardContent>
              <CardFooter>
                <Button variant="destructive" onClick={() => deleteApiKey(key.key)} className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <Skeleton className="w-full h-40" />
        )}
      </div>

      {apiKeysData && apiKeysData.length === 0 && (
        <p className="text-center text-gray-600 mt-8">
          You haven't generated any API keys yet. Generate one to get started!
        </p>
      )}

      {transactionsData && transactionsData.transactions.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4 text-center text-gray-900">Credit Transaction History</h2>
          <div className="grid gap-4">
            {transactionsData.transactions.map((transaction, index) => (
              <Card key={index} className="bg-white shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg text-indigo-600">Credit</CardTitle>
                  <CardDescription>{new Date(transaction.timestamp).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-bold">${transaction.amount.toFixed(2)}</p>
                  <p>{transaction.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            <Button onClick={() => setPage(page > 1 ? page - 1 : 1)} disabled={page === 1}>
              Previous
            </Button>
            <Button onClick={() => setPage(page + 1)} disabled={page * 10 >= transactionsData.totalCount}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  )
}