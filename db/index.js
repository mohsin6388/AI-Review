// const { Pool } = require('pg');

// // const pool = new Pool({
// //   connectionString: "postgresql://postgres:Mohsin%40123@localhost:5432/Review",
// //   ssl:
// //     process.env.NODE_ENV === "production"
// //       ? { rejectUnauthorized: false }
// //       : false,
// // });

// const pool = new Pool({
//   user: "postgres",
//   host: "localhost",
//   database: "Review",
//   password: "Mohsin@123",
//   port: 5432,
// });

// module.exports = pool;

// const initDB = async () => {
//   const client = await pool.connect();
//   try {
//     await client.query(`
//       CREATE TABLE IF NOT EXISTS businesses (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         name VARCHAR(255) NOT NULL,
//         type VARCHAR(100) NOT NULL,
//         google_place_id VARCHAR(255) NOT NULL,
//         google_review_url TEXT NOT NULL,
//         owner_email VARCHAR(255),
//         total_reviews_generated INTEGER DEFAULT 0,
//         created_at TIMESTAMP DEFAULT NOW(),
//         updated_at TIMESTAMP DEFAULT NOW()
//       );

//       CREATE TABLE IF NOT EXISTS review_sessions (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
//         rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
//         selected_tags TEXT[],
//         generated_review TEXT,
//         review_copied BOOLEAN DEFAULT FALSE,
//         redirect_clicked BOOLEAN DEFAULT FALSE,
//         created_at TIMESTAMP DEFAULT NOW()
//       );

//       CREATE TABLE IF NOT EXISTS tags (
//         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//         business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
//         label VARCHAR(100) NOT NULL,
//         emoji VARCHAR(10),
//         category VARCHAR(50) DEFAULT 'general',
//         usage_count INTEGER DEFAULT 0
//       );

//       CREATE INDEX IF NOT EXISTS idx_businesses_place_id ON businesses(google_place_id);
//       CREATE INDEX IF NOT EXISTS idx_review_sessions_business ON review_sessions(business_id);
//       CREATE INDEX IF NOT EXISTS idx_tags_business ON tags(business_id);
//     `);

//     console.log('✅ Database initialized successfully');
//   } catch (error) {
//     console.error('❌ Database initialization error:', error);
//     throw error;
//   } finally {
//     client.release();
//   }
// };

// module.exports = { pool, initDB };

const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    "postgresql://pension_system_user:wHeVesZgDg7wgkzYA3lQvDPwzThXYjt4@dpg-d7sej9navr4c73ame5dg-a.oregon-postgres.render.com/Review_DB",
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