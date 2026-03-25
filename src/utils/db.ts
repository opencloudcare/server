import {Pool} from "pg";


const db = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// module.exports = {
//   query: (text: QueryArrayConfig<any>, params: any) => db.query(text, params),
// };

export default db
