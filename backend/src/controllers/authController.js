import bcrypt from 'bcryptjs';
import  jwt  from 'jsonwebtoken';
import { pool } from '../db.js';

export async function signup(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hash]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      {id: user.id, username: user.username},
      process.env.JWT_SECRET,
      {expiresIn: '1d'}
    )

    return res.cookie("token", token, {
      httpOnly: true,
      sameSite: 'lax', 
      maxAge: 24 * 60 * 60 * 1000
    }).status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists.' });
    }
    console.error('Signup Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      {id: user.id, username: user.username},
      process.env.JWT_SECRET,
      {expiresIn: '1d'}
    )
    return res.cookie("token", token, {
      httpOnly: true, 
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }).status(200).json({ user: { id: user.id, username: user.username } });

  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

export async function getMe(req, res) {
  const token = req.cookies?.token; 
  
  if(!token) {
    return res.status(401).json({error: 'Not Authenticated'});
  }

  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({user: {id: decoded.id, username: decoded.username}});
  } catch (err) { 
    console.error('Token Error: ', err);
    res.status(401).json({error: 'Invalid or Expired token'});
  }
}

export async function logout(req, res) {
  const token = req.cookies?.token;
  res.status(200).clearCookie("token", {httpOnly: true, sameSite: "lax"}).json({message: "Logged Out"});
}