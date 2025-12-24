import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDB } from '../db/mongo.js';

export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const db = getDB();
    const admin = await db.collection('admins').findOne({ username });

    if (!admin) {
      return res.status(400).json({ message: 'Credenciais inválidas.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciais inválidas.' });
    }

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, admin: { id: admin._id, username: admin.username } });
  } catch (err) {
    res.status(500).json({ message: 'Erro no servidor.', error: err.message });
  }
};

export const register = async (req, res) => {
  const { username, password } = req.body;

  try {
    const db = getDB();
    const existingAdmin = await db.collection('admins').findOne({ username });

    if (existingAdmin) {
      return res.status(400).json({ message: 'Usuário já existe.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.collection('admins').insertOne({
      username,
      password: hashedPassword
    });

    res.status(201).json({ message: 'Admin criado com sucesso.', id: result.insertedId });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao criar admin.', error: err.message });
  }
};
