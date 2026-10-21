import type { Message } from '@xsai/shared-chat'

function messageText(content: Message['content']): string {
  if (typeof content === 'string')
    return content
  if (!Array.isArray(content))
    return ''
  return content
    .map((part) => {
      if (part.type === 'text')
        return part.text
      if (part.type === 'refusal')
        return part.refusal
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function appendText(existing: string, addition: string): string {
  if (!addition)
    return existing
  if (!existing)
    return addition
  return `${existing}\n\n${addition}`
}

function mapToDialogRole(role: Message['role']): 'user' | 'assistant' {
  if (role === 'assistant')
    return 'assistant'
  return 'user'
}

function mergeSameRole(messages: Array<{ role: 'user' | 'assistant', content: string }>) {
  const merged: Array<{ role: 'user' | 'assistant', content: string }> = []
  for (const message of messages) {
    const last = merged.at(-1)
    if (last && last.role === message.role) {
      last.content = appendText(last.content, message.content)
      continue
    }
    merged.push({ ...message })
  }
  return merged
}

/**
 * Normalizes Chat Completions messages for llama.cpp Jinja chat templates.
 * Those templates require alternating user and assistant roles after the system block.
 */
export function normalizeLlamaServerChatMessages(messages: Message[]): Message[] {
  const systemMessages = messages.filter(message => message.role === 'system' || message.role === 'developer')
  const dialogMessages = messages.filter(message => message.role !== 'system' && message.role !== 'developer')

  const combinedSystem = systemMessages
    .map(message => messageText(message.content))
    .filter(Boolean)
    .join('\n\n')

  const mapped = dialogMessages.map((message) => {
    const role = mapToDialogRole(message.role)
    if (message.role === 'tool') {
      return {
        role,
        content: `[Tool result]\n${messageText(message.content)}`,
      }
    }
    if (message.role === 'assistant') {
      const text = messageText(message.content)
      const toolSummary = message.tool_calls?.length
        ? message.tool_calls
            .map(call => call.function?.name ? `[Tool call] ${call.function.name}` : '')
            .filter(Boolean)
            .join('\n')
        : ''
      return {
        role,
        content: appendText(text, toolSummary),
      }
    }
    return {
      role,
      content: messageText(message.content),
    }
  })

  const mergedDialog = mergeSameRole(mapped)
  const alternating = mergedDialog[0]?.role === 'assistant'
    ? [{ role: 'user' as const, content: '' }, ...mergedDialog]
    : mergedDialog

  const result: Message[] = []
  if (combinedSystem)
    result.push({ role: 'system', content: combinedSystem })
  result.push(...alternating.map(message => ({ role: message.role, content: message.content })))
  return result
}
