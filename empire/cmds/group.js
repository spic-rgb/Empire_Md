const { cmd, commands } = require("../command");
const config = require('../../config');
const prefix = config.PREFIX;
const fs = require('fs');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson, saveConfig, Catbox, monospace } = require('../funcs');
const { writeFileSync } = require('fs');
const path = require('path');
const { warndb } = require("../../database/warn");
const { getAntilink, setAntilink, getUserWarns, addWarn, resetWarns } = require("../../database/antilink");
const { getAntiwordData, setAntiwordStatus, addAntiword, removeAntiword } = require("../../database/antiword");
const { getAntitagData, setAntitagStatus } = require("../../database/antitag");
const Welcome = require('../../database/welcome');
const Goodbye = require('../../database/goodbye');
const AntiDelete = require('../../database/antidelete');
const Chatbot = require('../../database/chatbot');
const AntiBot = require('../../database/antibot');

cmd({
    pattern: "antibot",
    desc: "Enable Antibot and set action (off/warn/delete/kick)",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { q, isGroup, isAdmins, reply }) => {

    if (!isGroup) return reply('❌ This command can only be used in groups!');
    if (!isAdmins) return reply('❌ You must be an admin to use this command!');
    const groupId = m.chat;

    if (!q) {
        const groupSettings = await AntiBot.findOne({ groupId });
        const antibotAction = groupSettings ? groupSettings.enabled : 'off';
        return reply(`*Current Antibot Action:* ${antibotAction.toUpperCase()}\n\nUse *antibot off/warn/delete/kick* to change it.`);
    }

    const action = q.toLowerCase();
    if (["off", "warn", "delete", "kick"].includes(action)) {
        await AntiBot.findOneAndUpdate(
            { groupId },
            { $set: { enabled: action !== 'off' } },
            { upsert: true }
        );
        return reply(`*Antibot action set to:* ${action.toUpperCase()}`);
    } else {
        return reply("*🫟 Example: .antibot off/warn/delete/kick*");
    }
});

cmd({
    on: "body"
}, async (conn, mek, m, { from, isGroup, sender, isAdmins, reply }) => {
    if (!isGroup) return;

    const groupId = m.chat;
    const groupSettings = await AntiBot.findOne({ groupId });
    const antibotAction = groupSettings ? (groupSettings.enabled ? 'warn' : 'off') : 'off';

    if (antibotAction === "off") return;

    const messageId = mek.key.id;
    if (!messageId || !messageId.startsWith("3EB")) return;

    if (!isAdmins) return reply("*_I'm not an admin, so I can't take action!_*");
    if (isAdmins) return;

    await conn.sendMessage(from, { delete: mek.key });

    const userWarnings = groupSettings.warnings.get(sender) || 0;

    switch (antibotAction) {
        case "kick":
            await conn.groupParticipantsUpdate(from, [sender], "remove");
            break;

        case "warn":
            groupSettings.warnings.set(sender, userWarnings + 1);
            await groupSettings.save();

            if (groupSettings.warnings.get(sender) >= 3) {
                groupSettings.warnings.delete(sender);
                await groupSettings.save();
                await conn.groupParticipantsUpdate(from, [sender], "remove");
            } else {
                return reply(`⚠️ @${sender.split("@")[0]}, warning ${groupSettings.warnings.get(sender)}/3! Bots are not allowed!`, { mentions: [sender] });
            }
            break;
    }
});



