import jwt from "jsonwebtoken"

export const authenticateToken = (req, res, next) => {
  const token = req.cookies.accessToken // ← Lê do cookie

  if (!token) {
    return res.status(401).json({ error: "Token de acesso requerido" })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Token inválido ou expirado" })
    }
    req.user = user
    next()
  })
}

export const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  })
}

export default authenticateToken;