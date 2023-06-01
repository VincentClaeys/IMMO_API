import express from "express";
import pg from "pg";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";

import bodyParser from "body-parser";
import bcrypt from "bcryptjs";

import cors from 'cors';

// CREATE THE EXPRESS APP
const app = express();
const port = 3002;

// INITIALIZE PostgreSQL POOL

const { Pool } = pg;
const pool = new Pool({
  user: "postgres",
  database: "railway",
  password: "jsNudrA2mhmqUYJCQgQr",
  port: "5592",
  host: "containers-us-west-180.railway.app",
  connectionString: "postgresql://postgres:jsNudrA2mhmqUYJCQgQr@containers-us-west-180.railway.app:5592/railway",
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool
  .connect()
  .then(() => {
    console.log("Databse Connected");
  })
  .catch((error) => {
    console.error("Connection failed", error);
  });

app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(passport.initialize());
app.use(passport.session());

// CODE TO INITIALIZE PASSPORT

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const query = "SELECT * FROM users WHERE username = $1";
      const result = await pool.query(query, [username]);
      const user = result.rows[0];

      if (!user) {
        return done(null, false);
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        user.hashed_password
      );
      if (!isPasswordValid) {
        return done(null, false);
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const query = "SELECT * FROM users WHERE id = $1";
    const result = await pool.query(query, [id]);
    const user = result.rows[0];
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// CORS MIDDLEWARE
app.use(
  cors({
    origin: ['https://immoapp-production.up.railway.app'],
  })
);


// ALL THE ROUTES FOR THE LOGIN AND REGISTER

// Login
app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: "Internal Server Error" });
      }

      return res.status(200).json(user);
    });
    console.log(user);
  })(req, res, next);
});

