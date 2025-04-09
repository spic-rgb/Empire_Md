//---------------------------------------------
//           EMPIRE-MD  
//---------------------------------------------
//  @project_name : EMPIRE-MD  
//  @author      : efeurhobobullish
//  ⚠️ DO NOT MODIFY THIS FILE ⚠️  
//---------------------------------------------
const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { cmd } = require('../command');
const axios = require('axios');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson, saveConfig, Catbox, monospace } = require('../funcs');
const { downloadMediaMessage } = require('baileys');
const fs = require('fs');
const path = require('path');
const ffmpeg = require("fluent-ffmpeg");
const imgmsg = 'Reply to a photo for sticker!';  
const descg = 'It converts your replied photo to a sticker.';

cmd({
    pattern: "attp",
    desc: "Generate a sticker from text.",
    category: "sticker",
    use: ".attp <Text>",
    filename: __filename
}, async (conn, mek, m, { from, reply, args, q }) => {
    try {
        const text = args.join(" ");
        if (!text) return reply("Please provide some text to generate the sticker.");

        // Define the API endpoint
        const apiUrl = `https://api.nexoracle.com/image-creating/attp?apikey=MepwBcqIM0jYN0okD&text=${encodeURIComponent(text)}`;

        // Call the API and get the image
        const response = await require("axios").get(apiUrl, { responseType: "arraybuffer" });

        // Check content type
        const contentType = response.headers["content-type"];
        console.log("API Content-Type:", contentType);

        // Save the image temporarily
        const imagePath = `./tmp/${Date.now()}.png`;
        fs.writeFileSync(imagePath, response.data);

        // Convert the image to a proper webp sticker
        const sticker = new Sticker(imagePath, {
            pack: global.botname,
            author: global.devsname || "Hacker Only_🥇Empire",
            type: StickerTypes.FULL, // Ensure it's a static sticker
            quality: 100
        });

        const buffer = await sticker.toBuffer();

        return conn.sendMessage(from, { sticker: buffer }, { quoted: mek });
    } catch (e) {
        console.error("Error occurred:", e);
        reply("An error occurred while generating the sticker.");
    }
});
//--------------------------------------------
//    STICKER COMMANDS
//--------------------------------------------
cmd({
    pattern: "sticker",
    desc: "Change image to sticker.",
    category: "sticker",
    use: ".sticker <Reply to image>",
    filename: __filename
}, async (conn, mek, m, { from, reply, isCmd, command, args, q, isGroup, pushname }) => {
    try {
        const isQuotedImage = m.quoted && (m.quoted.type === 'imageMessage' || (m.quoted.type === 'viewOnceMessage' && m.quoted.msg.type === 'imageMessage'));
        const isQuotedSticker = m.quoted && m.quoted.type === 'stickerMessage';

        if ((m.type === 'imageMessage') || isQuotedImage) {
            const nameJpg = getRandom('.jpg');
            const imageBuffer = isQuotedImage ? await m.quoted.download() : await m.download();
            await fs.promises.writeFile(nameJpg, imageBuffer);

            let sticker = new Sticker(nameJpg, {
                pack: global.botname, // Use global.botname for the sticker pack
                author: global.devsname || 'Hacker Only_🥇Empire', // Use global.devsname for the author
                type: q.includes('--crop') || q.includes('-c') ? StickerTypes.CROPPED : StickerTypes.FULL,
                categories: ['🤩', '🎉'], // Sticker categories
                id: '12345', // Sticker id
                quality: 75, // Quality of the sticker
                background: 'transparent', // Transparent background for full stickers
            });

            const buffer = await sticker.toBuffer();
            return conn.sendMessage(from, { sticker: buffer }, { quoted: mek });
        } else if (isQuotedSticker) {
            const nameWebp = getRandom('.webp');
            const stickerBuffer = await m.quoted.download();
            await fs.promises.writeFile(nameWebp, stickerBuffer);

            let sticker = new Sticker(nameWebp, {
                pack: global.botname, 
                author: global.devsname || 'Hacker Only_🥇Empire', 
                type: q.includes('--crop') || q.includes('-c') ? StickerTypes.CROPPED : StickerTypes.FULL,
                categories: ['🤩', '🎉'], // Sticker categories
                id: '12345', // Sticker id
                quality: 75, // Quality of the sticker
                background: 'transparent', // Transparent background for full stickers
            });

            const buffer = await sticker.toBuffer();
            return conn.sendMessage(from, { sticker: buffer }, { quoted: mek });
        } else {
            return await reply(imgmsg); // Return the default message if no image or sticker is found.
        }
    } catch (e) {
        reply('Error !!');
        console.error(e);
    }
});
//--------------------------------------------
//  ROUND STICKER COMMANDS
//--------------------------------------------
cmd({
    pattern: "round",
    desc: "Change image to round sticker.",
    category: "sticker",
    use: ".roundsticker <Reply to image>",
    filename: __filename
}, async (conn, mek, m, { from, reply, isCmd, command, args, q, isGroup, pushname }) => {
    try {
        const isQuotedImage = m.quoted && (m.quoted.type === 'imageMessage' || (m.quoted.type === 'viewOnceMessage' && m.quoted.msg.type === 'imageMessage'));
        const isQuotedSticker = m.quoted && m.quoted.type === 'stickerMessage';

        if ((m.type === 'imageMessage') || isQuotedImage) {
            const nameJpg = getRandom('.jpg');
            const imageBuffer = isQuotedImage ? await m.quoted.download() : await m.download();
            await fs.promises.writeFile(nameJpg, imageBuffer);

            let sticker = new Sticker(nameJpg, {
                pack: global.botname, // Use global.botname for the sticker pack
                author: global.devsname || 'Hacker Only_🥇Empire', // Use global.devsname for the author
                type: StickerTypes.ROUND, // Round sticker type
                categories: ['🤩', '🎉'], // Sticker categories
                id: '12345', // Sticker id
                quality: 75, // Quality of the sticker
                background: 'transparent', // Transparent background for round stickers
            });

            const buffer = await sticker.toBuffer();
            return conn.sendMessage(from, { sticker: buffer }, { quoted: mek });
        } else if (isQuotedSticker) {
            const nameWebp = getRandom('.webp');
            const stickerBuffer = await m.quoted.download();
            await fs.promises.writeFile(nameWebp, stickerBuffer);

            let sticker = new Sticker(nameWebp, {
                pack: global.botname, // Use global.botname for the sticker pack
                author: global.devsname || 'Hacker Only_🥇Empire', // Use global.devsname for the author
                type: StickerTypes.ROUND, // Round sticker type
                categories: ['🤩', '🎉'], // Sticker categories
                id: '12345', // Sticker id
                quality: 75, // Quality of the sticker
                background: 'transparent', // Transparent background for round stickers
            });

            const buffer = await sticker.toBuffer();
            return conn.sendMessage(from, { sticker: buffer }, { quoted: mek });
        } else {
            return await reply(imgmsg); // Return the default message if no image or sticker is found.
        }
    } catch (e) {
        reply('Error !!');
        console.error(e);
    }
});
//--------------------------------------------
// CROP STICKER COMMANDS
//--------------------------------------------
cmd({
    pattern: "crop",
    desc: "Change image to cropped sticker.",
    category: "sticker",
    use: ".cropsticker <Reply to image>",
    filename: __filename
}, async (conn, mek, m, { from, reply, isCmd, command, args, q, isGroup, pushname }) => {
    try {
        const isQuotedImage = m.quoted && (m.quoted.type === 'imageMessage' || (m.quoted.type === 'viewOnceMessage' && m.quoted.msg.type === 'imageMessage'));
        const isQuotedSticker = m.quoted && m.quoted.type === 'stickerMessage';

        if ((m.type === 'imageMessage') || isQuotedImage) {
            const nameJpg = getRandom('.jpg');
            const imageBuffer = isQuotedImage ? await m.quoted.download() : await m.download();
            await fs.promises.writeFile(nameJpg, imageBuffer);

            let sticker = new Sticker(nameJpg, {
                pack: global.botname, // Use global.botname for the sticker pack
                author: global.devsname || 'Hacker Only_🥇Empire', // Use global.devsname for the author
                type: StickerTypes.CROPPED, // CROP sticker type
                categories: ['🤩', '🎉'], // Sticker categories
                id: '12345', // Sticker id
                quality: 75, // Quality of the sticker
                background: 'transparent', // Transparent background for cropped stickers
            });

            const buffer = await sticker.toBuffer();
            return conn.sendMessage(from, { sticker: buffer }, { quoted: mek });
        } else if (isQuotedSticker) {
            const nameWebp = getRandom('.webp');
            const stickerBuffer = await m.quoted.download();
            await fs.promises.writeFile(nameWebp, stickerBuffer);

            let sticker = new Sticker(nameWebp, {
                pack: global.botname, // Use global.botname for the sticker pack
                author: global.devsname || 'Hacker Only_🥇Empire', // Use global.devsname for the author
                type: StickerTypes.CROPPED, // CROP sticker type
                categories: ['🤩', '🎉'], // Sticker categories
                id: '12345', // Sticker id
                quality: 75, // Quality of the sticker
                background: 'transparent', // Transparent background for cropped stickers
            });

            const buffer = await sticker.toBuffer();
            return conn.sendMessage(from, { sticker: buffer }, { quoted: mek });
        } else {
            return await reply(imgmsg); // Return the default message if no image or sticker is found.
        }
    } catch (e) {
        reply('Error !!');
        console.error(e);
    }
});

