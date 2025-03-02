import { saveSettingsDebounced, substituteParamsExtended, updateMessageBlock, chat, this_chid, stopGeneration } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { addEphemeralStoppingString, flushEphemeralStoppingStrings } from '../../../power-user.js';
import { download, getFileText } from '../../../utils.js';
import { getMessageTimeStamp } from '../../../RossAscends-mods.js';

const { eventSource, event_types, callPopup, renderExtensionTemplateAsync, saveChat } = SillyTavern.getContext();

const defaultSet = {
    name: 'Default',
    enable_stop_string: true,
    stop_string: '**{{user}}:**',
    messages_separator: 'double_newline',
    user_prefix: '**{{user}}:** ',
    user_suffix: '',
    char_prefix: '',
    char_suffix: '',
    zero_prefill: "\u200D"
};

const defaultSettings = {
    noass_is_enabled: false,
    enable_zero_prefill: true,
    paste_prefill: false,
    client_stop_string: false,
    human_prompt_active: false,
    preserve_system: true,
    preserve_user_first: false,
    preserve_assistant_last: false,
    squash_role: 'assistant',
    human_prompt_before: '',
    human_prompt_after: '[continue seamlessly]',
    active_set: 'Default',
    active_set_idx: 0,
    sets: [defaultSet]
};

const MessageRole = {
    SYSTEM: 'system',
    USER: 'user',
    ASSISTANT: 'assistant'
}

const defaultExtPrefix = '[NoAss]';
const path = 'third-party/noass';

let cachedStopString;
let clientStopStringTriggered = false;

function getDefaultSet() {
    return JSON.parse(JSON.stringify(defaultSet));
}

function updateOrInsert(jsonArray, newJson) {
    const index = jsonArray.findIndex(item => item.name === newJson.name);
    if (index !== -1) {
        jsonArray[index] = newJson;
        return index;
    } else {
        jsonArray.push(newJson);
        return jsonArray.length - 1;
    }
}

function removeAfterSubstring(str, substring) {
    const index = str.indexOf(substring);
    if (index === -1) {
        return str;
    }
    return str.slice(0, index);
}

function clientStopStringHandler(text) {
    if (extension_settings.NoAss.client_stop_string && extension_settings.NoAss.sets[extension_settings.NoAss.active_set_idx].enable_stop_string) {
        if (cachedStopString === undefined) {
            const activeSet = extension_settings.NoAss.sets[extension_settings.NoAss.active_set_idx];
            const { stop_string } = activeSet;

            if (stop_string) {
                cachedStopString = substituteParamsExtended(stop_string);
            }
        }
        
        if (cachedStopString !== undefined && text.includes(cachedStopString)) {
            clientStopStringTriggered = true;
            stopGeneration();
        }
    }
}

function refreshSetList() {
    const setsName = extension_settings.NoAss.sets.map(obj => obj.name);
    const $presetList = $('#NoAss-preset-list').empty();
    setsName.forEach(option => {
        $presetList.append($('<option>', { value: option, text: option }));
    });
    $presetList.val(extension_settings.NoAss.active_set);
}


async function changeSet(idx) {
    const set_name = extension_settings.NoAss.sets[idx].name;
    extension_settings.NoAss.active_set = set_name;
    extension_settings.NoAss.active_set_idx = idx;
    refreshSetList();
    loadSetParameters();
    saveSettingsDebounced();
}

async function importSet(file) {
    if (!file) {
        toastr.error('No file provided.');
        return;
    }

    try {
        const fileText = await getFileText(file);
        const noAssSet = JSON.parse(fileText);
        if (!noAssSet.name) throw new Error('No name provided.');

        const setIdx = updateOrInsert(extension_settings.NoAss.sets, noAssSet);
        await changeSet(setIdx);
        checkSettings();
        toastr.success(`NoAss set "${noAssSet.name}" imported.`);
    } catch (error) {
        console.error(error);
        toastr.error('Invalid JSON file.');
    }
}