cmd({  
    pattern: "svcontact",  
    desc: "Save all group members' contacts as a VCF.",  
    category: "group",  
    filename: __filename
}, async (conn, mek, m, { from, isOwner, isGroup, reply }) => {
    try {
        if (!isOwner) return reply("❌ You are not the owner!");
        if (!isGroup) return reply("❌ This command can only be used in groups!");

        const groupMetadata = await conn.groupMetadata(from);
        let vCards = '';

        for (const participant of groupMetadata.participants) {
            const jid = participant.id;
            const name = await conn.getName(jid) || "Unknown";
            const phoneNumber = jid.split('@')[0];
            const formattedNumber = '+' + phoneNumber;

            const card = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nN:${name};;;\nTEL;TYPE=CELL:${formattedNumber}\nEND:VCARD\n`;
            vCards += card + '\n';
        }

        const vcfBuffer = Buffer.from(vCards, 'utf-8');
        await conn.sendMessage(from, {
            document: vcfBuffer,
            fileName: 'group_contacts.vcf',
            mimetype: 'text/vcard',
        }, { quoted: m });

        return reply("✅ Group contacts have been saved and sent as a vCard file.");
    } catch (error) {
        console.error("Error in svcontact command:", error);
        return reply("❌ Failed to save group contacts. Please try again later.");
    }
});


cmd({
    pattern: "chatbot",
    desc: "Enable or disable chatbot in a group.",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isOwner, args, reply }) => {
    if (!isGroup) return reply('❌ This command can only be used in groups!');
    if (!isOwner) return reply('❌ You need to be an owner to use this command!');

    let chatbotData = await Chatbot.findOne({ groupId: from });

    if (!args[0]) return reply('❌ Use: chatbot on/off');

    if (args[0].toLowerCase() === 'on') {
        if (chatbotData) {
            chatbotData.enabled = true;
            await chatbotData.save();
        } else {
            await Chatbot.create({ groupId: from, enabled: true });
        }
        return reply('✅ Chatbot has been enabled for this group!');
    } 

    if (args[0].toLowerCase() === 'off') {
        if (chatbotData) {
            chatbotData.enabled = false;
            await chatbotData.save();
        } else {
            await Chatbot.create({ groupId: from, enabled: false });
        }
        return reply('✅ Chatbot has been disabled for this group!');
    }

    reply('❌ Invalid option! Use: chatbot on/off');
});


cmd({
  pattern: "antidelete",
  desc: "Enable or disable anti-delete feature",
  category: "group",
  filename: __filename
}, async (conn, mek, m, { from, isOwner, isAdmins, args, reply }) => {
  if (!isOwner) return reply('❌ You must be an admin to use this command!');
  if (!args[0] || !['on', 'off'].includes(args[0].toLowerCase())) 
    return reply('❌ Use: .antidelete on / .antidelete off');

  const enabled = args[0].toLowerCase() === 'on';

  await AntiDelete.findOneAndUpdate(
    { chatId: from },
    { enabled },
    { upsert: true, new: true }
  );

  reply(`✅ Anti-Delete has been ${enabled ? 'enabled' : 'disabled'}!`);
});

cmd({
  pattern: "setwelcome",
  desc: "Set a custom welcome message",
  category: "group",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, isOwner, q, reply  }) => {
  if (!isGroup) return reply('❌ This command can only be used in groups!');
  if (!isOwner) return reply('❌ You must be an admin to use this command!');
  if (!q) return reply('❌ Provide a welcome message! Example: .setwelcome Welcome @user @pp, check group rules!');

  await Welcome.findOneAndUpdate(
    { groupId: from },
    { message: q, enabled: true },
    { upsert: true, new: true }
  );

  reply('✅ Welcome message has been updated!');
});

cmd({
  pattern: "setgoodbye",
  desc: "Set a custom goodbye message",
  category: "group",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, isOwner, q, reply }) => {
  if (!isGroup) return reply('❌ This command can only be used in groups!');
  if (!isOwner) return reply('❌ You must be an owner to use this command!');
  if (!q) return reply('❌ Provide a goodbye message! Example: .setgoodbye Goodbye @user @pp, we will miss you!');

  await Goodbye.findOneAndUpdate(
    { groupId: from },
    { message: q, enabled: true },
    { upsert: true, new: true }
  );

  reply('✅ Goodbye message has been updated!');
});

cmd({
  pattern: "goodbye",
  desc: "Enable or disable goodbye messages",
  category: "group",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, isOwner, args, reply }) => {
  if (!isGroup) return reply('❌ This command can only be used in groups!');
  if (!isOwner) return reply('❌ You must be an owner to use this command!');
  if (!args[0] || !['on', 'off'].includes(args[0].toLowerCase())) 
    return reply('❌ Use: .goodbye on / .goodbye off');

  const enabled = args[0].toLowerCase() === 'on';

  await Goodbye.findOneAndUpdate(
    { groupId: from },
    { enabled },
    { upsert: true, new: true }
  );

  reply(`✅ Goodbye messages ${enabled ? 'enabled' : 'disabled'}!`);
});

cmd({
  pattern: "welcome",
  desc: "Enable or disable welcome messages",
  category: "group",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, isOwner, args, reply }) => {
  if (!isGroup) return reply('❌ This command can only be used in groups!');
  if (!isOwner) return reply('❌ You must be an owner to use this command!');
  if (!args[0] || !['on', 'off'].includes(args[0].toLowerCase())) 
    return reply('❌ Use: .welcome on / .welcome off');

  const enabled = args[0].toLowerCase() === 'on';

  await Welcome.findOneAndUpdate(
    { groupId: from },
    { enabled },
    { upsert: true, new: true }
  );

  reply(`✅ Welcome messages ${enabled ? 'enabled' : 'disabled'}!`);
});



cmd({
    pattern: "antitag",
    desc: "Enable or disable anti-tagging in the group",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, args, reply }) => {
    if (!isGroup) return reply("❌ This command can only be used in groups!");
    if (!isAdmins) return reply("❌ You must be an admin to use this command!");

    const option = args[0]?.toLowerCase();
    if (!option) return reply("Use: antitag on/off");

    if (option === "on") {
        await setAntitagStatus(from, true);
        return reply("✅ Antitag is now enabled! Messages with excessive mentions will be deleted.");
    } 
    else if (option === "off") {
        await setAntitagStatus(from, false);
        return reply("❌ Antitag is now disabled!");
    } 
    else {
        return reply("❌ Invalid option! Use: antitag on/off");
    }
});

cmd({
    on: "body"
}, async (conn, mek, m, { from, body, isGroup, sender, reply }) => {
    if (!isGroup) return;

    let data = await getAntitagData(from);
    if (!data.enabled) return;

    // Detect mentions using regex (WhatsApp mentions usually start with '@')
    let mentionCount = (body.match(/@\d+/g) || []).length;

    if (mentionCount >= 3) {

        await conn.sendMessage(from, { delete: mek.key });
        return reply(`🚫 @${sender.split("@")[0]}, mentioning too many users (${mentionCount}) is not allowed in this group!`);
    }
});

cmd({
    pattern: "antiword",
    desc: "Enable, disable, or add restricted words",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, args, reply }) => {
    if (!isGroup) return reply("❌ This command can only be used in groups!");
    if (!isAdmins) return reply("❌ You must be an admin to use this command!");

    const option = args[0]?.toLowerCase();
    const word = args.slice(1).join(" ");

    if (!option) return reply("Use: antiword on/off <word>");

    if (option === "on") {
        await setAntiwordStatus(from, true);
        return reply("✅ Antiword is now enabled! Messages with restricted words will be deleted.");
    } 
    else if (option === "off") {
        await setAntiwordStatus(from, false);
        return reply("❌ Antiword is now disabled!");
    } 
    else if (word) {
        await addAntiword(from, option);
        return reply(`✅ Added: "${option}" to restricted words!`);
    } 
    else {
        return reply("❌ Invalid command! Use: antiword on/off <word>");
    }
});

cmd({
    on: "body"
}, async (conn, mek, m, { from, isGroup, sender, reply }) => {
    if (!isGroup) return;

    let data = await getAntiwordData(from);
    if (!data.enabled) return;

    for (let word of data.words) {
        if (m.body.toLowerCase().includes(word)) {
            await conn.sendMessage(from, { delete: mek.key });
            return reply(`🚫 @${sender.split("@")[0]}, bad words are not allowed here!`, { mentions: [sender] });
        }
    }
});

cmd({
    pattern: "antilink",
    desc: "Set anti-link mode (warn/delete/kick/off)",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { from, args, isGroup, isAdmins, reply }) => {
    if (!isGroup) return reply("❌ This command can only be used in groups!");
    if (!isAdmins) return reply("❌ You must be an admin to use this command!");

    const mode = args[0]?.toLowerCase();
    if (!["warn", "delete", "kick", "off"].includes(mode)) return reply("Use: antilink warn/delete/kick/off");

    await setAntilink(from, mode);
    return reply(`✅ Antilink mode is now set to *${mode}*`);
});

cmd({
    on: "body"
}, async (conn, mek, m, { from, body, isGroup, sender, isAdmins, reply }) => {
    if (!isGroup) return; // Works in groups only
    if (isAdmins) return; // Don't punish admins

    const mode = await getAntilink(from);
    if (mode === "off") return; // Antilink is disabled

    if (isUrl(body)) { // Check if the message contains a URL
        if (mode === "delete") {
            await conn.sendMessage(from, { delete: mek.key }).catch(() => {});
            return reply(`🚫 *${sender}*, links are not allowed!`);
        } 

        if (mode === "kick") {
            await conn.groupParticipantsUpdate(from, [sender], "remove").catch(() => {
                return reply("❌ I need admin rights to kick users.");
            });
            return reply(`🚫 *${sender}* has been kicked for posting a link!`);
        } 

        if (mode === "warn") {
            await addWarn(from, sender);
            let warns = await getUserWarns(from, sender);

            if (warns >= 3) {
                await conn.groupParticipantsUpdate(from, [sender], "remove").catch(() => {
                    return reply("❌ I need admin rights to kick users.");
                });
                await resetWarns(from, sender);
                return reply(`🚫 *${sender}* reached 3 warnings and was removed!`);
            } else {
                return reply(`⚠️ *${sender}*, links are not allowed! You now have *${warns}/3* warnings.`);
            }
        }
    }
});

cmd({
    pattern: "warn",
    desc: "Warn a user in private chat or group. Kicks after 3 warnings.",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { 
    from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, 
    botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, 
    participants, groupAdmins, isAdmins, reply 
}) => {
    try {
        if (isGroup && !isOwner && !isAdmins) return reply("❌ You are not authorized to use this command.");
        if (!quoted) return reply("❌ Please reply to the user you want to warn.");

        const target = quoted.participant || quoted.remoteJid || quoted.sender || null;
        if (!target) return reply("❌ Could not find the user!");

        const chatType = isGroup ? from : "Private Chat";
        const reason = q ? q : "No Reason";

        let warnData = await warndb.findOne({ id: target, group: chatType });
        if (!warnData) {
            warnData = new warndb({ id: target, reason, group: chatType, warnedby: sender, warnCount: 1 });
        } else {
            warnData.reason = reason;
            warnData.warnedby = sender;
            warnData.warnCount += 1;
        }

        await warnData.save();

        let warnCount = warnData.warnCount;
        reply(`⚠️ @${target.split("@")[0]} has been warned!\nReason: ${reason}\nTotal Warnings: ${warnCount}`);

        if (warnCount >= 3) {
            if (isGroup) {
                await conn.groupParticipantsUpdate(from, [target], "remove");
                reply(`❌ @${target.split("@")[0]} has been removed from the group due to excessive warnings.`);
            } else {
                await conn.updateBlockStatus(target, "block");
                reply(`❌ @${target.split("@")[0]} has been blocked due to excessive warnings.`);
            }
            await warndb.deleteMany({ id: target, group: chatType });
        }
    } catch (error) {
        console.error(error);
        reply("❌ An error occurred while processing the warn command.");
    }
});

cmd({
    pattern: "checkwarn",
    desc: "Check the warning count of a user.",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { 
    from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, 
    botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, 
    participants, groupAdmins, isAdmins, reply 
}) => {
    try {
        if (!quoted) return reply("❌ Please reply to the user whose warnings you want to check.");

        const target = quoted.participant || quoted.remoteJid || quoted.sender || null;
        if (!target) return reply("❌ Could not find the user!");

        const chatType = isGroup ? from : "Private Chat";

        let warnData = await warndb.findOne({ id: target, group: chatType });
        if (!warnData) return reply(`✅ @${target.split("@")[0]} has **0 warnings**.`);

      return reply(`⚠️ @${target.split("@")[0]} has **${warnData.warnCount} warnings**.\nReason: ${warnData.reason}\nWarned by: @${warnData.warnedby.split("@")[0]}`);
    } catch (error) {
        console.error(error);
        reply("❌ An error occurred while checking the warnings.");
    }
});

cmd({
    pattern: "resetwarn",
    desc: "Reset a user's warnings.",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { 
    from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, 
    botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, 
    participants, groupAdmins, isAdmins, reply 
}) => {
    try {
        if (!isOwner && !isAdmins) return reply("❌ You are not authorized to use this command.");
        if (!quoted) return reply("❌ Please reply to the user whose warnings you want to reset.");

        const target = quoted.participant || quoted.remoteJid || quoted.sender || null;
        if (!target) return reply("❌ Could not find the user!");

        const chatType = isGroup ? from : "Private Chat";

        let warnData = await warndb.findOne({ id: target, group: chatType });
        if (!warnData) return reply(`✅ @${target.split("@")[0]} has no warnings.`);

        await warndb.deleteMany({ id: target, group: chatType });
   return reply(`✅ @${target.split("@")[0]}'s warnings have been reset.`);
    } catch (error) {
        console.error(error);
        reply("❌ An error occurred while resetting the warnings.");
    }
});
//--------------------------------------------
// ACCEPT_ALL COMMANDS
//--------------------------------------------
cmd({
  pattern: "acceptall",
  category: "group",
  desc: "Accept all participant requests in the group.",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, body, sender, groupMetadata, participants, config, reply }) => {
  try {
    if (!isGroup) {
      return reply("This command can only be used in groups.");
    }

    const jid = from; // Group ID (from the message)
    const groupParticipants = groupMetadata.participants; // List of participants in the group

    const pendingRequests = groupParticipants.filter(p => p.isPending); // Filter pending participants

    if (pendingRequests.length === 0) {
      return reply("No pending participants to accept.");
    }

    const userJids = pendingRequests.map(p => p.id); // Get JIDs of the pending participants

    const response = await conn.groupRequestParticipantsUpdate(jid, userJids, 'approve');
    console.log(response);
    reply(`${userJids.length} participant(s) have been accepted.`);
  } catch (e) {
    return reply(`*An error occurred while processing your request.*\n\n_Error:_ ${e.message}`);
  }
});
//--------------------------------------------
// REJECT_ALL COMMANDS
//--------------------------------------------
cmd({
  pattern: "rejectall",
  category: "group",
  desc: "Reject all participant requests in the group.",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, body, sender, groupMetadata, participants, config, reply }) => {
  try {
    if (!isGroup) {
      return reply("This command can only be used in groups.");
    }

    const jid = from; // Group ID (from the message)
    const groupParticipants = groupMetadata.participants; // List of participants in the group

    const pendingRequests = groupParticipants.filter(p => p.isPending); // Filter pending participants

    if (pendingRequests.length === 0) {
      return reply("No pending participants to reject.");
    }

    const userJids = pendingRequests.map(p => p.id); // Get JIDs of the pending participants

    const response = await conn.groupRequestParticipantsUpdate(jid, userJids, 'reject');
    console.log(response);
    reply(`${userJids.length} participant(s) have been rejected.`);
  } catch (e) {
    return reply(`*An error occurred while processing your request.*\n\n_Error:_ ${e.message}`);
  }
});
//--------------------------------------------
//  ANTILINK COMMANDS
//--------------------------------------------


