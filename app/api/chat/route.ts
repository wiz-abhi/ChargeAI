import { NextResponse } from "next/server"
import axios from "axios"
import { getWalletByApiKey, updateWalletBalance } from "@/lib/mongodb"
import { calculateCost } from "@/lib/pricing"
import { rateLimit } from "@/lib/rate-limit"

const AZURE_CONFIG = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: "2023-05-15",
  // Remove deploymentName from here as it will be dynamic
}

// Map of model names to their Azure deployment names
const MODEL_DEPLOYMENTS = {
  'gpt-4': process.env.AZURE_GPT4_DEPLOYMENT_NAME,
  'gpt-4o': process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  'gpt-3.5-turbo': process.env.AZURE_GPT35_DEPLOYMENT_NAME,
  // Add other models as needed
}

const validateConfig = () => {
  const required = ['endpoint', 'apiKey']
  const missing = required.filter(key => !AZURE_CONFIG[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required Azure configuration: ${missing.join(', ')}`)
  }
}

const getDeploymentName = (model) => {
  const deploymentName = MODEL_DEPLOYMENTS[model]
  if (!deploymentName) {
    throw new Error(`Unsupported model: ${model}. Available models are: ${Object.keys(MODEL_DEPLOYMENTS).join(', ')}`)
  }
  return deploymentName
}

const createAxiosInstance = () => {
  return axios.create({
    baseURL: AZURE_CONFIG.endpoint,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_CONFIG.apiKey,
    },
  })
}

export async function POST(request) {
  try {
    validateConfig()

    const { messages, model = "gpt-4o", temperature, max_tokens } = await request.json()
    const apiKey = request.headers.get("x-api-key")
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key - Please include your API key in the x-api-key header" },
        { status: 401 }
      )
    }

    // Validate model and get deployment name
    let deploymentName;
    try {
      deploymentName = getDeploymentName(model)
    } catch (modelError) {
      return NextResponse.json({
        error: {
          message: modelError.message,
          type: "invalid_model",
          code: "UNSUPPORTED_MODEL"
        }
      }, { status: 400 })
    }

    console.log('Fetching wallet for API key:', apiKey)
    const wallet = await getWalletByApiKey(apiKey)
    console.log('Wallet response:', wallet)

    if (!wallet) {
      return NextResponse.json(
        { error: "Invalid API key - The provided API key is not valid" },
        { status: 401 }
      )
    }

    if (typeof wallet.balance === 'undefined') {
      console.error('Invalid wallet structure:', wallet)
      return NextResponse.json({
        error: {
          message: "Invalid wallet configuration",
          type: "internal_error",
          code: "INVALID_WALLET",
        }
      }, { status: 500 })
    }

    if (!wallet.userId) {
      return NextResponse.json({
        error: {
          message: "Invalid wallet configuration - missing userId",
          type: "internal_error",
          code: "INVALID_WALLET_USER",
        }
      }, { status: 500 })
    }

    const rateLimitResult = await rateLimit(wallet.userId)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      )
    }

    const axiosInstance = createAxiosInstance()
    console.log('Making Azure OpenAI request for model:', model, 'using deployment:', deploymentName)
    
    let azureResponse;
    try {
      azureResponse = await axiosInstance.post(
        `/openai/deployments/${deploymentName}/chat/completions`,
        {
          messages,
          model,
          temperature,
          max_tokens,
        },
        {
          params: {
            'api-version': AZURE_CONFIG.apiVersion
          }
        }
      )
    } catch (azureError) {
      console.error("Azure API error:", azureError)
      return NextResponse.json({
        error: {
          message: azureError.response?.data?.error?.message || "Azure API request failed",
          type: "azure_api_error",
          code: azureError.response?.status || 500
        }
      }, { status: azureError.response?.status || 500 })
    }

    const tokensUsed = azureResponse.data.usage.total_tokens
    const cost = calculateCost(model, tokensUsed)
    
    console.log('Cost calculation:', { tokensUsed, cost, currentBalance: wallet.balance })
    
    if (wallet.balance < cost) {
      return NextResponse.json({
        error: "Insufficient funds",
        required: cost,
        available: wallet.balance
      }, { status: 402 })
    }

    try {
      console.log('Attempting to update wallet balance for user:', wallet.userId)
      const updatedWallet = await updateWalletBalance(
        wallet.userId,
        -cost,
        `Chat completion (${model}) - ${tokensUsed} tokens`
      )

      if (!updatedWallet) {
        throw new Error('Wallet update returned null')
      }

      console.log('Wallet update successful:', { 
        userId: wallet.userId, 
        previousBalance: wallet.balance,
        newBalance: updatedWallet.balance,
        cost: cost 
      })

      return NextResponse.json({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: azureResponse.data.model,
        choices: azureResponse.data.choices,
        usage: azureResponse.data.usage,
        system_fingerprint: azureResponse.data.system_fingerprint,
        cost,
        remaining_balance: updatedWallet.balance,
      })
    } catch (walletError) {
      console.error('Wallet update error:', walletError)
      console.error('Wallet update details:', { 
        userId: wallet.userId, 
        currentBalance: wallet.balance,
        attemptedDeduction: cost,
        error: walletError.message 
      })
      
      return NextResponse.json({
        error: {
          message: "Failed to update wallet balance",
          type: "wallet_update_error",
          code: "WALLET_UPDATE_FAILED",
          details: process.env.NODE_ENV === 'development' ? walletError.message : undefined
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error("Chat completion error:", error)

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500
      const message = error.response?.data?.error?.message || error.message
      
      return NextResponse.json({
        error: {
          message: message,
          type: "azure_openai_error",
          code: error.response?.data?.error?.code,
        }
      }, { status })
    }

    return NextResponse.json({
      error: {
        message: error.message || "An internal error occurred",
        type: "internal_error",
        code: error.code || "UNKNOWN_ERROR",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 })
  }
}