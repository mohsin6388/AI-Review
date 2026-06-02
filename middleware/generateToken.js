require('dotenv').config()
const jwt = require("jsonwebtoken");

const generateAccessToken = (user) => {
  
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "1m",
    },
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: "30d",
    },
  );
};


module.exports = {
  generateAccessToken,
  generateRefreshToken,
};