//--------------------------------------------
//   DELETE COMMANDS
//--------------------------------------------
cmd({
    pattern: "delete",
    desc: "Delete a quoted message.",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { from, quoted, isOwner, isAdmins, reply }) => {
    try {
        if (!isOwner && !isAdmins) return reply("❌ You are not authorized to use this command.");
        if (!quoted) return reply("❌ Please reply to the message you want to delete.");

        const key = {
            remoteJid: from,
            fromMe: quoted.fromMe,
            id: quoted.id,
            participant: quoted.sender,
        };

        await conn.sendMessage(from, { delete: key });
    } catch (e) {
        console.log(e);
        reply("❌ Error deleting the message.");
    }
});
//--------------------------------------------
//   POLL COMMANDS
//--------------------------------------------
cmd({
  pattern: "poll",
  category: "group",
  desc: "Create a poll with a question and options in the group.",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, body, sender, groupMetadata, participants, prefix, pushname, reply }) => {
  try {
    let [question, optionsString] = body.split(";");

    if (!question || !optionsString) {
      return reply(`Usage: ${prefix}poll question;option1,option2,option3...`);
    }

    let options = [];
    for (let option of optionsString.split(",")) {
      if (option && option.trim() !== "") {
        options.push(option.trim());
      }
    }

    if (options.length < 2) {
      return reply("*Please provide at least two options for the poll.*");
    }

    await conn.sendMessage(from, {
      poll: {
        name: question,
        values: options,
        selectableCount: 1,
        toAnnouncementGroup: true,
      }
    }, { quoted: mek });
  } catch (e) {
    return reply(`*An error occurred while processing your request.*\n\n_Error:_ ${e.message}`);
  }
});
//--------------------------------------------
// RANDOM SHIP COMMANDS
//--------------------------------------------
cmd({
    pattern: "ship",
    desc: "Randomly ship two members in a group.",
    category: "group",
    react: "💞",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, participants, reply }) => {
    try {
        if (!isGroup) return reply("❌ This command can only be used in groups!");

        const members = participants.filter(p => !p.admin); // Exclude admins if needed
        if (members.length < 2) return reply("❌ Not enough members to ship!");

        const shuffled = members.sort(() => Math.random() - 0.5);
        const user1 = shuffled[0].id;
        const user2 = shuffled[1].id;

        reply(`💖 I randomly ship @${user1.split("@")[0]} & @${user2.split("@")[0]}! Cute couple! 💞`, {
            mentions: [user1, user2]
        });

    } catch (e) {
        console.error(e);
        reply("❌ Error processing command.");
    }
});
//--------------------------------------------
//  NEW_GC COMMANDS
//--------------------------------------------
cmd({
  pattern: "newgc",
  category: "group",
  desc: "Create a new group and add participants.",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, body, sender, groupMetadata, participants, reply }) => {
  try {
    if (!body) {
      return reply(`Usage: !newgc group_name;number1,number2,...`);
    }

    const [groupName, numbersString] = body.split(";");

    if (!groupName || !numbersString) {
      return reply(`Usage: !newgc group_name;number1,number2,...`);
    }

    const participantNumbers = numbersString.split(",").map(number => `${number.trim()}@s.whatsapp.net`);

    const group = await conn.groupCreate(groupName, participantNumbers);
    console.log('created group with id: ' + group.id); // Use group.id here

    const inviteLink = await conn.groupInviteCode(group.id); // Use group.id to get the invite link

    await conn.sendMessage(group.id, { text: 'hello there' });

    reply(`Group created successfully with invite link: https://chat.whatsapp.com/${inviteLink}\nWelcome message sent.`);
  } catch (e) {
    return reply(`*An error occurred while processing your request.*\n\n_Error:_ ${e.message}`);
  }
});
//--------------------------------------------
//  JOIN COMMANDS
//--------------------------------------------
cmd({
    pattern: "join",                // Command pattern
    desc: "Joins a group by link",  // Command description
    category: "group",              // Already group
    filename: __filename     // Current file reference
}, async (conn, mek, m, { from, quoted, body, args, q, isOwner, reply }) => {
    try {
        // Check if the command is being used by the owner
        if (!isOwner) return reply("𝐓𝐡𝐢𝐬 𝐂𝐨𝐦𝐦𝐚𝐧𝐝 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐌𝐲 𝐎𝐰𝐧𝐞𝐫 ⚠️");

        // Check if the URL is provided
        if (!args[0]) return reply("Please provide a valid WhatsApp group link.");

        // Validate if the link contains "whatsapp.com"
        const groupLink = args[0];
        if (!groupLink.includes("whatsapp.com")) {
            return reply("Invalid link. Please provide a valid WhatsApp group link.");
        }

        // Extract the invite code from the link
        const inviteCode = groupLink.split("https://chat.whatsapp.com/")[1];
        if (!inviteCode) {
            return reply("Invalid link format. Make sure it's a full WhatsApp invite link.");
        }

        // Attempt to join the group using the extracted invite code
        await conn.groupAcceptInvite(inviteCode)
            .then(() => reply("𝐃𝐨𝐧𝐞 ✓"))
            .catch((err) => {
                console.error("Error joining group:", err);
                reply("❌ Failed to join the group. Please ensure the link is correct or the group is open to invites.");
            });

    } catch (e) {
        console.error("Error in join command:", e);
        reply("An unexpected error occurred while trying to join the group.");
    }
});
//--------------------------------------------
//  LIST_REQUEST COMMANDS
//--------------------------------------------
cmd({
  pattern: "listrequest",
  category: "group",
  desc: "List all pending participant requests in the group.",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, body, sender, groupMetadata, participants, config, reply }) => {
  try {
    if (!isGroup) {
      return reply("This command can only be used in groups.");
    }

    const jid = from; // Group ID (from the message)

    const response = await conn.groupRequestParticipantsList(jid);
    console.log(response);

    if (response.length === 0) {
      return reply("No pending participant requests in this group.");
    }

    const pendingUsers = response
      .map((user) => user.id.split('@')[0]) // Extract the phone number part from the JID
      .join('\n'); // List of pending participants' phone numbers

    return reply(`Pending participant requests:\n${pendingUsers}`);
  } catch (e) {
    return reply(`*An error occurred while processing your request.*\n\n_Error:_ ${e.message}`);
  }
});
//--------------------------------------------
//  EXIT COMMANDS
//--------------------------------------------
cmd({
  pattern: "exit",
  desc: "Leaves the current group",
  category: "group",
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  try {
    // `from` is the group chat ID
    await conn.groupLeave(from);
    reply("Successfully left the group🙂.");
  } catch (error) {
    console.error(error);
    reply("Failed to leave the group.🤦🏽‍♂️");
  }
});
//--------------------------------------------
//   KICK COMMANDS
//--------------------------------------------
cmd({
  pattern: "kick",
  desc: "Kicks replied/quoted user from group.",
  category: "group",
  filename: __filename
}, async (conn, mek, m, { 
  from, quoted, args, isGroup, isBotAdmins, isAdmins, reply 
}) => {
  if (!isGroup) {
    return reply("This command can only be used in groups.");
  }

  if (!isAdmins) {
    return reply("Only group admins can use this command.");
  }

  if (!isBotAdmins) {
    return reply("I need to be an admin to perform this action.");
  }

  try {
    let users = quoted 
      ? quoted.sender 
      : args[0] 
        ? args[0].includes("@") 
          ? args[0].replace(/[@]/g, "") + "@s.whatsapp.net" 
          : args[0] + "@s.whatsapp.net" 
        : null;

    if (!users) {
      return reply("Please reply to a message or provide a valid number.");
    }

    await conn.groupParticipantsUpdate(from, [users], "remove");
    reply("User has been removed from the group successfully.");
  } catch (error) {
    console.error("Error kicking user:", error);
    reply("Failed to remove the user. Ensure I have the necessary permissions.");
  }
});
//--------------------------------------------
//    ADD COMMANDS
//--------------------------------------------
cmd({
    pattern: "add",
    desc: "Adds a user to the group.",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        // Check if the command is used in a group
        if (!isGroup) return reply("This command is only for groups.");

        // Check if the bot has admin privileges
        if (!isBotAdmins) return reply("I need admin privileges to add users.");

        // Ensure an argument (phone number) is provided
        if (!q || isNaN(q)) return reply("Please provide a valid phone number to add.");

        const userToAdd = `${q}@s.whatsapp.net`;  // Format the phone number

        // Check if the user is already in the group
        if (participants.some(participant => participant.id === userToAdd)) {
            return reply("The user is already in the group.");
        }

        // Add the user to the group
        await conn.groupParticipantsUpdate(from, [userToAdd], "add");

        // Confirm the addition
        reply(`Successfully added user: ${q}`);
    } catch (e) {
        console.error('Error adding user:', e);
        reply('An error occurred while adding the user. Please make sure the number is correct and they are not already in the group.');
    }
});
//--------------------------------------------
//   MUTE COMMANDS
//--------------------------------------------
cmd({
    pattern: "mute",
    alias: ["silence"],
    desc: "Mute all group members.",
    category: "group", // Already group
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, args, q, isGroup, sender, reply }) => {
    try {
        // Ensure this is being used in a group
        if (!isGroup) return reply("𝐓𝐡𝐢𝐬 𝐅𝐞𝐚𝐭𝐮𝐫𝐞 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐆𝐫𝐨𝐮𝐩❗");

        // Get the sender's number
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];

        // Check if the bot is an admin
        const groupMetadata = isGroup ? await conn.groupMetadata(from) : '';
        const groupAdmins = groupMetadata ? groupMetadata.participants.filter(member => member.admin) : [];
        const isBotAdmins = isGroup ? groupAdmins.some(admin => admin.id === botNumber + '@s.whatsapp.net') : false;

        if (!isBotAdmins) return reply("𝐏𝐥𝐞𝐚𝐬𝐞 𝐏𝐫𝐨𝐯𝐢𝐝𝐞 𝐌𝐞 𝐀𝐝𝐦𝐢𝐧 𝐑𝐨𝐥𝐞 ❗");

        // Check if the sender is an admin
        const isAdmins = isGroup ? groupAdmins.some(admin => admin.id === sender) : false;
        if (!isAdmins) return reply("𝐏𝐥𝐞𝐚𝐬𝐞 𝐏𝐫𝐨𝐯𝐢𝐝𝐞 𝐌𝐞 𝐀𝐝𝐦𝐢𝐧 𝐑𝐨𝐥𝐞 ❗");

        // Mute all participants
        await conn.groupSettingUpdate(from, 'announcement');  // This mutes the group (only admins can send messages)

        // Send confirmation reply
        return reply("All members have been muted successfully.");

    } catch (error) {
        console.error("Error in mute command:", error);
        reply(`An error occurred: ${error.message || "Unknown error"}`);
    }
});
//--------------------------------------------
//   UNMUTE COMMANDS
//--------------------------------------------
cmd({
    pattern: "unmute",
    alias: ["unsilence"],
    desc: "Unmute all group members.",
    category: "group", // Already group
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, args, q, isGroup, sender, reply }) => {
    try {
        // Ensure this is being used in a group
        if (!isGroup) return reply("𝐓𝐡𝐢𝐬 𝐅𝐞𝐚𝐭𝐮𝐫𝐞 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐆𝐫𝐨𝐮𝐩❗");

        // Get the sender's number
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];

        // Check if the bot is an admin
        const groupMetadata = isGroup ? await conn.groupMetadata(from) : '';
        const groupAdmins = groupMetadata ? groupMetadata.participants.filter(member => member.admin) : [];
        const isBotAdmins = isGroup ? groupAdmins.some(admin => admin.id === botNumber + '@s.whatsapp.net') : false;

        if (!isBotAdmins) return reply("𝐏𝐥𝐞𝐚𝐬𝐞 𝐏𝐫𝐨𝐯𝐢𝐝𝐞 𝐌𝐞 𝐀𝐝𝐦𝐢𝐧 𝐑𝐨𝐥𝐞 ❗");

        // Check if the sender is an admin
        const isAdmins = isGroup ? groupAdmins.some(admin => admin.id === sender) : false;
        if (!isAdmins) return reply("𝐏𝐥𝐞𝐚𝐬𝐞 𝐏𝐫𝐨𝐯𝐢𝐝𝐞 𝐌𝐞 𝐀𝐝𝐦𝐢𝐧 𝐑𝐨𝐥𝐞 ❗");

        // Unmute all participants
        await conn.groupSettingUpdate(from, 'not_announcement');  // This unmutes the group (everyone can send messages)

        // Send confirmation reply
        return reply("All members have been unmuted successfully.");

    } catch (error) {
        console.error("Error in unmute command:", error);
        reply(`An error occurred: ${error.message || "Unknown error"}`);
    }
});
//--------------------------------------------
//  PROMOTE COMMANDS
//--------------------------------------------
cmd({
  pattern: "promote",
  desc: "Provides admin role to replied/quoted user",
  category: "group",
  filename: __filename,
  use: "<quote|reply|number>"
}, async (conn, mek, m, { 
  from, quoted, args, isGroup, sender, botNumber, groupAdmins, isBotAdmins, isAdmins, reply 
}) => {
  if (!isGroup) {
    return reply("This command can only be used in groups.");
  }

  if (!isAdmins) {
    return reply("Only group admins can use this command.");
  }

  if (!isBotAdmins) {
    return reply("I need to be an admin to perform this action.");
  }

  try {
    let users = quoted 
      ? quoted.sender 
      : args[0] 
        ? args[0].includes("@") 
          ? args[0].replace(/[@]/g, "") + "@s.whatsapp.net" 
          : args[0] + "@s.whatsapp.net" 
        : null;

    if (!users) {
      return reply("Please reply to a message or provide a valid number.");
    }

    await conn.groupParticipantsUpdate(from, [users], "promote");
    reply("User has been promoted to admin successfully.");
  } catch (error) {
    console.error("Error promoting user:", error);
    reply("Failed to promote the user. Ensure I have the necessary permissions.");
  }
});
//--------------------------------------------
//  DEMOTE COMMANDS
//--------------------------------------------
cmd({
  pattern: "demote",
  desc: "Demotes replied/quoted user from admin role in the group.",
  category: "group",
  filename: __filename,
  use: "<quote|reply|number>"
}, async (conn, mek, m, { 
  from, quoted, args, isGroup, sender, botNumber, groupAdmins, isBotAdmins, isAdmins, reply 
}) => {

  if (!isGroup) {
    return reply("This command can only be used in groups.");
  }

  if (!isAdmins) {
    return reply("Only group admins can use this command.");
  }

  if (!isBotAdmins) {
    return reply("I need to be an admin to perform this action.");
  }

  try {
    let users = quoted 
      ? quoted.sender 
      : args[0] 
        ? args[0].includes("@") 
          ? args[0].replace(/[@]/g, "") + "@s.whatsapp.net" 
          : args[0] + "@s.whatsapp.net" 
        : null;

    if (!users) {
      return reply("Please reply to a message or provide a valid number.");
    }

    await conn.groupParticipantsUpdate(from, [users], "demote");
    reply("User has been demoted from admin successfully.");
  } catch (error) {
    console.error("Error demoting user:", error);
    reply("Failed to demote the user. Ensure I have the necessary permissions.");
  }
});
//--------------------------------------------
//  TAG COMMANDS
//--------------------------------------------
cmd({
    pattern: "tag",
    category: "group",
    desc: "Tags every person in the group without showing the sender's name.",
    filename: __filename,
}, async (conn, mek, m, { 
    from, 
    quoted, 
    body, 
    isCmd, 
    command, 
    args, 
    q, 
    isGroup, 
    sender, 
    senderNumber, 
    botNumber, 
    pushname, 
    groupMetadata, 
    participants, 
    groupAdmins, 
    isBotAdmins, 
    isAdmins, 
    reply
}) => {
    try {
        if (!isGroup) return reply("𝐓𝐡𝐢𝐬 𝐅𝐞𝐚𝐭𝐮𝐫𝐞 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐆𝐫𝐨𝐮𝐩❗");

        // If no message is provided, prompt the user to use the correct format
        if (args.length === 0) {
            return reply(`📜 *Use:* \n\n${prefix}tag <your message>`);
        }

        // Fetch group metadata to ensure participants are up-to-date
        groupMetadata = await conn.groupMetadata(from);
        participants = groupMetadata.participants;

        // Get the message after the command (hidetag)
        const message = args.join(' ');

        // Send the message with mentions
        await conn.sendMessage(from, {
            text: `${message}`, // Send the message to tag everyone
            mentions: participants.map(a => a.id), // Mentions all participants
        }, { quoted: mek });

    } catch (e) {
        console.error(e);
        reply("🚨 *An error occurred while trying to tag all members.*");
    }
});
//--------------------------------------------
//  TAG_ALL COMMANDS
//--------------------------------------------
cmd({
    pattern: "tagall",
    category: "group",
    desc: "Tags every person in the group.",
    filename: __filename,
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber, pushname, groupMetadata, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!isGroup) return reply("𝐓𝐡𝐢𝐬 𝐅𝐞𝐚𝐭𝐮𝐫𝐞 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐆𝐫𝐨𝐮𝐩❗");

        let textt = `
╭───「 𝙴𝙼𝙿𝙸𝚁𝙴-𝙼𝙳 」───◆  
│ ∘ 𝙼𝚎𝚜𝚜𝚊𝚐𝚎: ${args.join(' ') || "blank"}  
│ ∘ 𝙰𝚞𝚝𝚑𝚘𝚛: ${pushname}  
│ ∘ 𝙼𝚎𝚖𝚋𝚎𝚛𝚜: ${participants.length}  
│ ∘ ─────────────────
`;

        // Loop through participants and format mentions
        for (let mem of participants) {
            textt += `│ ∘  @${mem.id.split('@')[0]}\n`;
        }

        // Send the message with mentions
        await conn.sendMessage(from, {
            text: textt,
            mentions: participants.map(a => a.id),
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply("An error occurred while trying to tag all members.");
    }
});
//--------------------------------------------
//  HIDE_TAG COMMANDS
//--------------------------------------------
cmd({
    pattern: "hidetag",
    category: "group",
    desc: "Tags every person in the group without showing the sender's name.",
    filename: __filename,
}, async (conn, mek, m, { 
    from, 
    quoted, 
    body, 
    isCmd, 
    command, 
    args, 
    q, 
    isGroup, 
    sender, 
    senderNumber, 
    botNumber, 
    pushname, 
    groupMetadata, 
    participants, 
    groupAdmins, 
    isBotAdmins, 
    isAdmins, 
    reply
}) => {
    try {
        if (!isGroup) return reply("𝐓𝐡𝐢𝐬 𝐅𝐞𝐚𝐭𝐮𝐫𝐞 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐆𝐫𝐨𝐮𝐩❗");

        // If no message is provided, prompt the user to use the correct format
        if (args.length === 0) {
            return reply(`📜 *Use:* \n\n${prefix}hidetag <your message>`);
        }

        // Fetch group metadata to ensure participants are up-to-date
        groupMetadata = await conn.groupMetadata(from);
        participants = groupMetadata.participants;

        // Get the message after the command (hidetag)
        const message = args.join(' ');

        // Send the message with mentions
        await conn.sendMessage(from, {
            text: `${message}`, // Send the message to tag everyone
            mentions: participants.map(a => a.id), // Mentions all participants
        }, { quoted: mek });

    } catch (e) {
        console.error(e);
        reply("🚨 *An error occurred while trying to tag all members.*");
    }
});
//--------------------------------------------
// TAG_ADMIN COMMANDS
//--------------------------------------------
cmd({
    pattern: "tagadmin",
    category: "group",
    desc: "Tags every admin in the group.",
    filename: __filename,
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber, pushname, groupMetadata, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!isGroup) return reply("𝐓𝐡𝐢𝐬 𝐅𝐞𝐚𝐭𝐮𝐫𝐞 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐆𝐫𝐨𝐮𝐩❗");

        // Filter out non-admins
        let adminParticipants = participants.filter(mem => groupAdmins.includes(mem.id));

        if (adminParticipants.length === 0) {
            return reply("No admins found to tag.");
        }

        let textt = `
╭───「 𝙴𝙼𝙿𝙸𝚁𝙴-𝙼𝙳 」───◆  
│ ∘ 𝙼𝚎𝚜𝚜𝚊𝚐𝚎: ${args.join(' ') || "blank"}  
│ ∘ 𝙰𝚞𝚝𝚑𝚘𝚛: ${pushname}  
│ ∘ 𝙰𝚍𝚖𝚒𝚗𝚜: ${adminParticipants.length}  
│ ∘ ─────────────────
`;

        // Loop through admin participants and format mentions
        for (let mem of adminParticipants) {
            textt += `│ ∘  @${mem.id.split('@')[0]}\n`;
        }

        // Send the message with mentions
        await conn.sendMessage(from, {
            text: textt,
            mentions: adminParticipants.map(a => a.id),
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply("An error occurred while trying to tag the admins.");
    }
});
//--------------------------------------------
//  INVITE COMMANDS
//--------------------------------------------
cmd({
    pattern: "invite",
    alias: ["glink"],
    desc: "Get group invite link.",
    category: "group", // Already group
    filename: __filename,
}, async (conn, mek, m, { from, quoted, body, args, q, isGroup, sender, reply }) => {
    try {
        // Ensure this is being used in a group
        if (!isGroup) return reply("𝐓𝐡𝐢𝐬 𝐅𝐞𝐚𝐭𝐮𝐫𝐞 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐆𝐫𝐨𝐮𝐩❗");

        // Get the sender's number
        const senderNumber = sender.split('@')[0];
        const botNumber = conn.user.id.split(':')[0];

        // Check if the bot is an admin
        const groupMetadata = isGroup ? await conn.groupMetadata(from) : '';
        const groupAdmins = groupMetadata ? groupMetadata.participants.filter(member => member.admin) : [];
        const isBotAdmins = isGroup ? groupAdmins.some(admin => admin.id === botNumber + '@s.whatsapp.net') : false;

        if (!isBotAdmins) return reply("𝐏𝐥𝐞𝐚𝐬𝐞 𝐏𝐫𝐨𝐯𝐢𝐝𝐞 𝐌𝐞 𝐀𝐝𝐦𝐢𝐧 𝐑𝐨𝐥𝐞 ❗");

        // Check if the sender is an admin
        const isAdmins = isGroup ? groupAdmins.some(admin => admin.id === sender) : false;
        if (!isAdmins) return reply("𝐏𝐥𝐞𝐚𝐬𝐞 𝐏𝐫𝐨𝐯𝐢𝐝𝐞 𝐌𝐞 𝐀𝐝𝐦𝐢𝐧 𝐑𝐨𝐥𝐞 ❗");

        // Get the invite code and generate the link
        const inviteCode = await conn.groupInviteCode(from);
        if (!inviteCode) return reply("Failed to retrieve the invite code.");

        const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

        // Reply with the invite link
        return reply(`*Here is your group invite link:*\n${inviteLink}`);

    } catch (error) {
        console.error("Error in invite command:", error);
        reply(`An error occurred: ${error.message || "Unknown error"}`);
    }
});
//--------------------------------------------
//  GJID COMMANDS
//--------------------------------------------
cmd({
    pattern: "gjid",
    desc: "Get the list of JIDs and names for all groups the bot is part of.",
    category: "group",
    react: "📝",
    filename: __filename,
}, async (conn, mek, m, { from, isOwner, reply }) => {
    if (!isOwner) return reply("𝐓𝐡𝐢𝐬 𝐂𝐨𝐦𝐦𝐚𝐧𝐝 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐌𝐲 𝐎𝐰𝐧𝐞𝐫 ⚠️");

    try {
        // Fetch all groups the bot is part of
        const groups = await conn.groupFetchAllParticipating();

        if (!Object.keys(groups).length) {
            return reply("I am not part of any groups yet.");
        }

        // Prepare the list of groups with names and JIDs
        let groupList = "📝 *Group Names and JIDs:*\n\n";
        for (const jid in groups) {
            const group = groups[jid];
            groupList += `📌 *Name:* ${group.subject}\n🆔 *JID:* ${jid}\n\n`;
        }

        // Send the formatted group list
        reply(groupList);
    } catch (err) {
        console.error(err);
        reply("An error occurred while fetching group information.");
    }
});
//--------------------------------------------
// UPDATE_GNAME COMMANDS
//--------------------------------------------
cmd({
    pattern: "updategname",
    alias: ["upgname","gname"],
    desc: "To Change the group name",
    category: "group",
    use: '.updategname',
    filename: __filename
},
async(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins , isAdmins, reply}) => {
try{

if (!isGroup) return reply('This command can only be used in a group.')
        if (!isBotAdmins) return reply('Bot must be an admin to use this command.')
        if (!isAdmins) return reply('You must be an admin to use this command.')

if (!q) return reply("🖊️ *Please write the new Group Subject*")
await conn.groupUpdateSubject(from, q )
 await conn.sendMessage(from , { text: `✔️ *Group name Updated*` }, { quoted: mek } )
} catch (e) {
reply('*Error !!*')
l(e)
}
});
//--------------------------------------------
// UPDATE_GDESC COMMANDS
//--------------------------------------------
cmd({
    pattern: "updategdesc",
    react: "🔓",
    alias: ["upgdesc", "gdesc"],
    desc: "To change the group description",
    category: "group",
    use: ".updategdesc",
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, args, q, isGroup, sender, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!isGroup) {
            return reply("🚫 *This is a group-only command*");
        }
        if (!isBotAdmins) {
            return reply("🚫 *Bot must be an admin first*");
        }
        if (!isAdmins) {
            return reply("🚫 *You must be an admin to use this command*");
        }
        if (!q) {
            return reply("🖊️ *Please provide the new group description*");
        }

        await conn.groupUpdateDescription(from, q);
        await conn.sendMessage(from, { text: `✔️ *Group description updated successfully!*` }, { quoted: mek });
    } catch (e) {
        console.error(e);
        reply("*Error: Unable to update group description!*");
    }
});
//--------------------------------------------
//  REVOKE COMMANDS
//--------------------------------------------
cmd({
    pattern: "revoke",
    react: "🖇️",
    alias: ["resetglink"],
    desc: "To reset the group link",
    category: "group",
    use: ".revoke",
    filename: __filename
}, async (conn, mek, m, { from, quoted, isGroup, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!isGroup) {
            return reply("🚫 *This is a group-only command*");
        }
        if (!isBotAdmins) {
            return reply("🚫 *Bot must be an admin first*");
        }
        if (!isAdmins) {
            return reply("🚫 *You must be an admin to use this command*");
        }

        // Revoke the group invite link
        await conn.groupRevokeInvite(from);
        await conn.sendMessage(from, { text: `⛔ *Group link has been reset successfully!*` }, { quoted: mek });
    } catch (e) {
        console.error(e);
        reply("*Error: Unable to reset the group link!*");
    }
});
//--------------------------------------------
//  GINFO COMMANDS
//--------------------------------------------
cmd({
    pattern: "ginfo",
    desc: "Get group information.",
    category: "group",
    filename: __filename,
}, async (conn, mek, m, { from, quoted, body, args, q, isGroup, sender, reply }) => {
    try {
        if (!isGroup) return reply("𝐓𝐡𝐢𝐬 𝐅𝐞𝐚𝐭𝐮𝐫𝐞 𝐈𝐬 𝐎𝐧𝐥𝐲 𝐅𝐨𝐫 𝐆𝐫𝐨𝐮𝐩❗");

        // Get group metadata
        const groupMetadata = await conn.groupMetadata(from);
        const groupName = groupMetadata.subject;
        const groupAdmins = groupMetadata.participants.filter(member => member.admin);
        const memberCount = groupMetadata.participants.length;
        const adminList = groupAdmins.map(admin => `│ ∘  @${admin.id.split('@')[0]}`).join("\n") || "│ ∘ No admins";

        // Format the output
        let textt = `
╭───「 𝙴𝙼𝙿𝙸𝚁𝙴-𝙼𝙳 」───◆  
│ ∘ 𝙶𝚛𝚘𝚞𝚙: ${groupName}  
│ ∘ 𝙶𝚛𝚘𝚞𝚙 𝙸𝙳: ${from}  
│ ∘ 𝚃𝚘𝚝𝚊𝚕 𝙼𝚎𝚖𝚋𝚎𝚛𝚜: ${memberCount}  
│ ∘ ─────────────────  
${adminList}
`;

        // Send the group information
        await conn.sendMessage(from, {
            text: textt,
            mentions: groupAdmins.map(a => a.id),
        }, { quoted: mek });

    } catch (error) {
        console.error("Error in ginfo command:", error);
        reply("An error occurred while retrieving the group information.");
    }
});