function checkSettings() {
    const noAssSettings = extension_settings.NoAss;
    Object.assign(noAssSettings, {
        enable_zero_prefill: noAssSettings.enable_zero_prefill ?? defaultSettings.enable_zero_prefill,
        paste_prefill: noAssSettings.paste_prefill ?? defaultSettings.paste_prefill,
        client_stop_string: noAssSettings.client_stop_string ?? defaultSettings.client_stop_string,
        human_prompt_active: noAssSettings.human_prompt_active ?? defaultSettings.human_prompt_active,
        preserve_system: noAssSettings.preserve_system ?? defaultSettings.preserve_system,
        preserve_user_first: noAssSettings.preserve_user_first ?? defaultSettings.preserve_user_first,
        preserve_assistant_last: noAssSettings.preserve_assistant_last ?? defaultSettings.preserve_assistant_last,
        squash_role: noAssSettings.squash_role ?? defaultSettings.squash_role,
        human_prompt_before: noAssSettings.human_prompt_before ?? defaultSettings.human_prompt_before,
        human_prompt_after: noAssSettings.human_prompt_after ?? noAssSettings.human_prompt ?? defaultSettings.human_prompt_after,
        active_set: noAssSettings.active_set ?? defaultSettings.active_set,
        active_set_idx: noAssSettings.active_set_idx ?? defaultSettings.active_set_idx,
        sets: noAssSettings.sets ?? [defaultSet]
    });

    if (!noAssSettings.sets.length) {
        const currentActiveSetIdx = noAssSettings.active_set_idx;
        ['messages_separator', 'user_prefix', 'user_suffix', 'char_prefix', 'char_suffix', 'zero_prefill'].forEach(key => {
            if (noAssSettings[key] !== undefined) {
                noAssSettings.sets[currentActiveSetIdx][key] = noAssSettings[key];
                delete noAssSettings[key];
            }
        });
    }

    for (let idx = 0; idx < noAssSettings.sets.length; idx++) {
        if (noAssSettings.sets[idx].enable_stop_string === undefined) {
            noAssSettings.sets[idx].enable_stop_string = defaultSet.enable_stop_string;
        }
    }

    saveSettingsDebounced();
}

function loadSetParameters() {
    const currentSet = extension_settings.NoAss.sets[extension_settings.NoAss.active_set_idx];
    const replaceNewlines = str => str.replace(/\n/g, '\\n');

    $('#noass_is_enabled').prop('checked', extension_settings.NoAss.noass_is_enabled);
    $('#noass_enable_zero_prefill').prop('checked', extension_settings.NoAss.enable_zero_prefill);
    $('#noass_paste_prefill').prop('checked', extension_settings.NoAss.paste_prefill);
    $('#noass_client_stop_string').prop('checked', extension_settings.NoAss.client_stop_string);
    $('#noass_human_prompt_active').prop('checked', extension_settings.NoAss.human_prompt_active);
    $('#noass_preserve_system').prop('checked', extension_settings.NoAss.preserve_system);
    $('#noass_preserve_user_first').prop('checked', extension_settings.NoAss.preserve_user_first);
    $('#noass_preserve_assistant_last').prop('checked', extension_settings.NoAss.preserve_assistant_last);
    $('#noass_squash_role').val(extension_settings.NoAss.squash_role);
    $('#noass_human_prompt_before').val(extension_settings.NoAss.human_prompt_before);
    $('#noass_human_prompt_after').val(extension_settings.NoAss.human_prompt_after);
    $('#noass_enable_stop_string').prop('checked', currentSet.enable_stop_string);
    $('#noass_stop_string').val(currentSet.stop_string);
    $('#noass_messages_separator').val(currentSet.messages_separator);
    $('#noass_user_prefix').val(replaceNewlines(currentSet.user_prefix));
    $('#noass_user_suffix').val(replaceNewlines(currentSet.user_suffix));
    $('#noass_char_prefix').val(replaceNewlines(currentSet.char_prefix));
    $('#noass_char_suffix').val(replaceNewlines(currentSet.char_suffix));
    $('#noass_zero_prefill').val(currentSet.zero_prefill);

    if (extension_settings.NoAss.human_prompt_active) {
        $('#human_prompt_container').removeClass('hidden');
    } else {
        $('#human_prompt_container').addClass('hidden');
    }
}

