const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const _ = require("lodash");

const app = express();

const port = 4000;
const secretKey = "secret";

const users = {
  taylors: { username: "taylors", fullname: "Taylor Swift", password: "111" },
  tomc: { username: "tomc", fullname: "Tom Cruise", password: "222" },
};

function getToken(payload) {
  const token = jwt.sign(payload, secretKey, {
    expiresIn: "1d",
  });
  return token;
}

function verifyToken(token) {
  let result = undefined;
  try {
    result = jwt.verify(token, secretKey);
  } catch {
    result = false;
  }
  return result;
}

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (users[username]) {
    const user = users[username];
    if (user.password === password) {
      res.status(200).json({ token: getToken(_.omit(user, "password")) });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.get("/api/items", async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  if (!verifyToken(token)) {
    res.status(401).send("Unauthorized");
    return;
  }

  res.status(200).json({ items: ["a", "b", "c"] });
});

if (process.env.mode !== "test") {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

module.exports = app;