cmd({
    pattern: "lockgcs",
    desc: "Change to group settings to only admins can edit group info",
    category: "group",
    use: '.lockgs',
    filename: __filename
},
async(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isCreator ,isDev, isAdmins, reply}) => {
try{
if (!isGroup) return reply('🚫 *This is Group Command*')
if (!isBotAdmins) return reply('🚫 *Bot must be Admin frist*')
if (!isAdmins) return reply('🚫 *You must be admin frist*') 
await conn.groupSettingUpdate(from, 'locked')
 await conn.sendMessage(from , { text: `🔒 *Group settings Locked*` }, { quoted: mek } )
} catch (e) {
reply('*Error !!*')
l(e)
}
});

//allow everyone to modify the group's settings -- like display picture etc.
//await sock.groupSettingUpdate("abcd-xyz@g.us", 'unlocked')

cmd({
    pattern: "unlockgcs",
    react: "🔓",
    desc: "Change to group settings to all members can edit group info",
    category: "group",
    use: '.unlockgs',
    filename: __filename
},
async(conn, mek, m,{from, l, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isCreator ,isDev, isAdmins, reply}) => {
try{
if (!isGroup) return reply('🚫 *This is Group command*')
if (!isBotAdmins) return reply('🚫 *Bot must be Admin frist*')
if (!isAdmins) return reply('🚫 *You must be admin frist*')
await conn.groupSettingUpdate(from, 'unlocked')
 await conn.sendMessage(from , { text: `🔓 *Group settings Unlocked*` }, { quoted: mek } )
} catch (e) {
reply('*Error !!*')
l(e)
}
});
//--------------------------------------------
//           BROADCAST COMMANDS
//--------------------------------------------
cmd({
  pattern: "broadcast",
  category: "group",
  desc: "Bot makes a broadcast in all groups",
  filename: __filename,
  use: "<text for broadcast.>"
}, async (conn, mek, m, { q, isGroup, isAdmins, reply }) => {
  try {
    if (!isGroup) return reply("❌ This command can only be used in groups!");
    if (!isAdmins) return reply("❌ You need to be an admin to broadcast in this group!");

    if (!q) return reply("❌ Provide text to broadcast in all groups!");

    let allGroups = await conn.groupFetchAllParticipating();
    let groupIds = Object.keys(allGroups); // Extract group IDs

    reply(`📢 Sending Broadcast To ${groupIds.length} Groups...\n⏳ Estimated Time: ${groupIds.length * 1.5} seconds`);

    for (let groupId of groupIds) {
      try {
        await sleep(1500); // Avoid rate limits
        await conn.sendMessage(groupId, { text: q }); // Sends only the provided text
      } catch (err) {
        console.log(`❌ Failed to send broadcast to ${groupId}:`, err);
      }
    }

    return reply(`✅ Successfully sent broadcast to ${groupIds.length} groups!`);

  } catch (err) {
    await m.error(`❌ Error: ${err}\n\nCommand: broadcast`, err);
  }
});


