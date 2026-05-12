const fs = require('fs');
const path = require('path');

/**
 * Saves a base64 image string to the uploads/player_photo directory
 * @param {string} base64String - The base64 image string
 * @param {string} playerName - The name of the player for the filename
 * @returns {string} - The saved filename
 */
const saveBase64Image = (base64String, playerName) => {
    if (!base64String || typeof base64String !== 'string') {
        console.log('[imageUpload] Not a string or empty:', typeof base64String);
        return base64String;
    }

    if (!base64String.startsWith('data:image')) {
        console.log('[imageUpload] String does not start with data:image. Starts with:', base64String.substring(0, 50));
        return base64String;
    }

    try {
        console.log('[imageUpload] Processing image for:', playerName);
        
        // Extract extension and data using a more robust regex
        // Matches: data:image/png;base64,iVBOR...
        const matches = base64String.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.*)$/s);
        
        if (!matches || matches.length < 3) {
            console.log('[imageUpload] Invalid base64 format - match failed');
            return base64String;
        }

        const extension = matches[1].toLowerCase();
        const base64Data = matches[2].trim();
        
        console.log('[imageUpload] Extension:', extension, 'Data length:', base64Data.length);
        
        // Create filename: playername_datetimenow.extension
        const now = new Date();
        const timestamp = now.getFullYear().toString() + 
                        (now.getMonth() + 1).toString().padStart(2, '0') + 
                        now.getDate().toString().padStart(2, '0') + "_" + 
                        now.getHours().toString().padStart(2, '0') + 
                        now.getMinutes().toString().padStart(2, '0') + 
                        now.getSeconds().toString().padStart(2, '0');
        
        const sanitizedPlayerName = playerName ? playerName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'player';
        const fileName = `${sanitizedPlayerName}_${timestamp}.${extension}`;
        
        const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_PATH || 'uploads/player_photo');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, base64Data, 'base64');

        console.log('[imageUpload] Image saved successfully:', fileName);
        return fileName;
    } catch (error) {
        console.error('[imageUpload] Error saving base64 image:', error);
        return base64String;
    }
};

module.exports = { saveBase64Image };
