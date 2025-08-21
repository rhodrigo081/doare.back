import express from "express";
import { generateToken, authenticateToken } from "../middleware/auth.js";
import bcrypt from "bcrypt";

const router = express.Router();

// Login com token via cookie
router.post("/login", async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: "Preencha todos os campos" });
    }

    if (login !== process.env.ADMIN_LOGIN) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const isValidPassword = await bcrypt.compare(
      password,
      process.env.ADMIN_PASSWORD_HASH
    );
    if (!isValidPassword) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = generateToken({
      id: 1,
      login: login,
      role: "admin",
    });

    res.cookie("accessToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000, // 24h
    });

    return res.status(200).json({
      message: "Login realizado com sucesso",
      user: {
        id: 1,
        login: login,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// Rota protegida
router.get("/profile", authenticateToken, (req, res) => {
  res.json({
    message: "Perfil do usuário",
    user: req.user,
  });
});

// Verificação de token (via cookie)
router.get("/verify-token", authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user,
  });
});

// Logout - remove o cookie
router.post("/logout", (req, res) => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });
  return res.status(200).json({ message: "Logout realizado com sucesso" });
});

export default router;