function loadSettings() {
    if (!extension_settings.NoAss) {
        extension_settings.NoAss = defaultSettings;
    };

    checkSettings();
    refreshSetList();
    loadSetParameters();
}

function setupListeners() {
    const noAssSettings = extension_settings.NoAss;

    $('#noass_is_enabled').off('click').on('click', () => {
        noAssSettings.noass_is_enabled = $('#noass_is_enabled').prop('checked');
        if (!noAssSettings.noass_is_enabled) flushEphemeralStoppingStrings();
        saveSettingsDebounced();
    });

    $('#noass_enable_zero_prefill').off('click').on('click', () => {
        noAssSettings.enable_zero_prefill = $('#noass_enable_zero_prefill').prop('checked');
        saveSettingsDebounced();
    });

    $('#noass_paste_prefill').off('click').on('click', () => {
        noAssSettings.paste_prefill = $('#noass_paste_prefill').prop('checked');
        saveSettingsDebounced();
    });

    $('#noass_client_stop_string').off('click').on('click', () => {
        noAssSettings.client_stop_string = $('#noass_client_stop_string').prop('checked');
        saveSettingsDebounced();
    });

    $('#noass_human_prompt_active').off('click').on('click', () => {
        noAssSettings.human_prompt_active = $('#noass_human_prompt_active').prop('checked');
        if (noAssSettings.human_prompt_active) {
            $('#human_prompt_container').removeClass('hidden');
        } else {
            $('#human_prompt_container').addClass('hidden');
        }
        saveSettingsDebounced();
    });

    $('#noass_preserve_system').off('click').on('click', () => {
        noAssSettings.preserve_system = $('#noass_preserve_system').prop('checked');
        saveSettingsDebounced();
    });

    $('#noass_preserve_user_first').off('click').on('click', () => {
        noAssSettings.preserve_user_first = $('#noass_preserve_user_first').prop('checked');
        saveSettingsDebounced();
    });

    $('#noass_preserve_assistant_last').off('click').on('click', () => {
        noAssSettings.preserve_assistant_last = $('#noass_preserve_assistant_last').prop('checked');
        saveSettingsDebounced();
    });

    $('#noass_squash_role').off('change').on('change', () => {
        noAssSettings.squash_role = $('#noass_squash_role').val();
        saveSettingsDebounced();
    });

    $('#noass_human_prompt_before').off('input').on('input', () => {
        noAssSettings.human_prompt_before = $('#noass_human_prompt_before').val();
        saveSettingsDebounced();
    });

    $('#noass_human_prompt_after').off('input').on('input', () => {
        noAssSettings.human_prompt_after = $('#noass_human_prompt_after').val();
        saveSettingsDebounced();
    });

    $('#NoAss-preset-list').off('change').on('change', async () => {
        await changeSet($('#NoAss-preset-list').prop('selectedIndex'));
    });

    $('#NoAss-preset-new').on('click', async () => {
        const newSetHtml = $(await renderExtensionTemplateAsync(path, 'new_set_popup'));
        const popupResult = await callPopup(newSetHtml, 'confirm', undefined, { okButton: 'Save' });
        if (popupResult) {
            const newSet = getDefaultSet();
            newSet.name = String(newSetHtml.find('.NoAss-newset-name').val());
            const setIdx = updateOrInsert(noAssSettings.sets, newSet);
            await changeSet(setIdx);
        }
    });

    $('#NoAss-preset-importFile').on('change', async function () {
        for (const file of this.files) {
            await importSet(file);
        }
        this.value = '';
    });

    $('#NoAss-preset-import').on('click', () => {
        $('#NoAss-preset-importFile').trigger('click');
    });

    $('#NoAss-preset-export').on('click', () => {
        const currentSet = noAssSettings.sets[noAssSettings.active_set_idx];
        const fileName = `${currentSet.name.replace(/[\s.<>:"/\\|?*\x00-\x1F\x7F]/g, '_').toLowerCase()}.json`;
        const fileData = JSON.stringify(currentSet, null, 4);
        download(fileData, fileName, 'application/json');
    });

    $('#NoAss-preset-delete').on('click', async () => {
        const confirm = await callPopup('Are you sure you want to delete this set?', 'confirm');
        if (!confirm) return;

        noAssSettings.sets.splice(noAssSettings.active_set_idx, 1);
        if (noAssSettings.sets.length) {
            changeSet(0);
        } else {
            const setIdx = updateOrInsert(noAssSettings.sets, getDefaultSet());
            changeSet(setIdx);
        }
    });

    $('#noass_enable_stop_string').off('click').on('click', () => {
        const value = $('#noass_enable_stop_string').prop('checked');
        if (!value) {
            flushEphemeralStoppingStrings();
        }
        noAssSettings.sets[noAssSettings.active_set_idx].enable_stop_string = value
        saveSettingsDebounced();
    });

    const inputListeners = [
        { selector: '#noass_stop_string', key: 'stop_string' },
        { selector: '#noass_user_prefix', key: 'user_prefix', replaceNewlines: true },
        { selector: '#noass_user_suffix', key: 'user_suffix', replaceNewlines: true },
        { selector: '#noass_char_prefix', key: 'char_prefix', replaceNewlines: true },
        { selector: '#noass_char_suffix', key: 'char_suffix', replaceNewlines: true },
        { selector: '#noass_zero_prefill', key: 'zero_prefill' }
    ];

    inputListeners.forEach(({ selector, key, replaceNewlines }) => {
        $(selector).off('input').on('input', () => {
            let value = $(selector).val();
            if (replaceNewlines) value = value.replace(/\\n/g, '\n');
            noAssSettings.sets[noAssSettings.active_set_idx][key] = value;
            saveSettingsDebounced();
        });
    });

    $('#noass_messages_separator').off('change').on('change', () => {
        noAssSettings.sets[noAssSettings.active_set_idx].messages_separator = $('#noass_messages_separator').val();
        saveSettingsDebounced();
    });
}

