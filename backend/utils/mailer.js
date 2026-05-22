const nodemailer = require('nodemailer');

// Configure transporter
const getTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: parseInt(process.env.SMTP_PORT || '465') === 465, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

/**
 * Sends a premium login credential email to a user (Tournament Admin or Team Owner)
 * @param {string} email Recipient email address
 * @param {string} recipientName Recipient name (e.g. Andy Flower or Tournament Name)
 * @param {string} roleName Name of the role (e.g. Tournament Admin or Team Owner)
 * @param {string} username Generated username
 * @param {string} password Generated plain text password
 */
const sendCredentialsEmail = async (email, recipientName, roleName, username, password) => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('Mailer Warning: SMTP credentials are not configured in environment. Skipping email sending.');
        return false;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const transporter = getTransporter();

    const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'BidWicket Auction'}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Welcome to BidWicket - Your ${roleName} Credentials`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to BidWicket</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #0f172a;
                    margin: 0;
                    padding: 0;
                    color: #e2e8f0;
                }
                .container {
                    max-width: 600px;
                    margin: 30px auto;
                    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    border-radius: 16px;
                    border: 1px solid #334155;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
                    overflow: hidden;
                }
                .header {
                    background: linear-gradient(90deg, #1d4ed8 0%, #1e40af 100%);
                    padding: 30px 20px;
                    text-align: center;
                }
                .header h1 {
                    margin: 0;
                    font-size: 28px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    color: #ffffff;
                    text-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .header h1 span {
                    color: #60a5fa;
                }
                .content {
                    padding: 40px 30px;
                    line-height: 1.6;
                }
                .welcome-text {
                    font-size: 18px;
                    margin-bottom: 20px;
                    color: #f1f5f9;
                }
                p {
                    font-size: 14px;
                    margin-bottom: 15px;
                    color: #f1f5f9;
                }
                .credentials-card {
                    background-color: rgba(30, 41, 59, 0.7);
                    border: 1px dashed #3b82f6;
                    border-radius: 12px;
                    padding: 25px;
                    margin: 30px 0;
                }
                .credentials-title {
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #94a3b8;
                    margin-bottom: 15px;
                    font-weight: 600;
                }
                .credential-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 12px;
                    font-size: 16px;
                }
                .credential-row:last-child {
                    margin-bottom: 0;
                }
                .credential-label {
                    color: #94a3b8;
                    font-weight: 500;
                }
                .credential-value {
                    color: #3b82f6;
                    font-family: 'Courier New', Courier, monospace;
                    font-weight: bold;
                }
                .instructions {
                    background-color: rgba(239, 68, 68, 0.1);
                    border-left: 4px solid #ef4444;
                    padding: 15px;
                    margin: 25px 0;
                    border-radius: 0 8px 8px 0;
                    font-size: 14px;
                    color: #f87171;
                }
                .btn-container {
                    text-align: center;
                    margin-top: 35px;
                }
                .btn-login {
                    display: inline-block;
                    background: linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%);
                    color: #ffffff !important;
                    text-decoration: none;
                    padding: 14px 35px;
                    font-size: 16px;
                    font-weight: 600;
                    border-radius: 8px;
                    transition: transform 0.2s, box-shadow 0.2s;
                    box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.4);
                }
                .footer {
                    background-color: #0b0f19;
                    padding: 20px;
                    text-align: center;
                    font-size: 12px;
                    color: #64748b;
                    border-top: 1px solid #1e293b;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Bid<span>Wicket</span> Auction</h1>
                </div>
                <div class="content">
                    <div class="welcome-text">Hello <strong>${recipientName}</strong>,</div>
                    <p>You have been registered as a <strong>${roleName}</strong> on the BidWicket Cricket Auction Portal.</p>
                    <p>Please use the following login credentials to access your dashboard:</p>
                    
                    <div class="credentials-card">
                        <div class="credentials-title">Access Details</div>
                        <div class="credential-row">
                            <span class="credential-label">Role:</span>
                            <span class="credential-value" style="color: #e2e8f0; font-family: inherit;">${roleName}</span>
                        </div>
                        <div class="credential-row">
                            <span class="credential-label">Username:</span>
                            <span class="credential-value">${username}</span>
                        </div>
                        <div class="credential-row">
                            <span class="credential-label">Temporary Password:</span>
                            <span class="credential-value">${password}</span>
                        </div>
                    </div>
                    
                    <div class="instructions">
                        <strong>Security Notice:</strong> You will be prompted to change this temporary password immediately upon your first login.
                    </div>
                    
                    <div class="btn-container">
                        <a href="${frontendUrl}/login" class="btn-login">Login to Portal</a>
                    </div>
                </div>
                <div class="footer">
                    &copy; 2026 BidWicket. All rights reserved. <br>
                    Please do not reply directly to this automated message.
                </div>
            </div>
        </body>
        </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Credentials email sent successfully to: ${email}`);
        return true;
    } catch (error) {
        console.error('Error sending credentials email:', error);
        return false;
    }
};

module.exports = { sendCredentialsEmail };