cmd({
    pattern: "quoted",
    desc: "Generate a quoted sticker.",
    category: "sticker",
    use: ".quoted <Reply to message>",
    filename: __filename
}, async (conn, mek, m, { from, reply, q, pushname }) => {
    try {
        if (!q) return reply("Reply to a message to generate a quoted sticker!");

        const userName = pushname || "Unknown"; // Get sender's name from pushname
        const userMessage = q; // Use q for the quoted text
        const profilePic = await conn.profilePictureUrl(m.sender, "image").catch(() => null); // Get profile picture

        // Generate the quoted image sticker
        const quoteData = {
            type: "quote",
            format: "png",
            backgroundColor: "#ffffff",
            quote: userMessage,
            author: userName,
            avatar: profilePic,
        };

        const quoteUrl = `https://api.quotely.io/generate?${new URLSearchParams(quoteData)}`;
        const stickerBuffer = await getBuffer(quoteUrl);

        return conn.sendMessage(from, { sticker: stickerBuffer }, { quoted: mek });
    } catch (e) {
        reply("Error generating quoted sticker!");
        console.error(e);
    }
});

cmd({
    pattern: "circle",
    desc: "Change sticker to circle.",
    category: "sticker",
    use: ".circle <Reply to sticker>",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const isQuotedSticker = m.quoted && m.quoted.type === 'stickerMessage';

        if (isQuotedSticker) {
            const nameWebp = getRandom('.webp');
            const stickerBuffer = await m.quoted.download();
            await fs.promises.writeFile(nameWebp, stickerBuffer);

            let sticker = new Sticker(nameWebp, {
                pack: global.botname, // Use global.botname for the sticker pack
                author: global.devsname || 'Hacker Only_🥇Empire', // Use global.devsname for the author
                type: StickerTypes.CIRCLE, // CIRCLE sticker type
                categories: ['🤩', '🎉'], // Sticker categories
                id: '12345', // Sticker id
                quality: 75, // Quality of the sticker
                background: 'transparent', // Transparent background for circular stickers
            });

            const buffer = await sticker.toBuffer();
            return conn.sendMessage(from, { sticker: buffer }, { quoted: mek });
        } else {
            return await reply('Reply to a sticker to make it circular!');
        }
    } catch (e) {
        reply('Error !!');
        console.error(e);
    }
});