if (!('CHAT_COMPLETION_PROMPT_READY' in event_types)) {
    toastr.error('Required event types not found: CHAT_COMPLETION_PROMPT_READY. Update SillyTavern to the >=1.12 version.');
    throw new Error('Events not found.');
}

function isChatCompletion() {
    return SillyTavern.getContext().mainApi === 'openai';
}

function getSendDate(idx) {
    if (idx !== undefined) {
        return this_chid ? chat[idx]?.send_date : '';
    }
    return getMessageTimeStamp();
}

eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, async (data) => {
    if (!extension_settings.NoAss.noass_is_enabled || !isChatCompletion()) return;
    cachedStopString = undefined;
    clientStopStringTriggered = false;

    console.debug(`${defaultExtPrefix} Updating prompt`);

    const activeSet = extension_settings.NoAss.sets[extension_settings.NoAss.active_set_idx];
    const { zero_prefill, stop_string, enable_stop_string } = activeSet;
    const humanPromptBeforeActive = extension_settings.NoAss.human_prompt_active && extension_settings.NoAss.human_prompt_before;
    const humanPromptAfterActive = extension_settings.NoAss.human_prompt_active && extension_settings.NoAss.human_prompt_after;

    flushEphemeralStoppingStrings();
    if (stop_string && enable_stop_string && !extension_settings.NoAss.client_stop_string) {
        addEphemeralStoppingString(substituteParamsExtended(stop_string));
        if (extension_settings.NoAss.paste_prefill && stop_string.startsWith(zero_prefill)) {
            addEphemeralStoppingString(substituteParamsExtended(stop_string.replace(zero_prefill, "")));
        }
    }

    let messages = [...data.chat];
    const separator = { newline: '\n', space: ' ' }[activeSet.messages_separator] || '\n\n';

    let mergedMessages = [];
    let lastMessageIndices = [];
    if (messages.length > 0) {
        mergedMessages.push({ ...messages[0] });
        lastMessageIndices.push(0);
        for (let i = 1; i < messages.length; i++) {
            if (messages[i].role === mergedMessages[mergedMessages.length - 1].role) {
                mergedMessages[mergedMessages.length - 1].content += separator + messages[i].content;
                lastMessageIndices[lastMessageIndices.length - 1] = i;
            } else {
                mergedMessages.push({ ...messages[i] });
                lastMessageIndices.push(i);
            }
        }
    }
    messages = mergedMessages;

    let preserve_message_count = 0;
    let firstUserIndex = -1;
    let lastAssistantIndex = -1;

    for (let i = 0; i < messages.length; i++) {
        if (extension_settings.NoAss.preserve_system && messages[i].role === MessageRole.SYSTEM && firstUserIndex === -1) {
            preserve_message_count++;
        } else if (extension_settings.NoAss.preserve_user_first && messages[i].role === MessageRole.USER && firstUserIndex === -1) {
            firstUserIndex = i;
            preserve_message_count++;
        } else {
            break;
        }
    }

    if (extension_settings.NoAss.preserve_assistant_last && messages[messages.length - 1].role === MessageRole.ASSISTANT) {
        lastAssistantIndex = messages.length - 1;
    }

    const sliceStart = preserve_message_count;
    const sliceEnd = lastAssistantIndex === -1 ? messages.length : messages.length - 1;

    let chatHistory = messages.slice(sliceStart, sliceEnd).reduce((history, message, idx) => {
        if (idx === lastAssistantIndex && extension_settings.NoAss.preserve_assistant_last && message.role == MessageRole.ASSISTANT) return history;

        let prefix;
        let suffix;
        const timestampDict = { timestamp: getSendDate(lastMessageIndices[idx]) };
        switch (message.role) {
            case MessageRole.USER:
                prefix = substituteParamsExtended(activeSet.user_prefix, timestampDict);
                suffix = substituteParamsExtended(activeSet.user_suffix, timestampDict);
                break;
            case MessageRole.ASSISTANT:
                prefix = substituteParamsExtended(activeSet.char_prefix, timestampDict);
                suffix = substituteParamsExtended(activeSet.char_suffix, timestampDict);
                break;
            default:
                prefix = '';
                suffix = '';
        }
        if(history === '') return `${message.content}`;
        return `${history}${separator}${prefix}${message.content}${suffix}`;
    }, '');

    function applyZeroPrefill(mesStr) {
        let resultStr = mesStr;
        const pseudoPrefill = separator + substituteParamsExtended(activeSet.char_prefix, {timestamp: getSendDate()});
        resultStr += pseudoPrefill;

        if (resultStr.endsWith("\n") || resultStr.endsWith(" ") || (!/\S/.test(resultStr) && zero_prefill !== '{{trim}}')) {
            if (zero_prefill === '{{trim}}') {
                resultStr = resultStr.trim();
            } else {
                resultStr += zero_prefill;
            }
        };

        return resultStr;
    }

    if (extension_settings.NoAss.enable_zero_prefill && extension_settings.NoAss.squash_role === MessageRole.ASSISTANT && messages[messages.length - 1].role !== MessageRole.ASSISTANT && !humanPromptBeforeActive) {
        chatHistory = applyZeroPrefill(chatHistory);
    }

    data.chat.length = 0;

    if (extension_settings.NoAss.preserve_system) {
        for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === MessageRole.SYSTEM) {
                data.chat.push({ ...messages[i] });
            } else break;
        }
    }

    if (humanPromptBeforeActive) {
        const humanPromptBefore = substituteParamsExtended(extension_settings.NoAss.human_prompt_before, { timestamp: getSendDate() });

        if (humanPromptBefore !== '') {
            data.chat.push({
                role: MessageRole.USER,
                content: humanPromptBefore,
            });
        }
    }

    if(firstUserIndex >= 0 && extension_settings.NoAss.preserve_user_first){
        data.chat.push({...messages[firstUserIndex]});
    }

    data.chat.push({
        role: extension_settings.NoAss.squash_role,
        content: chatHistory,
    });

    if (humanPromptAfterActive) {
        const humanPromptAfter = substituteParamsExtended(extension_settings.NoAss.human_prompt_after, { timestamp: getSendDate() });

        if (humanPromptAfter !== '') {
            data.chat.push({
                role: MessageRole.USER,
                content: humanPromptAfter,
            });
        }
    }

    if(lastAssistantIndex >= 0 && extension_settings.NoAss.preserve_assistant_last) {
        const prefill = messages[lastAssistantIndex];
        if (extension_settings.NoAss.enable_zero_prefill) prefill.content = applyZeroPrefill(prefill.content);
        data.chat.push({...prefill});
    } else if (extension_settings.NoAss.enable_zero_prefill && (extension_settings.NoAss.squash_role !== MessageRole.ASSISTANT || humanPromptBeforeActive)) {
        const prefillStr = applyZeroPrefill('');
        if (/\S/.test(prefillStr)) {
            data.chat.push({
                role: MessageRole.ASSISTANT,
                content: prefillStr.replace(/^\s+/, ''),
            });
        }
    }

    console.debug(`${defaultExtPrefix} Prompt updated`);
});