cmd({
    pattern: "setgpp",
    desc: "Set full-screen profile picture for groups.",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { quoted, isGroup, isAdmins, reply }) => {
    if (!isGroup) return reply("⚠️ This command can only be used in a group.");
    if (!isAdmins) return reply("❌ You must be an admin to use this command.");
    if (!quoted || !quoted.image) return reply("⚠️ Reply to an image to set as the group profile picture.");

    try {
        let media = await quoted.download();
        await conn.updateProfilePicture(m.chat, media);
        reply("✅ Group profile picture updated successfully.");
    } catch (e) {
        console.error(e);
        reply(`❌ Failed to update group profile picture: ${e.message}`);
    }
});


cmd({
    pattern: "getgpp",
    desc: "Fetch the profile picture of the current group chat.",
    category: "group",
    filename: __filename
}, async (conn, mek, m, { isGroup, reply }) => {
    if (!isGroup) return reply("⚠️ This command can only be used in a group chat.");

    try {
        // Fetch the group profile picture URL
        const groupPicUrl = await conn.profilePictureUrl(m.chat, "image").catch(() => null);

        if (!groupPicUrl) return reply("⚠️ No profile picture found for this group.");

        // Send the group profile picture
        await conn.sendMessage(m.chat, {
            image: { url: groupPicUrl },
            caption: "🖼️ Here is the profile picture of this group chat."
        });
    } catch (e) {
        console.error("Error fetching group profile picture:", e);
        reply("❌ An error occurred while fetching the group profile picture. Please try again later.");
    }
});
