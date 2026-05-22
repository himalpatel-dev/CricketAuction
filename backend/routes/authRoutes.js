const express = require('express');
const router = express.Router();
const { register, login, changePassword } = require('../controllers/authController');
const { verifyToken } = require('../utils/jwt');

// Simple middleware to authenticate user via JWT header
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

router.post('/register', register);
router.post('/login', login);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