eventSource.makeFirst(event_types.CHARACTER_MESSAGE_RENDERED, async (messageId) => {
    if (!extension_settings.NoAss.noass_is_enabled || !extension_settings.NoAss.paste_prefill || messageId === 0 || ['...', ''].includes(chat[messageId]?.mes)) return;

    const zero_prefill = extension_settings.NoAss.sets[extension_settings.NoAss.active_set_idx].zero_prefill;

    if (!chat[messageId].mes.startsWith(zero_prefill)) {
        chat[messageId].mes = zero_prefill + chat[messageId].mes;
        if (chat[messageId].swipes) {
            chat[messageId].swipes[chat[messageId].swipe_id] = chat[messageId].mes;
        }
        updateMessageBlock(messageId, chat[messageId]);
        await saveChat();
        eventSource.emit(event_types.MESSAGE_UPDATED, messageId);
    }
});

eventSource.makeFirst(event_types.STREAM_TOKEN_RECEIVED, (text) => {
    if (!extension_settings.NoAss.noass_is_enabled || !isChatCompletion()) return;
    clientStopStringHandler(text);
});

eventSource.makeFirst(event_types.MESSAGE_RECEIVED, async (messageId) => {
    if (!extension_settings.NoAss.noass_is_enabled || !isChatCompletion() || messageId === 0 || this_chid === undefined) return;
    if (clientStopStringTriggered) {
        chat[messageId].mes = removeAfterSubstring(chat[messageId].mes, cachedStopString);
        if (chat[messageId].swipes) {
            chat[messageId].swipes[chat[messageId].swipe_id] = chat[messageId].mes;
        }
        cachedStopString = undefined;
        clientStopStringTriggered = false;
        await saveChat();
    }
});

jQuery(async () => {
    $('#extensions_settings').append(await renderExtensionTemplateAsync(path, 'settings'));
    loadSettings();
    setupListeners();
    console.log(`${defaultExtPrefix} extension loaded`);
});
