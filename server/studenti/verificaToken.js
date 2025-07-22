const jwt = require('jsonwebtoken');

const verificaToken = (req, res, next, secretKey) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Token mancante' });

    jwt.verify(token, secretKey, (err, utente) => {
        if (err) return res.status(403).json({ message: 'Token non valido' });

        req.user = utente;
        next();
    });
}

module.exports = verificaToken;