// Register
app.post("/register", async (req, res) => {
  const { username, password , user_role_id } = req.body;

  try {
    const query = "SELECT * FROM users WHERE username = $1";
    const result = await pool.query(query, [username]);
    const user = result.rows[0];

    if (!user) {
      if (typeof password === "string") {
        const hashedPassword = await bcrypt.hash(password, 10);
        const insertQuery =
          "INSERT INTO users (username, hashed_password,user_role_id) VALUES ($1, $2,$3)";
        await pool.query(insertQuery, [username, hashedPassword, user_role_id]);

        const newUserQuery = "SELECT * FROM users WHERE username = $1";
        const newUserResult = await pool.query(newUserQuery, [username]);
        const newUser = newUserResult.rows[0];

        res.json(newUser);
      } else {
        console.log("error");
        res.json({ error: "Error" });
      }
    } else {
      res.json({ error: "User already exists" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// HOMEPAGE ROUTER


app.get('/home', async (req, res) => {
  try {
    const query = `
    SELECT houses.*, offices.name AS office_name
    FROM houses
    JOIN offices ON houses.office_id = offices.id
    `;
    const result = await pool.query(query);
    const houses = result.rows;
    res.json(houses);
  } catch (error) {
    console.error('Error retrieving users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// BUYPAGE ROUTER

app.get('/buy', async (req, res) => {
  try {
    const query = `
     SELECT * FROM houses
    `;
    const result = await pool.query(query);
    const houses = result.rows;
    res.json(houses);
  } catch (error) {
    console.error('Error retrieving users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// RENTPAGE ROUTER

app.get('/rent', async (req, res) => {
  try {
    const query = `
     SELECT * FROM houses
    `;
    const result = await pool.query(query);
    const houses = result.rows;
    res.json(houses);
  } catch (error) {
    console.error('Error retrieving users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});








// INITIALIZE AUTHROUTER
const authRouter = express.Router();

authRouter.use(async (req, res, next) => {
  if (req.headers.authorization) {
    const query = `
      SELECT users.*, user_roles.role, offices.name 
      FROM users
      INNER JOIN user_roles ON users.user_role_id = user_roles.id
      LEFT JOIN offices ON users.office_id = offices.id
      WHERE users.id = $1
    `;
    const result = await pool.query(query, [req.headers.authorization]);
    const user = result.rows[0];

    if (user) {
      console.log(user);
      req.user = user;
      return next();
    }
  }

  res.status(401).json({
    error: "Unauthorized",
  });
});

// ALL THE ROUTES FOR THE ACCOUNT DASHBOARD

// GET logged in user account
authRouter.get("/account", (req, res) => {
  const user = req.user;
  res.json(user);
  console.log(user);
});

// UPDATE logged in user
authRouter.patch("/account", async (req, res) => {
  const userId = req.user.id;
  const updatedUser = req.body;

  try {
    const updateQuery = "UPDATE users SET username = $1 WHERE id = $2";
    await pool.query(updateQuery, [updatedUser.username, userId]);
    res.json(updatedUser);
  } catch (error) {
    res.status(404).json({ error: "Sorry, the user is not found." });
  }
});

// GET favorites of a logged in user 

authRouter.get('/account/favorites', async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT houses.*
      FROM houses
      INNER JOIN favorites ON houses.id = favorites.house_id
      WHERE favorites.user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    const favorites = result.rows;
    res.json(favorites);
  } catch (error) {
    console.error('Error retrieving favorites:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE logged in user
authRouter.delete("/account/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const deleteQuery = "DELETE FROM users WHERE id = $1";
    await pool.query(deleteQuery, [id]);
    res.json({});
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


//  USERS ADMIN ROUTES


// CRUD USERS
// Get all users --> for the admin dashboard

authRouter.get('/account/users', async (req, res) => {
  try {
    const query = `
      SELECT users.*, user_roles.role
      FROM users
      INNER JOIN user_roles ON users.user_role_id = user_roles.id
    `;
    const result = await pool.query(query);
    const users = result.rows;
    res.json(users);
  } catch (error) {
    console.error('Error retrieving users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// get a user by id --> admin dashboard

authRouter.get("/account/users/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const query = "SELECT * FROM users WHERE id = $1";
    const result = await pool.query(query, [id]);
    const student = result.rows[0];

    if (student) {
      res.json(student);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// update 1 user --> admin dashboard

authRouter.patch("/account/users/:id", async (req, res) => {

  const id = req.params.id;
  const updatedUser = req.body;

  try {
    const updateQuery = "UPDATE users SET username = $1 WHERE id = $2";
    await pool.query(updateQuery, [updatedUser.username, id]);
    res.json(updatedUser);
  } catch (error) {
    res.status(404).json({ error: "Sorry, the user is not found." });
  }
});


// delete a user by id  --> admin dashboard

authRouter.delete("/account/users/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const deleteQuery = "DELETE FROM users WHERE id = $1";
    await pool.query(deleteQuery, [id]);
    res.json({});
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// CRUD HOUSES 
// Get all houses --> for the admin dashboard



authRouter.get('/account/houses', async (req, res) => {
  try {
    const query = `
     SELECT * FROM houses
    `;
    const result = await pool.query(query);
    const houses = result.rows;
    res.json(houses);
  } catch (error) {
    console.error('Error retrieving users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// get a house by id --> admin dashboard

authRouter.get("/account/houses/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const query = "SELECT * FROM houses WHERE id = $1";
    const result = await pool.query(query, [id]);
    const house = result.rows[0];

    if (house) {
      res.json(house);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// update 1 house --> admin dashboard

authRouter.patch("/account/houses/:id", async (req, res) => {

  const id = req.params.id;
  const updatedHouse = req.body;

  try {
    const updateQuery = "UPDATE houses SET streetname = $1 WHERE id = $2";
    await pool.query(updateQuery, [updatedHouse.streetname, id]);
    res.json(updatedHouse);
  } catch (error) {
    res.status(404).json({ error: "Sorry, the user is not found." });
  }
});

// delete a house by id  --> admin dashboard

authRouter.delete("/account/houses/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const deleteQuery = "DELETE FROM houses WHERE id = $1";
    await pool.query(deleteQuery, [id]);
    res.json({});
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// get house by specific office 

authRouter.get('/account/housesoffice', async (req, res) => {
  try {
    const userId = req.user.id; 
    const query = `
      SELECT houses.*, offices.name
      FROM houses
      INNER JOIN offices ON houses.office_id = offices.id
      WHERE houses.office_id IN (
        SELECT office_id
        FROM users
        WHERE id = $1
      )
    `;
    const result = await pool.query(query, [userId]);
    const houses = result.rows;
    res.json(houses);
  } catch (error) {
    console.error('Error retrieving houses:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// add new house 
authRouter.post("/account/housesoffice/add", async (req, res) => {
  const { streetname, housenumber, province, price, description,office_id,img } = req.body;
console.log(req.body);
  try {
    const query = "INSERT INTO houses (streetname, housenumber,description, province, price,office_id,img) VALUES ($1, $2, $3, $4, $5,$6,$7) RETURNING *";
    const result = await pool.query(query, [streetname, housenumber,description, province, price,office_id,img ]);
    const newHouse = result.rows[0];

    res.json(newHouse);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// delete specific house
authRouter.delete("/account/housesoffice/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const deleteQuery = "DELETE FROM houses WHERE id = $1";
    await pool.query(deleteQuery, [id]);
    res.json({});
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// get that specific house by id

authRouter.get("/account/housesoffice/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const query = "SELECT * FROM houses WHERE id = $1";
    const result = await pool.query(query, [id]);
    const house = result.rows[0];

    if (house) {
      res.json(house);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// update that specific house by id

authRouter.patch("/account/housesoffice/:id", async (req, res) => {

  const id = req.params.id;
  const updatedHouse = req.body;

  try {
    const updateQuery = "UPDATE houses SET streetname = $1 WHERE id = $2";
    await pool.query(updateQuery, [updatedHouse.streetname, id]);
    res.json(updatedHouse);
  } catch (error) {
    res.status(404).json({ error: "Sorry, the user is not found." });
  }
});

authRouter.get('/account/messages', async (req, res) => {
  try {
    const officeId = req.user.office_id;
    console.log(officeId); // Het kantoor-ID van de ingelogde gebruiker
    const query = `
    SELECT messages.*, users.username AS sender, houses.*, offices.name AS receiver
    FROM messages
    JOIN users ON messages.user_id = users.id
    JOIN houses ON messages.house_id = houses.id
    JOIN offices ON houses.office_id = offices.id
    WHERE houses.office_id = $1
  `;
    const result = await pool.query(query, [officeId]);
    const messages = result.rows;
    res.json(messages);
  } catch (error) {
    console.error('Error retrieving messages:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// show real estate office current logged in user
authRouter.get("/account/estateOffice", (req, res) => {
  const user = req.user;
  res.json(user);
  console.log(user);
});

// update real estate office current logged in user
authRouter.patch("/account/estateOffice", async (req, res) => {
  const userId = req.user.id;
  const updatedOfficeName = req.body.name;

  try {
    const query = `
      UPDATE offices
      SET name = $1
      FROM users
      WHERE users.id = $2 AND users.office_id = offices.id
      RETURNING offices.*
    `;
    const result = await pool.query(query, [updatedOfficeName, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Kantoor niet gevonden voor de ingelogde gebruiker." });
    }

    const updatedOffice = result.rows[0];
    res.json(updatedOffice);
  } catch (error) {
    console.error("Fout bij het bijwerken van het kantoor:", error);
    res.status(500).json({ error: "Interne serverfout bij het bijwerken van het kantoor." });
  }
});

app.post("/account/estateOffice", async (req, res) => {
  const { username, password , user_role_id , office_id} = req.body;
console.log(req.body)
  try {
    const query = "SELECT * FROM users WHERE username = $1";
    const result = await pool.query(query, [username]);
    const user = result.rows[0];

    if (!user) {
      if (typeof password === "string") {
        const hashedPassword = await bcrypt.hash(password, 10);
        const insertQuery =
          "INSERT INTO users (username, hashed_password,user_role_id,office_id) VALUES ($1, $2,$3,$4)";
        await pool.query(insertQuery, [username, hashedPassword, user_role_id,office_id]);

        const newUserQuery = "SELECT * FROM users WHERE username = $1";
        const newUserResult = await pool.query(newUserQuery, [username]);
        const newUser = newUserResult.rows[0];

        res.json(newUser);
      } else {
        console.log("error");
        res.json({ error: "Error" });
      }
    } else {
      res.json({ error: "User already exists" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});





// HOME PAGE

app.get("/home/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const query = "SELECT * FROM houses WHERE id = $1";
    const result = await pool.query(query, [id]);
    const house = result.rows[0];

    if (house) {
      res.json(house);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post('/home/:id', async (req, res) => {
  try {
    const { user_id, house_id } = req.body;
    const query = 'INSERT INTO favorites (user_id, house_id) VALUES ($1, $2)';
    await pool.query(query, [user_id, house_id]);
    res.status(200).json({ message: 'Favorite added successfully' });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
app.post('/home/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, office_id, message,  } = req.body;

    const query = `
      INSERT INTO messages (user_id, office_id, house_id, message)
      VALUES ($1, $2, $3, $4)
    `;
    await pool.query(query, [user_id,office_id, id, message]);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// BUY PAGE

app.get("/buy/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const query = "SELECT * FROM houses WHERE id = $1";
    const result = await pool.query(query, [id]);
    const house = result.rows[0];

    if (house) {
      res.json(house);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post('/buy/:id', async (req, res) => {
  try {
    const { user_id, house_id } = req.body;
    const query = 'INSERT INTO favorites (user_id, house_id) VALUES ($1, $2)';
    await pool.query(query, [user_id, house_id]);
    res.status(200).json({ message: 'Favorite added successfully' });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/buy/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, office_id, message,  } = req.body;

    const query = `
      INSERT INTO messages (user_id, office_id, house_id, message)
      VALUES ($1, $2, $3, $4)
    `;
    await pool.query(query, [user_id,office_id, id, message]);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// RENT PAGE

app.get("/rent/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const query = "SELECT * FROM houses WHERE id = $1";
    const result = await pool.query(query, [id]);
    const house = result.rows[0];

    if (house) {
      res.json(house);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.post('/rent/:id', async (req, res) => {
  try {
    const { user_id, house_id } = req.body;
    const query = 'INSERT INTO favorites (user_id, house_id) VALUES ($1, $2)';
    await pool.query(query, [user_id, house_id]);
    res.status(200).json({ message: 'Favorite added successfully' });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/rent/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, office_id, message,  } = req.body;

    const query = `
      INSERT INTO messages (user_id, office_id, house_id, message)
      VALUES ($1, $2, $3, $4)
    `;
    await pool.query(query, [user_id,office_id, id, message]);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});





// define a route to get a student by id





authRouter.get("/students/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const query = "SELECT * FROM students WHERE id = $1";
    const result = await pool.query(query, [id]);
    const student = result.rows[0];

    if (student) {
      res.json(student);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// define a route to update a student by id
authRouter.patch("/students/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const query = "SELECT * FROM students WHERE id = $1";
    const result = await pool.query(query, [id]);
    const student = result.rows[0];

    if (student) {
      const { id, ...data } = req.body;
      const updatedStudent = { ...student, ...data };

      const updateQuery = "UPDATE students SET ... = $1 WHERE id = $2";
      await pool.query(updateQuery, [updatedStudent, id]);

      res.json(updatedStudent);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE
authRouter.delete("/students/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const deleteQuery = "DELETE FROM students WHERE id = $1";
    await pool.query(deleteQuery, [id]);
    res.json({});
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// LET THE APP USE THE AUTHROUTER
app.use(async (req, res, next) => {
  if (req.headers.authorization) {
    const query = "SELECT * FROM users WHERE id = $1";
    const result = await pool.query(query, [req.headers.authorization]);
    const user = result.rows[0];

    if (user) {
      req.user = user;
      return next();
    }
  }

  res.status(401).json({
    error: "Unauthorized",
  });
}, authRouter);


app.listen(port,() => {
  console.log(`App listening https://immoapp-production.up.railway.app:${port}`);
});

// make sure database connection is closed when server crashes
const closeServer = () => {
  pool.end();
  process.exit();
};

process.on("SIGINT", () => closeServer());
process.on("SIGTERM", () => closeServer());
