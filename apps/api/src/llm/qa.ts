import {
  AskQuestionToolSchema,
  FinalizeToolSchema,
  PreferencesSchema,
  type Preferences,
} from '@galley/shared'
import { generateText, tool, type ModelMessage } from 'ai'
import { z } from 'zod'
import { getModel } from './provider.js'
import { logLLMCall } from './log.js'

// Q&A turn endpoint per MVP.md. The LLM gets the partial preferences and is
// instructed to either ask the next question or finalise. Tool-calling +
// Zod-validated output (ADR-005); provider-agnostic via the AI SDK (ADR-006).

export type QATurn =
  | { kind: 'question'; text: string; quickPicks?: string[] }
  | { kind: 'final'; preferences: Preferences }

const SYSTEM_PROMPT = `You are guiding a user through a kitchen design Q&A. Your goal is to fill in their Preferences object.

Rules:
- Ask ONE question at a time, conversational tone.
- Never re-ask anything already in the partial preferences below.
- Prefer concrete questions tied to earlier answers (e.g. if cookingFrequency is "intense", probe induction vs gas).
- Provide quickPicks (3–5 short options) when the answer is from a fixed enum or a small set.
- Cap the conversation at ~10 questions. Finalise as soon as you can fill the schema confidently — guess sensible defaults for anything the user hasn't specified directly but you can infer.
- Always respond via a tool call: ask_question(text, quickPicks?) OR finalize(preferences).

Preferences schema:
- style: modern | classic | rustic | minimal | industrial
- budgetTier: low | mid | high
- cookingFrequency: rare | weekly | daily | intense
- hobType: induction | gas | ceramic
- ovenType: single | double | combi | none
- fridgeSize: compact | standard | american
- dishwasher: boolean
- islandPreferred: boolean
- seatingAtIsland: integer (0 if no island or no seating)
- storagePriority: low | medium | high
- accessibility: array of free-form strings
- notes: free text capturing anything else`

const askQuestionTool = tool({
  description: 'Ask the user the next question in the Q&A.',
  inputSchema: z.object({
    text: z.string().min(1).describe('The question text in plain prose.'),
    quickPicks: z
      .array(z.string())
      .optional()
      .describe('Optional short options the user can click directly.'),
  }),
})

const finalizeTool = tool({
  description: 'Finalise the preferences when the schema is fully populated.',
  inputSchema: z.object({ preferences: PreferencesSchema }),
})

export type QAMessage = { role: 'user' | 'assistant'; content: string }

export async function nextQATurn(args: {
  partial: Record<string, unknown>
  history: QAMessage[]
}): Promise<QATurn> {
  const userPrefix = `Partial preferences so far (JSON):\n${JSON.stringify(
    args.partial,
    null,
    2
  )}\n\nDecide whether to ask the next question or finalise.`

  const messages: ModelMessage[] = [
    ...args.history.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
    { role: 'user', content: userPrefix },
  ]

  const result = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    tools: { ask_question: askQuestionTool, finalize: finalizeTool },
    toolChoice: 'required',
    messages,
  })

  logLLMCall('qa', {
    request: { messages, partial: args.partial },
    response: { toolCalls: result.toolCalls, finishReason: result.finishReason },
  })

  const call = result.toolCalls[0]
  if (!call) throw new Error('Q&A: model did not call a tool')

  if (call.toolName === 'ask_question') {
    const parsed = AskQuestionToolSchema.parse(call.input)
    return { kind: 'question', text: parsed.text, quickPicks: parsed.quickPicks }
  }
  if (call.toolName === 'finalize') {
    const parsed = FinalizeToolSchema.parse(call.input)
    return { kind: 'final', preferences: parsed.preferences }
  }
  throw new Error(`Q&A: unexpected tool ${call.toolName}`)
}
