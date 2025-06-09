//---------------------------------------------------------------------------
//           Empire_Md 
//---------------------------------------------------------------------------
//  @project_name : Empire_Md  
//  @author       : efeurhobobullish
//  ⚠️ DO NOT MODIFY THIS FILE ⚠️  
//---------------------------------------------------------------------------
const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });

function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}

//═════[Don't Change Variables]════════\\

global.anticall_msg = "📞 𝙰𝚞𝚝𝚘 𝙲𝚊𝚕𝚕 𝚁𝚎𝚓𝚎𝚌𝚝 𝙼𝚘𝚍𝚎 𝙰𝚌𝚝𝚒𝚟𝚎.📵 𝙽𝚘 𝙲𝚊𝚕𝚕𝚜 𝙰𝚕𝚕𝚘𝚠𝚎𝚍!";
global.caption = "© 2025–2026 𝖤𝗆𝗉𝗂𝗋𝖾 𝖳𝖾𝖼𝗁";
global.channelUrl = "https://whatsapp.com/channel/0029VajVvpQIyPtUbYt3Oz0k";
global.botname = "ᴇᴍᴘɪʀᴇ_ᴍᴅ";
global.devs = "2348078582627"
global.devsname = "𝖤𝗆𝗉𝗂𝗋𝖾 𝖳𝖾𝖼𝗁";
global.apikey = "JXTO5";
global.api = "https://api.empiretech.biz.id/api";


module.exports = {
    ALWAYS_ONLINE: process.env.ALWAYS_ONLINE || "false",
    ANTICALL: process.env.ANTICALL || "false",
    ANTICALL_MSG: process.env.ANTICALL_MSG || "*_📞 Auto Call Reject Mode Active. 📵 No Calls Allowed!_*",
    ANTILINK: process.env.ANTILINK || "false",
    AUTO_LIKE_EMOJI: process.env.AUTO_LIKE_EMOJI || "💚",
    AUTO_LIKE_STATUS: process.env.AUTO_LIKE_STATUS || "false",
    AUTO_RECORDING: process.env.AUTO_RECORDING || "false",
    AUTO_TYPING: process.env.AUTO_TYPING || "false",
    AUTO_VIEW_STATUS: process.env.AUTO_VIEW_STATUS || "false",
    MODE: process.env.MODE || "private",
    MONGODB_URL: process.env.MONGODB_URL || "ir mongodb url",
    OWNER_NAME: process.env.OWNER_NAME || "𝖤𝗆𝗉𝗂𝗋𝖾 𝖳𝖾𝖼𝗁",
    OWNER_NUMBER: process.env.OWNER_NUMBER || "ur number",
    PREFIX: process.env.PREFIX || ".",
    SESSION_ID: process.env.SESSION_ID || "OE5VkAoL#wsp4Ic_SN_HotI8GcZHtiyJs8fAO9dVxtmg3oAeVIfA"
};
