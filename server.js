const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static frontend files from the parent `f2` folder
app.use(express.static(path.join(__dirname, "..")));

// Session
app.use(
  session({
    secret: "secret_key", // Change this to a strong secret
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true, // Prevents client-side JS from accessing the cookie
        maxAge: 60 * 60 * 1000 // 1 hour session expiration
    }
  })
);

// MySQL Connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "J1e2l3l4y5",
  database: "finalbackend",
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to MySQL database!");
});

// Routes

// 1. Serve landing page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "landing.html"));
});

// 2. Serve login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "login.html"));
});

// 3. Serve register page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "register.html"));
});

// 4. Serve tickets page
app.get("/tickets", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "tickets.html"));
});

// 5. Serve profile page
app.get("/profile", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login"); // Redirect to login if user is not logged in
  }
  res.sendFile(path.join(__dirname, "..", "profile.html"));
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


// 2. User Login
app.post("/login", (req, res) => {
    const { email, password } = req.body;
  
    db.query("SELECT * FROM Users WHERE email = ?", [email], async (err, results) => {
      if (err) {
        res.send(`
          <script>
            alert("Database error. Please try again later.");
            window.location.href = "/login";
          </script>
        `);
        return;
      }
  
      if (results.length === 0) {
        res.send(`
          <script>
            alert("Invalid email or password. Please try again.");
            window.location.href = "/login";
          </script>
        `);
        return;
      }
  
      const user = results[0];
  
      // Validate password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        res.send(`
          <script>
            alert("Invalid email or password. Please try again.");
            window.location.href = "/login";
          </script>
        `);
        return;
      }
  
      // Set session
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
      };
  
      if (user.role === "admin") {
        res.send(`
            <script>
                alert("Admin login successful!");
                window.location.href = "/admin";
            </script>
        `);
    } else {
        res.send(`
            <script>
                alert("User login successful!");
                window.location.href = "/homepage";
            </script>
        `);
    }
    });
  });


  
// User Registration
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  // Check if user already exists
  db.query(
    "SELECT * FROM Users WHERE email = ? OR username = ?",
    [email, username],
    async (err, results) => {
      if (err) {
        res.send(`
          <script>
            alert("Database error. Please try again later.");
            window.location.href = "/register";
          </script>
        `);
        return;
      }

      if (results.length > 0) {
        res.send(`
          <script>
            alert("User already exists. Please use another email or username.");
            window.location.href = "/register";
          </script>
        `);
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user into DB
      db.query(
        "INSERT INTO Users (username, email, password) VALUES (?, ?, ?)",
        [username, email, hashedPassword],
        (err, result) => {
          if (err) {
            res.send(`
              <script>
                alert("Registration failed. Please try again.");
                window.location.href = "/register";
              </script>
            `);
            return;
          }

          res.send(`
            <script>
              alert("Successfully registered!");
              window.location.href = "/homepage.html";
            </script>
          `);
        }
      );
    }
  );
});


// Ticket Reservation
app.post("/reserve-tickets", (req, res) => {
    // Ensure the user is logged in
    if (!req.session.user) {
        return res.send(`
            <script>
                alert("You must be logged in to reserve tickets.");
                window.location.href = "/login";
            </script>
        `);
    }

    const userId = req.session.user.id; // Logged-in user's ID
    const { name, email, phone, race, seats, agency, comments } = req.body; // Extract form data

    // Insert reservation into database
    db.query(
        "INSERT INTO ticket_reservations (user_id, name, email, phone, race, seats, agency, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [userId, name, email, phone, race, seats, agency, comments],
        (err, result) => {
            if (err) {
                console.error("Error inserting reservation:", err);
                return res.send(`
                    <script>
                        alert("Failed to reserve tickets. Please try again later.");
                        window.location.href = "/tickets";
                    </script>
                `);
            }

            // Success response
            res.send(`
                <script>
                    alert("Tickets reserved successfully!");
                    window.location.href = "/tickets";
                </script>
            `);
        }
    );
});



// Profile Endpoint
app.get("/api/profile", (req, res) => {
    // Ensure the user is logged in
    if (!req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.session.user.id;

    // Fetch user details
    db.query("SELECT username, email, role FROM Users WHERE id = ?", [userId], (err, userResults) => {
        if (err) {
            console.error("Error fetching user details:", err);
            return res.status(500).json({ message: "Failed to fetch user details." });
        }

        // Fetch tickets
        db.query(
            "SELECT race, seats AS seat, agency, reservation_date, comments, race FROM ticket_reservations WHERE user_id = ?",
            [userId],
            (err, ticketResults) => {
                if (err) {
                    console.error("Error fetching tickets:", err);
                    return res.status(500).json({ message: "Failed to fetch tickets." });
                }

                // Send combined results
                res.json({
                    user: userResults[0], // User details
                    tickets: ticketResults // Tickets
                });
            }
        );
    });
});

// Logout Endpoint
app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error during logout:", err);
            return res.status(500).json({ message: "Failed to log out." });
        }
        console.log("Session destroyed, user logged out");
        res.status(200).send("Logged out successfully.");
    });
});

// Serve Profile Page
app.get("/profile", (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.send(`
            <script>
                alert("You must be logged in to view your profile.");
                window.location.href = "/login";
            </script>
        `);
    }

    // Serve the profile page
    res.sendFile(path.join(__dirname, "..", "profile.html"));
});


app.get("/debug-session", (req, res) => {
    res.json({
        session: req.session,
        user: req.session.user || "No user logged in"
    });
});

// Serve Login Page with Auto-Logout
app.get("/login", (req, res) => {
    // Check if user is already logged in
    if (req.session.user) {
        console.log("Auto-logging out user:", req.session.user.username);

        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
                return res.status(500).send(`
                    <script>
                        alert("An error occurred while logging out. Please try again.");
                        window.location.href = "/";
                    </script>
                `);
            }

            // Serve the login page after logging out
            res.sendFile(path.join(__dirname, "..", "login.html"));
        });
    } else {
        // Serve the login page directly if no session exists
        res.sendFile(path.join(__dirname, "..", "login.html"));
    }
});

app.get("/api/admin/tickets", (req, res) => {
  db.query("SELECT * FROM ticket_reservations", (err, results) => {
      if (err) return res.status(500).json({ message: "Error fetching tickets." });
      res.json(results);
  });
});

app.delete("/api/admin/tickets/:id", (req, res) => {
  const ticketId = req.params.id;
  db.query("DELETE FROM ticket_reservations WHERE id = ?", [ticketId], (err) => {
      if (err) return res.status(500).json({ message: "Error deleting ticket." });
      res.status(200).send("Ticket deleted.");
  });
});

app.post("/api/admin/races", (req, res) => {
  const { name, location, date, description } = req.body;
  db.query(
      "INSERT INTO races (name, location, date, description) VALUES (?, ?, ?, ?)",
      [name, location, date, description],
      (err) => {
          if (err) return res.status(500).json({ message: "Error adding race." });
          res.status(201).send("Race added.");
      }
  );
});

app.get("/api/admin/races", (req, res) => {
  db.query("SELECT * FROM races", (err, results) => {
      if (err) return res.status(500).json({ message: "Error fetching races." });
      res.json(results);
  });
});

app.delete("/api/admin/races/:id", (req, res) => {
  const raceId = req.params.id;
  db.query("DELETE FROM races WHERE id = ?", [raceId], (err) => {
      if (err) return res.status(500).json({ message: "Error deleting race." });
      res.status(200).send("Race deleted.");
  });
});

app.get("/admin", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
      return res.send(`
          <script>
              alert("Unauthorized access. Please log in as an admin.");
              window.location.href = "/login";
          </script>
      `);
  }
  res.sendFile(path.join(__dirname, "..", "admin.html"));
});

app.get("/api/races", (req, res) => {
  db.query("SELECT id, name, location, date FROM races", (err, results) => {
      if (err) {
          console.error("Error fetching races:", err);
          return res.status(500).json({ message: "Failed to fetch races." });
      }
      res.json(results);
  });
});

app.post("/api/admin/races", (req, res) => {
  const { name, location, date } = req.body;
  db.query(
      "INSERT INTO races (name, location, date) VALUES (?, ?, ?)",
      [name, location, date],
      (err) => {
          if (err) {
              console.error("Error adding race:", err);
              return res.status(500).json({ message: "Failed to add race." });
          }
          res.status(201).send("Race added successfully.");
      }
  );
});

app.delete("/api/admin/races/:id", (req, res) => {
  const raceId = req.params.id;
  db.query("DELETE FROM races WHERE id = ?", [raceId], (err) => {
      if (err) {
          console.error("Error deleting race:", err);
          return res.status(500).json({ message: "Failed to delete race." });
      }
      res.status(200).send("Race deleted successfully.");
  });
});



app.get("/homepage", (req, res) => {
    res.sendFile(path.join(__dirname, "../../f2/homepage.html"));
});