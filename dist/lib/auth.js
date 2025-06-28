import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
        console.log("Token verified successfully", decoded);
        return decoded;
    }
    catch (err) {
        console.log("Token verification failed", err);
        return null;
    }
}
