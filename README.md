# Rentry

https://rentry.org/noass_ext

# Installation

Extensions -> Install extension (top right) -> Insert link `https://gitgud.io/Monblant/noass`

# Settings

`Enable NoAss` - enables messages squashing.

`Enable Zero Prefill` - enables Zero Prefill to be inserted at the prompt.

`Insert Zero Prefill` - enables Zero Prefill to be inserted at the beginning of a message.

`Enable Human Prompt` - enables the insertion of the human prompt before or after the squashed chat history (don't enable this on Claude)

`Squash Role` - the role from which the squashed chat history will be sent. Default - Assistant.

`Human Prompt (before)`, `Human Prompt (before)` - the human prompts and their respective positions in relation to the squashed chat history. Leave blank if you don't want to use either of them.

`Stop String` - a string on which generation will be interrupted.

`Messages Separator` - characters to be used to separate messages. The default is `Double newline`.

`User Prefix` - a string to be placed before the user message. The default is `**{{{user}}:** ` (with a space).

`User Suffix` - a string to be placed after the user message.

`Char Prefix` - a string to be placed before the char message.

`Char Suffix` - a string to be placed after the char message.

`Zero Prefill` - a string to placed after the chat history in case the chat history ends with trailing whitespaces. Default is ZWJ.
