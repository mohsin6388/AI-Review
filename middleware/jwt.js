require("dotenv").config();
const jwt = require("jsonwebtoken");

// const authMiddleware = (req, res, next) => {
//   try {
//     console.log("Your are authenticated...")
//     const authHeader = req.headers.authorization;

//     if (!authHeader) {
//       return res.status(401).json({
//         message: "No token provided",
//       });
//     }

//     // Bearer token
//     const token = authHeader.split(" ")[1];

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     req.user = decoded;

//     next();
//   } catch (error) {
//     return res.status(401).json({
//       message: "Invalid Token",
//     });
//   }
// };


  const authMiddleware = (req, res, next) => {
    const token = req.cookies.accessToken;

    console.log(req.cookies.accessToken);


    if (!token) {
      return res.status(401).json({
        message: "Unauthorized",
        code: "TOKEN_EXPIRED"
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      req.user = decoded;

      next();
    } catch (err) {
      return res.status(401).json({
        message: "Token expired",
        code: "TOKEN_EXPIRED",
      });
    }
  };


  module.exports = authMiddleware;
