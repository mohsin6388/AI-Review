const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://deific_digital_user:4oeNkt7LeA84XrFtjud0RS1NFRV66kLM@dpg-d8ggkk9kh4rs73am2nu0-a.oregon-postgres.render.com/Review_DB",
  ssl: {
    rejectUnauthorized: false,
  },
});


pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle client", err);
  process.exit(-1);
});

// const pool = new Pool({
//   user: "postgres",
//   host: "localhost",
//   database: "Review",
//   password: "Mohsin@123",
//   port: 5432,
// });

module.exports = pool;