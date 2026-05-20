export type ConversationDisplayInput = {
  conversationId: string;
  name?: string;
  platform?: string;
};

export function formatConversationDisplay(input: ConversationDisplayInput) {
  const name = input.name?.trim();
  const conversationId = input.conversationId.trim();
  const platform = input.platform?.trim();

  if (!name) {
    return {
      primary: conversationId,
      secondary: "",
    };
  }

  return {
    primary: name,
    secondary: [conversationId, platform].filter(Boolean).join(" · "),
  };
}
