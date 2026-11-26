const { verifyToken } = require('../utils/jwt');

/** Rejects requests without a valid "Authorization: Bearer <token>" header. Puts the token's user on req.user. */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        req.user = verifyToken(authHeader.split(' ')[1]);
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

/** Lets the request through only for the given roles. Use after authenticate. */
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'You do not have permission to do this' });
    }
    next();
};

module.exports = { authenticate, requireRole };
