const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const _ = require("lodash");

const app = express();

// environment variables
const port = 4000;
const secretKey = "DmgSecret";

// db and in-memory data
let statSource = {};
let lastMinerId = 100;
let miners = [];
let paginatedData = [];
let totalPages = 0;
const users = {
  taylors: { username: "taylors", fullname: "Taylor Swift", password: "111" },
  tomc: { username: "tomc", fullname: "Tom Cruise", password: "222" },
};

// external data cache
const cache = {};

function getNextId() {
  lastMinerId++;
  return lastMinerId;
}

function calculatePaginationData() {
  paginatedData = _.chunk(miners, 10);
  totalPages = paginatedData.length;
}

async function init() {
  try {
    const jsonData = fs.readFileSync(
      "./data/mining_hardware_data.json",
      "utf8"
    );
    miners = JSON.parse(jsonData);
    calculatePaginationData();
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }

  try {
    const filepath = "./data/mining_statistics_data.json";
    const jsonData = fs.readFileSync(filepath, "utf8");
    statSource = JSON.parse(jsonData);
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal Server Error");
  }
}

init();

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

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

app.get("/api/miner", async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];
  const { pageStart = 0 } = req.query;

  if (!verifyToken(token)) {
    res.status(401).send("Unauthorized");
    return;
  }

  res.status(200).json({ items: paginatedData[pageStart] || [], totalPages });
});

app.post("/api/miner", async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  if (!verifyToken(token)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const { name, location, hashRate } = req.body;

  if (!name || !location || !hashRate) {
    res.status(400).json({ status: "failed", reason: "Invalid request data" });
    return;
  }

  const newMiner = {
    id: getNextId(),
    name,
    location,
    hashRate,
  };

  miners.push(newMiner);
  calculatePaginationData();

  res.status(201).json({
    status: "success",
    items: paginatedData[0],
    pageStart: 0,
    totalPages,
  });
});

app.put("/api/miner", async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  if (!verifyToken(token)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const { id, name, location, hashRate } = req.body;

  if (!id || !name || !location || !hashRate) {
    res.status(400).json({ status: "failed", reason: "Invalid request data" });
    return;
  }

  const idx = miners.findIndex((miner) => miner.id == id);

  if (idx !== -1) {
    miners[idx].name = name;
    miners[idx].location = location;
    miners[idx].hashRate = hashRate;

    res.status(200).json({
      status: "success",
      item: miners[idx],
    });
  } else {
    res.status(404).json({ status: "failed", reason: "Miner not found" });
  }
});

app.delete("/api/miner", async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  const mid = parseInt(req.query?.id);

  if (typeof mid !== "number") {
    res
      .status(404)
      .json({ status: "failed", reason: "Miner Id must be a number" });
  }

  if (!verifyToken(token)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const filtered = miners.filter((miner) => miner.id !== mid);

  if (filtered.length < miners.length) {
    miners = filtered;
    calculatePaginationData();
    const pageStart = 0;
    res.status(200).json({
      status: "success",
      items: paginatedData[pageStart],
      totalPages,
      pageStart,
    });
  } else {
    res.status(404).json({ status: "failed", reason: "Not Found" });
  }
});

app.get("/api/stats", async (req, res) => {
  const token = req.headers.authorization.split(" ")[1];

  if (!verifyToken(token)) {
    res.status(401).send("Unauthorized");
    return;
  }

  const handleErrors = (reason) => {
    errors.push(reason);
    console.log(reason);
  };

  let url,
    resp,
    statData = { ...statSource },
    errors = [];

  try {
    const hashRates = miners?.map((miner) => parseFloat(miner.hashRate));
    statData.averageHashRate = _.sum(hashRates) / hashRates.length;
  } catch (err) {
    handleErrors(`unable to compute average hashrate`);
  }

  if (!cache["btcDifficulty"]) {
    try {
      url = "https://blockchain.info/q/getdifficulty";
      resp = await axios.get(url);

      if (!resp?.data) {
        cache["btcDifficulty"] = null;
        throw "data missing";
      }

      if (typeof resp?.data !== "number") {
        cache["btcDifficulty"] = null;
        throw `response type is incorrect`;
      }

      cache["btcDifficulty"] = parseFloat(resp.data);
    } catch (error) {
      handleErrors(`unable to fetch BTC difficulty`);
      cache["btcDifficulty"] = null;
    }
  }

  if (!cache["btcPrice"]) {
    try {
      url =
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";
      resp = await axios.get(url);

      if (!resp.data?.bitcoin?.usd) {
        cache["btcPrice"] = null;
        throw "data missing";
      }

      if (typeof resp.data?.bitcoin?.usd !== "number") {
        cache["btcPrice"] = null;
        throw `response type is incorrect`;
      }
      cache["btcPrice"] = resp.data?.bitcoin?.usd ?? null;
    } catch (error) {
      handleErrors(`unable to fetch BTC price`);
      cache["btcPrice"] = null;
    }
  }

  res.status(200).json({
    stat: { ...statData, ...cache },
    errors,
  });
});

if (process.env.mode !== "test") {
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

module.exports = app;
