const dotenv = require("dotenv");
dotenv.config({ path: "server/.env" });
const { pool } = require("./server/db");
(async () => {
  const [rows] = await pool.execute("SELECT id, title, status, start_at, registration_mode FROM events ORDER BY id DESC LIMIT 5");
  console.log(rows);
  await pool.end();
})().catch((err) => { console.error(err); process.exit(1); });
